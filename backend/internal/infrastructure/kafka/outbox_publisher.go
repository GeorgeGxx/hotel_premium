package kafka

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	kafkaGo "github.com/segmentio/kafka-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
)

const maxOutboxRetries = 10

type OutboxPublisher struct {
	pool         *pgxpool.Pool
	writer       *kafkaGo.Writer
	stayTopic    string
	pollInterval time.Duration
}

func NewOutboxPublisher(pool *pgxpool.Pool, bootstrapServers string, stayTopic string) *OutboxPublisher {
	writer := &kafkaGo.Writer{
		Addr:         kafkaGo.TCP(bootstrapServers),
		Topic:        stayTopic,
		Balancer:     &kafkaGo.LeastBytes{},
		BatchSize:    100,
		BatchTimeout: 10 * time.Millisecond,
		Compression:  kafkaGo.Lz4,
		Async:        false,
		RequiredAcks: kafkaGo.RequireOne,
	}

	return &OutboxPublisher{
		pool:         pool,
		writer:       writer,
		stayTopic:    stayTopic,
		pollInterval: 1 * time.Second,
	}
}

func (p *OutboxPublisher) Start(ctx context.Context) {
	slog.Info("Starting Kafka Outbox Event Publisher Goroutine",
		"topic", p.stayTopic,
		"poll_interval", p.pollInterval.String(),
	)

	ticker := time.NewTicker(p.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("Stopping Kafka Outbox Publisher gracefully...")
			if err := p.writer.Close(); err != nil {
				slog.Warn("Error closing Kafka writer", "error", err)
			}
			return
		case <-ticker.C:
			p.processPendingEvents(ctx)
		}
	}
}

type outboxRecord struct {
	id            uuid.UUID
	aggregateType string
	aggregateID   uuid.UUID
	eventType     string
	payload       []byte
	traceID       string
	retryCount    int
}

// buildW3CTraceparent constructs a W3C traceparent header from a stored 32-hex OpenTelemetry TraceID
func buildW3CTraceparent(traceID string) string {
	cleaned := strings.TrimSpace(strings.ToLower(traceID))
	if len(cleaned) != 32 {
		return ""
	}
	for _, c := range cleaned {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			return ""
		}
	}
	return fmt.Sprintf("00-%s-0000000000000001-01", cleaned)
}

func (p *OutboxPublisher) processPendingEvents(ctx context.Context) {
	if p.pool == nil {
		return
	}

	// Phase 1: Claim a batch of PENDING events in a short transaction so row locks are not held across network I/O
	claimCtx, claimCancel := context.WithTimeout(ctx, 3*time.Second)
	defer claimCancel()

	tx, err := p.pool.Begin(claimCtx)
	if err != nil {
		return
	}
	defer tx.Rollback(claimCtx)

	claimQuery := `
		SELECT id, aggregate_type, aggregate_id, event_type, payload, COALESCE(trace_id, ''), retry_count
		FROM stay_outbox_events
		WHERE status = 'PENDING' AND retry_count < $1
		ORDER BY created_at ASC
		LIMIT 50
		FOR UPDATE SKIP LOCKED
	`

	rows, err := tx.Query(claimCtx, claimQuery, maxOutboxRetries)
	if err != nil {
		return
	}

	var records []outboxRecord
	var claimedIDs []uuid.UUID
	for rows.Next() {
		var r outboxRecord
		if err := rows.Scan(&r.id, &r.aggregateType, &r.aggregateID, &r.eventType, &r.payload, &r.traceID, &r.retryCount); err == nil {
			records = append(records, r)
			claimedIDs = append(claimedIDs, r.id)
		}
	}
	rows.Close()

	if len(records) == 0 {
		return
	}

	// Commit claim transaction immediately to release PostgreSQL locks before Kafka network I/O
	_ = tx.Commit(claimCtx)

	// Phase 2: Build Kafka messages with W3C Trace Context propagation
	var kafkaMessages []kafkaGo.Message
	propagator := otel.GetTextMapPropagator()

	for _, rec := range records {
		var headers []kafkaGo.Header

		carrier := propagation.HeaderCarrier{}
		propagator.Inject(ctx, carrier)
		if tp := buildW3CTraceparent(rec.traceID); tp != "" {
			carrier.Set("traceparent", tp)
		}
		for k, v := range carrier {
			if len(v) > 0 {
				headers = append(headers, kafkaGo.Header{Key: k, Value: []byte(v[0])})
			}
		}

		headers = append(headers,
			kafkaGo.Header{Key: "event_id", Value: []byte(rec.id.String())},
			kafkaGo.Header{Key: "event_type", Value: []byte(rec.eventType)},
			kafkaGo.Header{Key: "aggregate_type", Value: []byte(rec.aggregateType)},
			kafkaGo.Header{Key: "correlation_trace_id", Value: []byte(rec.traceID)},
		)

		msg := kafkaGo.Message{
			Key:     []byte(rec.aggregateID.String()),
			Value:   rec.payload,
			Headers: headers,
			Time:    time.Now().UTC(),
		}
		kafkaMessages = append(kafkaMessages, msg)
	}

	// Phase 3: Publish batch to Kafka with bounded timeout
	publishCtx, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()

	if err := p.writer.WriteMessages(publishCtx, kafkaMessages...); err != nil {
		slog.Warn("Failed to publish outbox events to Kafka; incrementing retry_count",
			"count", len(kafkaMessages),
			"error", err,
		)
		failQuery := `
			UPDATE stay_outbox_events
			SET 
				retry_count = retry_count + 1,
				status = CASE WHEN retry_count + 1 >= $2 THEN 'FAILED' ELSE 'PENDING' END
			WHERE id = ANY($1)
		`
		_, _ = p.pool.Exec(ctx, failQuery, claimedIDs, maxOutboxRetries)
		return
	}

	// Phase 4: Mark outbox records as PUBLISHED
	updateQuery := `
		UPDATE stay_outbox_events
		SET status = 'PUBLISHED', published_at = CURRENT_TIMESTAMP
		WHERE id = ANY($1)
	`
	if _, err := p.pool.Exec(ctx, updateQuery, claimedIDs); err != nil {
		slog.Error("Failed to mark outbox events as published", "error", err)
		return
	}

	slog.Info("Successfully published events to Kafka KRaft",
		"topic", p.stayTopic,
		"published_count", len(claimedIDs),
	)
}

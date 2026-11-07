package kafka

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	kafkaGo "github.com/segmentio/kafka-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
)

type OutboxPublisher struct {
	pool          *pgxpool.Pool
	writer        *kafkaGo.Writer
	stayTopic     string
	pollInterval  time.Duration
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
}

func (p *OutboxPublisher) processPendingEvents(ctx context.Context) {
	if p.pool == nil {
		return
	}

	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return
	}
	defer tx.Rollback(ctx)

	query := `
		SELECT id, aggregate_type, aggregate_id, event_type, payload, COALESCE(trace_id, '')
		FROM stay_outbox_events
		WHERE status = 'PENDING'
		ORDER BY created_at ASC
		LIMIT 50
		FOR UPDATE SKIP LOCKED
	`

	rows, err := tx.Query(ctx, query)
	if err != nil {
		return
	}

	var records []outboxRecord
	for rows.Next() {
		var r outboxRecord
		if err := rows.Scan(&r.id, &r.aggregateType, &r.aggregateID, &r.eventType, &r.payload, &r.traceID); err == nil {
			records = append(records, r)
		}
	}
	rows.Close()

	if len(records) == 0 {
		return
	}

	var kafkaMessages []kafkaGo.Message
	var successfulIDs []uuid.UUID

	propagator := otel.GetTextMapPropagator()

	for _, rec := range records {
		var headers []kafkaGo.Header

		// Inject Trace Context into Kafka message header
		carrier := propagation.HeaderCarrier{}
		propagator.Inject(ctx, carrier)
		for k, v := range carrier {
			if len(v) > 0 {
				headers = append(headers, kafkaGo.Header{Key: k, Value: []byte(v[0])})
			}
		}

		headers = append(headers,
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
		successfulIDs = append(successfulIDs, rec.id)
	}

	publishCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	if err := p.writer.WriteMessages(publishCtx, kafkaMessages...); err != nil {
		slog.Warn("Failed to publish outbox events to Kafka (broker unreachable or retrying)",
			"count", len(kafkaMessages),
			"error", err,
		)
		return
	}

	// Update outbox records as PUBLISHED
	updateQuery := `
		UPDATE stay_outbox_events
		SET status = 'PUBLISHED', published_at = CURRENT_TIMESTAMP
		WHERE id = ANY($1)
	`
	if _, err := tx.Exec(ctx, updateQuery, successfulIDs); err != nil {
		slog.Error("Failed to mark outbox events as published", "error", err)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		slog.Error("Failed to commit outbox status update", "error", err)
		return
	}

	slog.Info("Successfully published events to Kafka 8.3.2 KRaft",
		"topic", p.stayTopic,
		"published_count", len(successfulIDs),
	)
}

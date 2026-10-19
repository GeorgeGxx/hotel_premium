package kafka

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	kafkaGo "github.com/segmentio/kafka-go"
)

var (
	dlqCounter = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "kafka_messages_dlq_total",
			Help: "Total number of poison pill messages routed to Dead Letter Queue in Kafka 7.8.0",
		},
		[]string{"original_topic", "dlq_topic", "reason"},
	)

	retryCounter = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "kafka_consumer_retries_total",
			Help: "Total number of message processing retries with exponential backoff",
		},
		[]string{"topic"},
	)
)

type DLQManager struct {
	dlqWriter   *kafkaGo.Writer
	dlqTopic    string
	maxRetries  int
	baseBackoff time.Duration
}

func NewDLQManager(bootstrapServers string, baseTopic string, maxRetries int, baseBackoff time.Duration) *DLQManager {
	dlqTopic := baseTopic + ".DLQ"
	writer := &kafkaGo.Writer{
		Addr:         kafkaGo.TCP(bootstrapServers),
		Topic:        dlqTopic,
		Balancer:     &kafkaGo.LeastBytes{},
		BatchSize:    10,
		BatchTimeout: 10 * time.Millisecond,
		RequiredAcks: kafkaGo.RequireOne,
	}

	return &DLQManager{
		dlqWriter:   writer,
		dlqTopic:    dlqTopic,
		maxRetries:  maxRetries,
		baseBackoff: baseBackoff,
	}
}

// ProcessWithRetry executes the message handler with exponential backoff; if all retries fail, routes to DLQ
func (m *DLQManager) ProcessWithRetry(ctx context.Context, msg kafkaGo.Message, handler func(msg kafkaGo.Message) error) error {
	var lastErr error

	for attempt := 0; attempt <= m.maxRetries; attempt++ {
		if attempt > 0 {
			retryCounter.WithLabelValues(msg.Topic).Inc()
			backoff := time.Duration(float64(m.baseBackoff) * math.Pow(2, float64(attempt-1)))
			slog.Warn("Kafka message handler failed, retrying with exponential backoff",
				"attempt", attempt,
				"max_retries", m.maxRetries,
				"backoff_ms", backoff.Milliseconds(),
				"offset", msg.Offset,
				"error", lastErr,
			)

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(backoff):
			}
		}

		err := handler(msg)
		if err == nil {
			return nil
		}
		lastErr = err
	}

	// All retries exhausted: route poison pill to DLQ topic
	slog.Error("Max retries exhausted: routing poison pill to Dead Letter Queue",
		"original_topic", msg.Topic,
		"dlq_topic", m.dlqTopic,
		"offset", msg.Offset,
		"error", lastErr,
	)

	dlqMsg := kafkaGo.Message{
		Key:   msg.Key,
		Value: msg.Value,
		Headers: append(msg.Headers,
			kafkaGo.Header{Key: "dlq_original_topic", Value: []byte(msg.Topic)},
			kafkaGo.Header{Key: "dlq_error_reason", Value: []byte(lastErr.Error())},
			kafkaGo.Header{Key: "dlq_failed_at", Value: []byte(time.Now().UTC().Format(time.RFC3339))},
		),
	}

	if err := m.dlqWriter.WriteMessages(ctx, dlqMsg); err != nil {
		slog.Error("Failed to write poison pill to DLQ topic", "error", err)
		return fmt.Errorf("dlq publish error: %w", err)
	}

	dlqCounter.WithLabelValues(msg.Topic, m.dlqTopic, lastErr.Error()).Inc()
	return nil
}

func (m *DLQManager) Close() error {
	if m.dlqWriter != nil {
		return m.dlqWriter.Close()
	}
	return nil
}

package kafka

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	kafkaGo "github.com/segmentio/kafka-go"
)

var (
	dlqCounter = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "kafka_messages_dlq_total",
			Help: "Total number of poison pill messages routed to Dead Letter Queue in Kafka 8.3.2",
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

type DLQEventRecord struct {
	Key           string    `json:"key"`
	Value         string    `json:"value"`
	OriginalTopic string    `json:"original_topic"`
	DLQTopic      string    `json:"dlq_topic"`
	ErrorReason   string    `json:"error_reason"`
	FailedAt      time.Time `json:"failed_at"`
}

type DLQManager struct {
	bootstrap   string
	dlqWriter   *kafkaGo.Writer
	dlqTopic    string
	maxRetries  int
	baseBackoff time.Duration
	recentEvents []DLQEventRecord
	mu          sync.RWMutex
}

func NewDLQManager(bootstrapServers string, baseTopic string, maxRetries int, baseBackoff time.Duration) *DLQManager {
	dlqTopic := baseTopic + ".DLQ"
	writer := &kafkaGo.Writer{
		Addr:         kafkaGo.TCP(bootstrapServers),
		Topic:        dlqTopic,
		Balancer:     &kafkaGo.LeastBytes{},
		BatchSize:    10,
		BatchTimeout: 10 * time.Millisecond,
		Compression:  kafkaGo.Lz4,
		RequiredAcks: kafkaGo.RequireOne,
	}

	return &DLQManager{
		bootstrap:    bootstrapServers,
		dlqWriter:    writer,
		dlqTopic:     dlqTopic,
		maxRetries:   maxRetries,
		baseBackoff:  baseBackoff,
		recentEvents: make([]DLQEventRecord, 0, 50),
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

	m.recordEvent(DLQEventRecord{
		Key:           string(msg.Key),
		Value:         string(msg.Value),
		OriginalTopic: msg.Topic,
		DLQTopic:      m.dlqTopic,
		ErrorReason:   lastErr.Error(),
		FailedAt:      time.Now().UTC(),
	})

	dlqCounter.WithLabelValues(msg.Topic, m.dlqTopic, lastErr.Error()).Inc()
	return nil
}

func (m *DLQManager) recordEvent(rec DLQEventRecord) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.recentEvents) >= 50 {
		m.recentEvents = m.recentEvents[1:]
	}
	m.recentEvents = append(m.recentEvents, rec)
}

// GetDLQEvents returns recent failed events captured by the DLQ manager
func (m *DLQManager) GetDLQEvents() []DLQEventRecord {
	m.mu.RLock()
	defer m.mu.RUnlock()
	res := make([]DLQEventRecord, len(m.recentEvents))
	copy(res, m.recentEvents)
	return res
}

// Replay re-publishes a message from DLQ back to a destination topic for recovery
func (m *DLQManager) Replay(ctx context.Context, targetTopic string, key, value []byte) error {
	writer := &kafkaGo.Writer{
		Addr:         kafkaGo.TCP(m.bootstrap),
		Topic:        targetTopic,
		Balancer:     &kafkaGo.LeastBytes{},
		RequiredAcks: kafkaGo.RequireOne,
	}
	defer writer.Close()

	return writer.WriteMessages(ctx, kafkaGo.Message{
		Key:   key,
		Value: value,
		Time:  time.Now().UTC(),
	})
}

func (m *DLQManager) Close() error {
	if m.dlqWriter != nil {
		return m.dlqWriter.Close()
	}
	return nil
}

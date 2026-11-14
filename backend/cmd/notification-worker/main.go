package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/hotelpremium/backend/internal/infrastructure/config"
	infraHttp "github.com/hotelpremium/backend/internal/infrastructure/http"
	"github.com/hotelpremium/backend/internal/infrastructure/http/handler"
	"github.com/hotelpremium/backend/internal/infrastructure/kafka"
	"github.com/hotelpremium/backend/internal/infrastructure/redis"
	"github.com/hotelpremium/backend/internal/infrastructure/telemetry"
	kafkaGo "github.com/segmentio/kafka-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	slog.Info("Starting Notification Worker (Kafka Consumer with DLQ, Redis Deduplication & Exponential Backoff)...")

	cfg := config.Load()
	port := os.Getenv("PORT")
	if port == "" {
		port = os.Getenv("NOTIFICATION_WORKER_PORT")
	}
	if idx := strings.LastIndex(port, ":"); idx != -1 {
		port = port[idx+1:]
	}
	if port == "" {
		port = "8084"
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	// 1. OpenTelemetry Tracing Initialization
	shutdownTracer, err := telemetry.InitTracer(ctx, "notification-worker", cfg.OTelCollectorURL)
	if err == nil && shutdownTracer != nil {
		defer func() {
			sCtx, sCancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer sCancel()
			_ = shutdownTracer(sCtx)
		}()
	}

	// 1b. Redis Client for Idempotent Event Deduplication
	var processedEvents atomic.Uint64
	var deduplicatedEvents atomic.Uint64
	redisClient, err := redis.NewClient(ctx, cfg.RedisAddr, cfg.RedisPassword, 0)
	if err == nil && redisClient != nil {
		defer redisClient.Close()
		handler.RegisterReadinessCheck("redis", func(c context.Context) error {
			return redisClient.Ping(c).Err()
		})
	}

	// 2. Kafka DLQ Manager Initialization (3 retries, 500ms base backoff)
	dlqManager := kafka.NewDLQManager(cfg.KafkaBootstrapServers, cfg.KafkaStayTopic, 3, 500*time.Millisecond)
	defer dlqManager.Close()

	// 3. Gin v1.12.0 Engine (Metrics, Liveness, Readiness, DLQ & Notifications with unified RBAC/OTel/Logger)
	engine := infraHttp.NewGinNotificationEngine(cfg.KafkaStayTopic, dlqManager, &processedEvents, &deduplicatedEvents)

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      engine,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	go func() {
		slog.Info("Notification Worker metrics & health listening", "port", port)
		_ = server.ListenAndServe()
	}()

	// 4. Kafka Consumer Setup
	reader := kafkaGo.NewReader(kafkaGo.ReaderConfig{
		Brokers:        []string{cfg.KafkaBootstrapServers},
		GroupID:        "hotel-notification-workers",
		Topic:          cfg.KafkaStayTopic,
		MinBytes:       10e3, // 10KB
		MaxBytes:       10e6, // 10MB
		CommitInterval: 1 * time.Second,
		StartOffset:    kafkaGo.FirstOffset,
	})
	defer reader.Close()

	slog.Info("Notification Worker connected to Kafka with DLQ",
		"broker", cfg.KafkaBootstrapServers,
		"topic", cfg.KafkaStayTopic,
		"dlq_topic", cfg.KafkaStayTopic+".DLQ",
		"group_id", "hotel-notification-workers",
	)

	propagator := otel.GetTextMapPropagator()

	// 5. Message Consumer Loop
	for {
		msg, err := reader.ReadMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				slog.Info("Notification worker shutting down cleanly...")
				shutdownCtx, sCancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer sCancel()
				_ = server.Shutdown(shutdownCtx)
				return
			}
			slog.Warn("Kafka read message error, retrying...", "error", err)
			time.Sleep(1 * time.Second)
			continue
		}

		// Process with Exponential Backoff and Poison-Pill DLQ Protection
		_ = dlqManager.ProcessWithRetry(ctx, msg, func(m kafkaGo.Message) error {
			carrier := propagation.HeaderCarrier{}
			var eventType, correlationID, eventID string
			for _, h := range m.Headers {
				carrier[h.Key] = []string{string(h.Value)}
				switch h.Key {
				case "event_type":
					eventType = string(h.Value)
				case "correlation_trace_id":
					correlationID = string(h.Value)
				case "event_id":
					eventID = string(h.Value)
				}
			}

			msgCtx := propagator.Extract(ctx, carrier)
			var span trace.Span
			if telemetry.Tracer != nil {
				msgCtx, span = telemetry.Tracer.Start(msgCtx, "KafkaConsumer: "+eventType,
					trace.WithSpanKind(trace.SpanKindConsumer),
				)
				defer span.End()
			}

			var payload map[string]interface{}
			if err := json.Unmarshal(m.Value, &payload); err != nil {
				return errors.New("malformed json payload: poison pill")
			}

			// Idempotent Event Deduplication via Redis (24h TTL) using stable event_id when available
			if redisClient != nil {
				var dedupKey string
				if eventID != "" {
					dedupKey = fmt.Sprintf("notif:dedup:id:%s", eventID)
				} else {
					dedupKey = fmt.Sprintf("notif:dedup:%s:%s:%d:%d", eventType, string(m.Key), m.Partition, m.Offset)
				}
				acquired, rErr := redisClient.SetNX(msgCtx, dedupKey, "1", 24*time.Hour).Result()
				if rErr == nil && !acquired {
					deduplicatedEvents.Add(1)
					slog.Info("Skipping duplicate Kafka event (idempotency guard)",
						"dedup_key", dedupKey,
						"event_type", eventType,
					)
					return nil
				}
			}

			processedEvents.Add(1)
			slog.Info("Processed Domain Event from Kafka",
				"topic", m.Topic,
				"partition", m.Partition,
				"offset", m.Offset,
				"event_key", string(m.Key),
				"event_type", eventType,
				"correlation_id", correlationID,
				"stay_id", payload["stay_id"],
			)

			switch eventType {
			case "STAY_CREATED", "StayCreated":
				slog.Info("[Notification] Dispatched reservation confirmation voucher",
					"stay_id", payload["stay_id"],
					"room_id", payload["room_id"],
				)
			case "GUEST_CHECKED_OUT", "GuestCheckedOut":
				slog.Info("[Notification] Dispatched Housekeeping turnover alert",
					"room_id", payload["room_id"],
					"stay_id", payload["stay_id"],
				)
			case "STAY_CANCELLED", "StayCancelled":
				slog.Info("[Notification] Processed reservation cancellation notification",
					"stay_id", payload["stay_id"],
				)
			}

			return nil
		})
	}
}

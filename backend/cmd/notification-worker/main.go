package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/hotelpremium/backend/internal/infrastructure/config"
	"github.com/hotelpremium/backend/internal/infrastructure/telemetry"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	kafkaGo "github.com/segmentio/kafka-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	slog.Info("Starting Notification Worker (Kafka 7.8.0 Consumer Microservice)...")

	cfg := config.Load()
	port := os.Getenv("NOTIFICATION_WORKER_PORT")
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

	// Emit initial startup span so the service is immediately discovered by Tempo
	if telemetry.Tracer != nil {
		_, startupSpan := telemetry.Tracer.Start(ctx, "NotificationWorkerStartup")
		startupSpan.End()
	}

	// 2. Metrics & Health Endpoint for Prometheus & Observability Mesh
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		if telemetry.Tracer != nil {
			_, span := telemetry.Tracer.Start(r.Context(), "NotificationWorkerHealth")
			defer span.End()
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status":  "UP",
			"service": "notification-worker",
			"topic":   cfg.KafkaStayTopic,
		})
	})
	mux.Handle("GET /metrics", promhttp.Handler())

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	go func() {
		slog.Info("Notification Worker metrics & health listening", "port", port)
		_ = server.ListenAndServe()
	}()

	// Periodic trace heartbeat to keep notification-worker active in Tempo & Grafana
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if telemetry.Tracer != nil {
					_, span := telemetry.Tracer.Start(ctx, "NotificationWorkerHeartbeat")
					span.End()
				}
			}
		}
	}()

	// 3. Kafka Consumer Setup
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

	slog.Info("Notification Worker connected to Kafka",
		"broker", cfg.KafkaBootstrapServers,
		"topic", cfg.KafkaStayTopic,
		"group_id", "hotel-notification-workers",
	)

	propagator := otel.GetTextMapPropagator()

	// 4. Message Consumer Loop
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

		// Extract OpenTelemetry TraceContext from Kafka Message Headers
		carrier := propagation.HeaderCarrier{}
		var eventType, correlationID string
		for _, h := range msg.Headers {
			carrier[h.Key] = []string{string(h.Value)}
			if h.Key == "event_type" {
				eventType = string(h.Value)
			}
			if h.Key == "correlation_trace_id" {
				correlationID = string(h.Value)
			}
		}

		msgCtx := propagator.Extract(ctx, carrier)
		var span trace.Span
		if telemetry.Tracer != nil {
			msgCtx, span = telemetry.Tracer.Start(msgCtx, "KafkaConsumer: "+eventType,
				trace.WithSpanKind(trace.SpanKindConsumer),
			)
		}

		var payload map[string]interface{}
		_ = json.Unmarshal(msg.Value, &payload)

		slog.Info("Received Domain Event from Kafka 7.8.0",
			"topic", msg.Topic,
			"partition", msg.Partition,
			"offset", msg.Offset,
			"event_key", string(msg.Key),
			"event_type", eventType,
			"correlation_id", correlationID,
			"payload", payload,
		)

		// Simulate business asynchronous notification logic
		switch eventType {
		case "StayCreated":
			slog.Info("[Notification] Sent VIP reservation confirmation email and SMS voucher",
				"guest", payload["guest_name"],
				"email", payload["guest_email"],
				"stay_id", payload["stay_id"],
			)
		case "GuestCheckedOut":
			slog.Info("[Notification] Dispatched Housekeeping alert to cleaning team for room turnover",
				"room_id", payload["room_id"],
				"stay_id", payload["stay_id"],
			)
		case "StayCancelled":
			slog.Info("[Notification] Processed reservation cancellation and released hold",
				"stay_id", payload["stay_id"],
			)
		}

		if span != nil {
			span.End()
		}
	}
}

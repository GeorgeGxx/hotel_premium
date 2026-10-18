package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/hotelpremium/backend/internal/infrastructure/config"
	infraHttp "github.com/hotelpremium/backend/internal/infrastructure/http"
	"github.com/hotelpremium/backend/internal/infrastructure/http/handler"
	"github.com/hotelpremium/backend/internal/infrastructure/kafka"
	"github.com/hotelpremium/backend/internal/infrastructure/postgres"
	"github.com/hotelpremium/backend/internal/infrastructure/redis"
	"github.com/hotelpremium/backend/internal/infrastructure/telemetry"
)

func main() {
	// 1. Structured JSON Logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	slog.Info("Starting Hotel Premium Backend Server...")

	// 2. Configuration
	cfg := config.Load()

	// 3. Root Application Context with Signal Interception
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	// 4. OpenTelemetry Tracing & Business Metrics Initialization
	shutdownTracer, err := telemetry.InitTracer(ctx, "hotel-backend", cfg.OTelCollectorURL)
	if err != nil {
		slog.Warn("OpenTelemetry tracer init deferred or collector unavailable", "error", err)
	} else if shutdownTracer != nil {
		defer func() {
			shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer shutdownCancel()
			_ = shutdownTracer(shutdownCtx)
		}()
	}
	telemetry.InitBusinessMetrics()

	// 5. Redis Client Initialization
	redisClient, err := redis.NewClient(ctx, cfg.RedisAddr, cfg.RedisPassword, 0)
	if err != nil {
		slog.Warn("Redis initialization failed", "error", err)
	}
	if redisClient != nil {
		defer redisClient.Close()
	}

	// 6. PostgreSQL Connection Pool
	dbPool, err := postgres.NewConnectionPool(ctx, cfg)
	if err != nil {
		slog.Error("Database connection initialization failed", "error", err)
	}
	if dbPool != nil {
		defer dbPool.Close()
	}

	// 7. Repositories & Handlers
	roomRepo := postgres.NewRoomRepository(dbPool)
	roomHandler := handler.NewRoomHandler(roomRepo)

	stayRepo := postgres.NewStayRepository(dbPool)
	stayHandler := handler.NewStayHandler(stayRepo)

	router := infraHttp.NewRouter(infraHttp.RouterDependencies{
		RoomHandler: roomHandler,
		StayHandler: stayHandler,
	})

	// 8. Kafka KRaft 7.8.0 Transactional Outbox Publisher
	if dbPool != nil {
		outboxPublisher := kafka.NewOutboxPublisher(dbPool, cfg.KafkaBootstrapServers, cfg.KafkaStayTopic)
		go outboxPublisher.Start(ctx)
	}

	// 9. HTTP Server
	server := &http.Server{
		Addr:         ":" + cfg.AppPort,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// 9. Goroutine for Non-blocking Server Listen
	go func() {
		slog.Info("HTTP Server listening", "port", cfg.AppPort, "env", cfg.AppEnv)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("HTTP Server fatal error", "error", err)
			os.Exit(1)
		}
	}()

	// 10. Graceful Shutdown on Signal
	<-ctx.Done()
	slog.Info("Shutting down HTTP Server gracefully...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("Server forced to shutdown", "error", err)
	}

	slog.Info("Hotel Premium Backend stopped cleanly")
}

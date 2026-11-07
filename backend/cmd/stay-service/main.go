package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/hotelpremium/backend/internal/application/saga"
	"github.com/hotelpremium/backend/internal/infrastructure/config"
	infraHttp "github.com/hotelpremium/backend/internal/infrastructure/http"
	"github.com/hotelpremium/backend/internal/infrastructure/http/handler"
	"github.com/hotelpremium/backend/internal/infrastructure/kafka"
	"github.com/hotelpremium/backend/internal/infrastructure/postgres"
	"github.com/hotelpremium/backend/internal/infrastructure/redis"
	"github.com/hotelpremium/backend/internal/infrastructure/telemetry"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	slog.Info("Starting Stay & Reservations Service (Microservice) with Go 1.26, Gin v1.12.0, GORM v1.31.2 & Saga Orchestrator...")

	cfg := config.Load()
	port := os.Getenv("PORT")
	if port == "" {
		port = os.Getenv("STAY_SERVICE_PORT")
	}
	if idx := strings.LastIndex(port, ":"); idx != -1 {
		port = port[idx+1:]
	}
	if port == "" {
		port = "8082"
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	// OpenTelemetry Tracing via Tempo / Alloy
	telemetry.InitBusinessMetrics()
	shutdownTracer, err := telemetry.InitTracer(ctx, "stay-service", cfg.OTelCollectorURL)
	if err == nil && shutdownTracer != nil {
		defer func() {
			sCtx, sCancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer sCancel()
			_ = shutdownTracer(sCtx)
		}()
	}

	// GORM v1.31.2 PostgreSQL initialization
	gormDB, err := postgres.NewGormDB(ctx, cfg)
	if err != nil {
		slog.Error("GORM database connection initialization failed", "error", err)
	}
	if gormDB != nil {
		sqlDB, err := gormDB.DB()
		if err == nil && sqlDB != nil {
			defer sqlDB.Close()
		}
	}

	// PostgreSQL Pool for high-throughput Outbox Publisher
	dbPool, err := postgres.NewConnectionPool(ctx, cfg)
	if err != nil {
		slog.Error("Database connection initialization failed", "error", err)
	}
	if dbPool != nil {
		defer dbPool.Close()
	}

	// Initialize Repositories
	stayRepo := postgres.NewGormStayRepository(gormDB)
	roomRepo := postgres.NewGormRoomRepository(gormDB)
	billingRepo := postgres.NewGormBillingRepository(gormDB)
	auditRepo := postgres.NewAuditRepository(gormDB)

	stayHandler := handler.NewStayHandler(stayRepo)

	// Saga Orchestrator for distributed booking with compensating transactions
	sagaOrchestrator := saga.NewBookingSagaOrchestrator(
		roomRepo,
		stayRepo,
		billingRepo,
		auditRepo,
		infraHttp.GlobalSSEHub.Broadcast,
	)

	// Kafka KRaft Transactional Outbox Publisher
	if dbPool != nil {
		outboxPublisher := kafka.NewOutboxPublisher(dbPool, cfg.KafkaBootstrapServers, cfg.KafkaStayTopic)
		go outboxPublisher.Start(ctx)
	}

	// Redis 8.8.1 client for distributed Idempotency locking and Cache-Aside
	redisClient, err := redis.NewClient(ctx, cfg.RedisAddr, cfg.RedisPassword, 0)
	if err == nil && redisClient != nil {
		defer redisClient.Close()
	}

	// Gin v1.12.0 Engine with Tracing, Metrics, SSE, Saga Orchestrator & Idempotency
	ginEngine := infraHttp.NewGinStayEngine(stayHandler, sagaOrchestrator, redisClient)

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      ginEngine,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		slog.Info("Stay Service listening with Gin v1.12.0 & Saga", "port", port, "env", cfg.AppEnv)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("Stay Service fatal error", "error", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	slog.Info("Shutting down Stay Service gracefully...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	_ = server.Shutdown(shutdownCtx)
}

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

	"github.com/hotelpremium/backend/internal/infrastructure/config"
	infraHttp "github.com/hotelpremium/backend/internal/infrastructure/http"
	"github.com/hotelpremium/backend/internal/infrastructure/http/handler"
	"github.com/hotelpremium/backend/internal/infrastructure/postgres"
	"github.com/hotelpremium/backend/internal/infrastructure/redis"
	"github.com/hotelpremium/backend/internal/infrastructure/telemetry"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	slog.Info("Starting Billing & POS Service (Microservice) with Go 1.26, Gin v1.12.0 and GORM v1.31.2...")

	cfg := config.Load()
	port := os.Getenv("PORT")
	if port == "" {
		port = os.Getenv("BILLING_SERVICE_PORT")
	}
	if idx := strings.LastIndex(port, ":"); idx != -1 {
		port = port[idx+1:]
	}
	if port == "" {
		port = "8083"
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	// OpenTelemetry Tracing via Tempo / Alloy
	telemetry.InitBusinessMetrics()
	shutdownTracer, err := telemetry.InitTracer(ctx, "billing-service", cfg.OTelCollectorURL)
	if err == nil && shutdownTracer != nil {
		defer func() {
			sCtx, sCancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer sCancel()
			_ = shutdownTracer(sCtx)
		}()
	}

	// Redis 8.8.1 client for distributed Idempotency locking on Folio charges
	redisClient, err := redis.NewClient(ctx, cfg.RedisAddr, cfg.RedisPassword, 0)
	if err == nil && redisClient != nil {
		defer redisClient.Close()
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

	// Initialize GORM Billing Repository and Handler
	billingRepo := postgres.NewGormBillingRepository(gormDB)
	billingHandler := handler.NewBillingHandler(billingRepo)

	// Gin v1.12.0 Engine with Tracing, Metrics, Idempotency and Slog Middleware
	ginEngine := infraHttp.NewGinBillingEngine(billingHandler, redisClient)

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      ginEngine,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		slog.Info("Billing Service listening with Gin v1.12.0", "port", port, "env", cfg.AppEnv)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("Billing Service fatal error", "error", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	slog.Info("Shutting down Billing Service gracefully...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	_ = server.Shutdown(shutdownCtx)
}

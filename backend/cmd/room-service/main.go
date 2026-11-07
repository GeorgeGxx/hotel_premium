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

	slog.Info("Starting Room Service (Microservice) with Go 1.26, Gin v1.12.0 and GORM v1.31.2...")

	cfg := config.Load()
	port := os.Getenv("PORT")
	if port == "" {
		port = os.Getenv("ROOM_SERVICE_PORT")
	}
	if idx := strings.LastIndex(port, ":"); idx != -1 {
		port = port[idx+1:]
	}
	if port == "" {
		port = "8081"
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	// OpenTelemetry Tracing via Tempo / Alloy
	telemetry.InitBusinessMetrics()
	shutdownTracer, err := telemetry.InitTracer(ctx, "room-service", cfg.OTelCollectorURL)
	if err == nil && shutdownTracer != nil {
		defer func() {
			sCtx, sCancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer sCancel()
			_ = shutdownTracer(sCtx)
		}()
	}

	// Redis Cache
	redisClient, err := redis.NewClient(ctx, cfg.RedisAddr, cfg.RedisPassword, 0)
	if err == nil && redisClient != nil {
		defer redisClient.Close()
	}

	// GORM v1.31.2 PostgreSQL initialization
	gormDB, err := postgres.NewGormDB(ctx, cfg)
	if err != nil {
		slog.Error("GORM database connection failed", "error", err)
	}
	if gormDB != nil {
		sqlDB, err := gormDB.DB()
		if err == nil && sqlDB != nil {
			defer sqlDB.Close()
		}
	}

	// Initialize GORM Room Repository (with Redis singleflight CacheManager) and Handler
	roomRepo := postgres.NewGormRoomRepository(gormDB).WithCache(redis.NewCacheManager(redisClient))
	roomHandler := handler.NewRoomHandler(roomRepo)

	// Gin v1.12.0 Engine with Tracing, Metrics and Slog Middleware
	ginEngine := infraHttp.NewGinRoomEngine(roomHandler)

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      ginEngine,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		slog.Info("Room Service listening with Gin v1.12.0", "port", port, "env", cfg.AppEnv)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("Room Service fatal error", "error", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	slog.Info("Shutting down Room Service gracefully...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	_ = server.Shutdown(shutdownCtx)
}

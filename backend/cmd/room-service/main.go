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
	"github.com/hotelpremium/backend/internal/infrastructure/http/handler"
	"github.com/hotelpremium/backend/internal/infrastructure/postgres"
	"github.com/hotelpremium/backend/internal/infrastructure/redis"
	"github.com/hotelpremium/backend/internal/infrastructure/telemetry"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/otel/trace"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	slog.Info("Starting Room Service (Microservice) on port 8081...")

	cfg := config.Load()
	port := os.Getenv("ROOM_SERVICE_PORT")
	if port == "" {
		port = "8081"
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	shutdownTracer, err := telemetry.InitTracer(ctx, "room-service", cfg.OTelCollectorURL)
	if err == nil && shutdownTracer != nil {
		defer func() {
			sCtx, sCancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer sCancel()
			_ = shutdownTracer(sCtx)
		}()
	}

	redisClient, err := redis.NewClient(ctx, cfg.RedisAddr, cfg.RedisPassword, 0)
	if err == nil && redisClient != nil {
		defer redisClient.Close()
	}

	dbPool, err := postgres.NewConnectionPool(ctx, cfg)
	if err != nil {
		slog.Error("Database connection initialization failed", "error", err)
	}
	if dbPool != nil {
		defer dbPool.Close()
	}

	roomRepo := postgres.NewRoomRepository(dbPool)
	roomHandler := handler.NewRoomHandler(roomRepo)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/health", handler.HealthCheck)
	mux.Handle("GET /metrics", promhttp.Handler())

	mux.HandleFunc("GET /api/v1/rooms", roomHandler.ListRooms)
	mux.HandleFunc("GET /api/v1/rooms/{id}", roomHandler.GetRoomByID)
	mux.HandleFunc("PATCH /api/v1/rooms/{id}/status", roomHandler.UpdateRoomStatus)
	mux.HandleFunc("PATCH /api/v1/rooms/{id}/price", roomHandler.UpdateRoomPrice)

	handlerChain := corsMiddleware(telemetryMiddleware("room-service", mux))

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      handlerChain,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		slog.Info("Room Service listening", "port", port, "env", cfg.AppEnv)
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

func telemetryMiddleware(serviceName string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if telemetry.Tracer == nil {
			next.ServeHTTP(w, r)
			return
		}
		ctx, span := telemetry.Tracer.Start(r.Context(), serviceName+": "+r.Method+" "+r.URL.Path,
			trace.WithSpanKind(trace.SpanKindServer),
		)
		defer span.End()
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, traceparent")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

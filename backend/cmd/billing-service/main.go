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
	"github.com/hotelpremium/backend/internal/infrastructure/telemetry"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/otel/trace"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	slog.Info("Starting Billing & POS Service (Microservice) on port 8083...")

	cfg := config.Load()
	port := os.Getenv("BILLING_SERVICE_PORT")
	if port == "" {
		port = "8083"
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	shutdownTracer, err := telemetry.InitTracer(ctx, "billing-service", cfg.OTelCollectorURL)
	if err == nil && shutdownTracer != nil {
		defer func() {
			sCtx, sCancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer sCancel()
			_ = shutdownTracer(sCtx)
		}()
	}

	dbPool, err := postgres.NewConnectionPool(ctx, cfg)
	if err != nil {
		slog.Error("Database connection initialization failed", "error", err)
	}
	if dbPool != nil {
		defer dbPool.Close()
	}

	billingRepo := postgres.NewBillingRepository(dbPool)
	billingHandler := handler.NewBillingHandler(billingRepo)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/health", handler.HealthCheck)
	mux.Handle("GET /metrics", promhttp.Handler())

	// Billing, Products & Charges
	mux.HandleFunc("GET /api/v1/billing/products", billingHandler.ListProducts)
	mux.HandleFunc("POST /api/v1/billing/charges", billingHandler.AddStayCharge)
	mux.HandleFunc("GET /api/v1/billing/stays/{id}/charges", billingHandler.ListStayCharges)
	mux.HandleFunc("POST /api/v1/billing/shifts/open", billingHandler.OpenCashShift)
	mux.HandleFunc("POST /api/v1/billing/shifts/{id}/close", billingHandler.CloseCashShift)

	handlerChain := corsMiddleware(telemetryMiddleware("billing-service", mux))

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      handlerChain,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		slog.Info("Billing Service listening", "port", port, "env", cfg.AppEnv)
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

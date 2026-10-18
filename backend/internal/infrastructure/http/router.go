package http

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/hotelpremium/backend/internal/infrastructure/http/handler"
	"github.com/hotelpremium/backend/internal/infrastructure/telemetry"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/otel/trace"
)

type RouterDependencies struct {
	RoomHandler *handler.RoomHandler
	StayHandler *handler.StayHandler
}

func NewRouter(deps RouterDependencies) http.Handler {
	mux := http.NewServeMux()

	// 1. System, Health & Prometheus Observability
	mux.HandleFunc("GET /api/v1/health", handler.HealthCheck)
	mux.Handle("GET /metrics", promhttp.Handler())

	// 2. Rooms API
	if deps.RoomHandler != nil {
		mux.HandleFunc("GET /api/v1/rooms", deps.RoomHandler.ListRooms)
		mux.HandleFunc("GET /api/v1/rooms/{id}", deps.RoomHandler.GetRoomByID)
		mux.HandleFunc("PATCH /api/v1/rooms/{id}/status", deps.RoomHandler.UpdateRoomStatus)
		mux.HandleFunc("PATCH /api/v1/rooms/{id}/price", deps.RoomHandler.UpdateRoomPrice)
	}

	// 3. Stays & Reservations API
	if deps.StayHandler != nil {
		mux.HandleFunc("GET /api/v1/stays", deps.StayHandler.ListStays)
		mux.HandleFunc("GET /api/v1/stays/{id}", deps.StayHandler.GetStayByID)
		mux.HandleFunc("POST /api/v1/stays", deps.StayHandler.CreateStay)
		mux.HandleFunc("POST /api/v1/stays/check-in", deps.StayHandler.CreateStay)
		mux.HandleFunc("PUT /api/v1/stays/{id}", deps.StayHandler.UpdateStay)
		mux.HandleFunc("PATCH /api/v1/stays/{id}/cancel", deps.StayHandler.CancelStay)
		mux.HandleFunc("DELETE /api/v1/stays/{id}", deps.StayHandler.CancelStay)
		mux.HandleFunc("POST /api/v1/stays/{id}/check-out", deps.StayHandler.CheckOutStay)
	}

	return corsMiddleware(telemetryMiddleware(loggingMiddleware(mux)))
}

func telemetryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if telemetry.Tracer == nil {
			next.ServeHTTP(w, r)
			return
		}

		ctx, span := telemetry.Tracer.Start(r.Context(), r.Method+" "+r.URL.Path,
			trace.WithSpanKind(trace.SpanKindServer),
		)
		defer span.End()

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)

		var traceID string
		span := trace.SpanFromContext(r.Context())
		if span.SpanContext().IsValid() {
			traceID = span.SpanContext().TraceID().String()
		}

		slog.Info("HTTP Request",
			"method", r.Method,
			"path", r.URL.Path,
			"duration_ms", time.Since(start).Milliseconds(),
			"remote_addr", r.RemoteAddr,
			"trace_id", traceID,
		)
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

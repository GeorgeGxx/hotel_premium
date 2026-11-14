package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

type HealthResponse struct {
	Status    string            `json:"status"`
	Version   string            `json:"version"`
	Timestamp time.Time         `json:"timestamp"`
	Checks    map[string]string `json:"checks,omitempty"`
}

var (
	readinessMu     sync.RWMutex
	readinessChecks = make(map[string]func(ctx context.Context) error)
)

// RegisterReadinessCheck registers a named infrastructure dependency check (e.g. "postgres", "redis")
func RegisterReadinessCheck(name string, fn func(ctx context.Context) error) {
	if fn == nil {
		return
	}
	readinessMu.Lock()
	defer readinessMu.Unlock()
	readinessChecks[name] = fn
}

// ResetReadinessChecks clears registered readiness checks (for testing)
func ResetReadinessChecks() {
	readinessMu.Lock()
	defer readinessMu.Unlock()
	readinessChecks = make(map[string]func(ctx context.Context) error)
}

// HealthCheck serves as the fast process liveness probe (/api/v1/health, /healthz)
func HealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(HealthResponse{
		Status:    "healthy",
		Version:   "1.0.0",
		Timestamp: time.Now().UTC(),
	})
}

// ReadinessCheck evaluates all registered mandatory dependencies with a bounded timeout (/api/v1/ready, /readyz)
func ReadinessCheck(w http.ResponseWriter, r *http.Request) {
	readinessMu.RLock()
	checks := make(map[string]func(ctx context.Context) error, len(readinessChecks))
	for k, v := range readinessChecks {
		checks[k] = v
	}
	readinessMu.RUnlock()

	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	results := make(map[string]string, len(checks))
	allHealthy := true

	for name, checkFn := range checks {
		if err := checkFn(ctx); err != nil {
			results[name] = "unhealthy: " + err.Error()
			allHealthy = false
		} else {
			results[name] = "healthy"
		}
	}

	w.Header().Set("Content-Type", "application/json")
	if !allHealthy {
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(HealthResponse{
			Status:    "not_ready",
			Version:   "1.0.0",
			Timestamp: time.Now().UTC(),
			Checks:    results,
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(HealthResponse{
		Status:    "ready",
		Version:   "1.0.0",
		Timestamp: time.Now().UTC(),
		Checks:    results,
	})
}

package http

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

type mockIdempotencyBackend struct {
	mu    sync.Mutex
	data  map[string]string
	locks map[string]bool
}

func newMockIdempotencyBackend() *mockIdempotencyBackend {
	return &mockIdempotencyBackend{
		data:  make(map[string]string),
		locks: make(map[string]bool),
	}
}

func (m *mockIdempotencyBackend) Get(ctx context.Context, key string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	val, ok := m.data[key]
	if !ok {
		return "", errors.New("key not found")
	}
	return val, nil
}

func (m *mockIdempotencyBackend) SetNX(ctx context.Context, key string, value interface{}, expiration time.Duration) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.locks[key] {
		return false, nil
	}
	m.locks[key] = true
	return true, nil
}

func (m *mockIdempotencyBackend) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.data[key] = string(value.([]byte))
	return nil
}

func (m *mockIdempotencyBackend) Del(ctx context.Context, keys ...string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, k := range keys {
		delete(m.locks, k)
	}
	return nil
}

func TestIdempotencyMiddleware_PreventsDuplicateExecutions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	backend := newMockIdempotencyBackend()
	r.Use(GinIdempotencyMiddleware(backend, 24*time.Hour))

	var executionCount int32

	r.POST("/api/v1/stays/book", func(c *gin.Context) {
		atomic.AddInt32(&executionCount, 1)
		c.JSON(http.StatusCreated, gin.H{
			"stay_id": "stay-abc-123",
			"status":  "CONFIRMED",
		})
	})

	idempotencyKey := "user-booking-req-999"

	// 1. First execution: executes handler and caches response
	req1 := httptest.NewRequest(http.MethodPost, "/api/v1/stays/book", strings.NewReader(`{}`))
	req1.Header.Set("Idempotency-Key", idempotencyKey)
	req1.Header.Set("Content-Type", "application/json")
	rec1 := httptest.NewRecorder()
	r.ServeHTTP(rec1, req1)

	if rec1.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created on first request, got %d", rec1.Code)
	}
	if atomic.LoadInt32(&executionCount) != 1 {
		t.Fatalf("expected handler to execute once, got %d", atomic.LoadInt32(&executionCount))
	}

	// 2. Duplicate execution with identical key: returns cached response without running handler
	req2 := httptest.NewRequest(http.MethodPost, "/api/v1/stays/book", strings.NewReader(`{}`))
	req2.Header.Set("Idempotency-Key", idempotencyKey)
	req2.Header.Set("Content-Type", "application/json")
	rec2 := httptest.NewRecorder()
	r.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created on duplicate request, got %d", rec2.Code)
	}
	if rec2.Header().Get("X-Cache-Lookup") != "IDEMPOTENT_HIT" {
		t.Fatalf("expected X-Cache-Lookup: IDEMPOTENT_HIT header")
	}

	if atomic.LoadInt32(&executionCount) != 1 {
		t.Fatalf("expected handler to remain at 1 execution, got %d", atomic.LoadInt32(&executionCount))
	}
}

func TestIdempotencyMiddleware_RejectsConcurrentDuplicateRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	backend := newMockIdempotencyBackend()
	backend.locks["idempotency:lock:concurrent-key"] = true // Simulate in-flight lock

	r.Use(GinIdempotencyMiddleware(backend, 24*time.Hour))

	r.POST("/api/v1/stays/book", func(c *gin.Context) {
		c.JSON(http.StatusCreated, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/stays/book", strings.NewReader(`{}`))
	req.Header.Set("Idempotency-Key", "concurrent-key")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict for concurrent in-flight request, got %d", rec.Code)
	}
}

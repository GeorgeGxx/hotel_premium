package http

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestIdempotencyMiddleware_PreventsDuplicateExecutions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	store := NewInMemoryIdempotencyStore()
	r.Use(store.Middleware())

	var executionCount int32

	r.POST("/api/v1/stays/book", func(c *gin.Context) {
		atomic.AddInt32(&executionCount, 1)
		c.JSON(http.StatusCreated, gin.H{
			"stay_id": "stay-abc-123",
			"status":  "CONFIRMED",
		})
	})

	idempotencyKey := "user-booking-req-999"

	// 1. First execution: should execute handler and return 201 Created
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

	// 2. Second execution with identical Idempotency-Key: MUST return cached 201 and NOT re-execute handler
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

	// Verify handler was NOT executed a second time
	if atomic.LoadInt32(&executionCount) != 1 {
		t.Fatalf("expected handler to remain at 1 execution, got %d (idempotency violated!)", atomic.LoadInt32(&executionCount))
	}
}

func TestIdempotencyMiddleware_RejectsConcurrentDuplicateRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	store := NewInMemoryIdempotencyStore()
	store.locks["concurrent-key"] = true // Simulate an in-flight lock

	r.Use(store.Middleware())

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

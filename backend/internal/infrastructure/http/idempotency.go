package http

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

type CachedResponse struct {
	StatusCode int               `json:"status_code"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
}

type responseRecorder struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (r *responseRecorder) Write(b []byte) (int, error) {
	r.body.Write(b)
	return r.ResponseWriter.Write(b)
}

func (r *responseRecorder) WriteString(s string) (int, error) {
	r.body.WriteString(s)
	return r.ResponseWriter.WriteString(s)
}

// GinIdempotencyMiddleware implements enterprise idempotency with Redis 8.8.1 distributed locking
// Following standard IETF / Stripe `Idempotency-Key` header specification
func GinIdempotencyMiddleware(client *redis.Client, ttl time.Duration) gin.HandlerFunc {
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}

	return func(c *gin.Context) {
		// Only apply to mutating HTTP methods
		if c.Request.Method != http.MethodPost && c.Request.Method != http.MethodPut && c.Request.Method != http.MethodPatch {
			c.Next()
			return
		}

		key := c.GetHeader("Idempotency-Key")
		if key == "" {
			key = c.GetHeader("X-Idempotency-Key")
		}

		// If no idempotency key provided, proceed normally
		if key == "" || client == nil {
			c.Next()
			return
		}

		ctx := c.Request.Context()
		cacheKey := "idempotency:response:" + key
		lockKey := "idempotency:lock:" + key

		// 1. Check if response is already cached from previous execution
		cachedVal, err := client.Get(ctx, cacheKey).Result()
		if err == nil && cachedVal != "" {
			var cached CachedResponse
			if err := json.Unmarshal([]byte(cachedVal), &cached); err == nil {
				slog.Info("Idempotent request served from Redis 8.8.1 cache",
					"idempotency_key", key,
					"status_code", cached.StatusCode,
				)

				for k, v := range cached.Headers {
					c.Writer.Header().Set(k, v)
				}
				c.Writer.Header().Set("X-Cache-Lookup", "IDEMPOTENT_HIT")
				c.Data(cached.StatusCode, c.Writer.Header().Get("Content-Type"), []byte(cached.Body))
				c.Abort()
				return
			}
		}

		// 2. Distributed Lock: Prevent concurrent duplicate requests from executing simultaneously
		// Uses atomic SETNX with 30s expiration
		acquired, err := client.SetNX(ctx, lockKey, "IN_FLIGHT", 30*time.Second).Result()
		if err != nil {
			slog.Warn("Failed to acquire idempotency lock", "key", key, "error", err)
			c.Next()
			return
		}

		if !acquired {
			// A concurrent request with the same key is currently running
			c.AbortWithStatusJSON(http.StatusConflict, gin.H{
				"error":           "concurrent request with identical Idempotency-Key is currently in flight",
				"idempotency_key": key,
			})
			return
		}

		// Ensure lock is released after request finishes
		defer func() {
			delCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			_ = client.Del(delCtx, lockKey).Err()
		}()

		// 3. Record response to cache it
		recorder := &responseRecorder{
			ResponseWriter: c.Writer,
			body:           &bytes.Buffer{},
		}
		c.Writer = recorder

		c.Next()

		// 4. Cache response on success (2xx status codes)
		statusCode := c.Writer.Status()
		if statusCode >= 200 && statusCode < 300 {
			headers := make(map[string]string)
			for k, v := range c.Writer.Header() {
				if len(v) > 0 {
					headers[k] = v[0]
				}
			}

			payload := CachedResponse{
				StatusCode: statusCode,
				Headers:    headers,
				Body:       recorder.body.String(),
			}

			if bytesData, err := json.Marshal(payload); err == nil {
				_ = client.Set(ctx, cacheKey, bytesData, ttl).Err()
			}
		}
	}
}

// In-Memory Idempotency store for testing without live Redis
type InMemoryIdempotencyStore struct {
	cache map[string]CachedResponse
	locks map[string]bool
}

func NewInMemoryIdempotencyStore() *InMemoryIdempotencyStore {
	return &InMemoryIdempotencyStore{
		cache: make(map[string]CachedResponse),
		locks: make(map[string]bool),
	}
}

func (s *InMemoryIdempotencyStore) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method != http.MethodPost && c.Request.Method != http.MethodPut && c.Request.Method != http.MethodPatch {
			c.Next()
			return
		}

		key := c.GetHeader("Idempotency-Key")
		if key == "" {
			c.Next()
			return
		}

		// 1. Check cached
		if cached, ok := s.cache[key]; ok {
			for k, v := range cached.Headers {
				c.Writer.Header().Set(k, v)
			}
			c.Writer.Header().Set("X-Cache-Lookup", "IDEMPOTENT_HIT")
			c.Data(cached.StatusCode, "application/json", []byte(cached.Body))
			c.Abort()
			return
		}

		// 2. Check lock
		if s.locks[key] {
			c.AbortWithStatusJSON(http.StatusConflict, gin.H{
				"error":           "concurrent request with identical Idempotency-Key is currently in flight",
				"idempotency_key": key,
			})
			return
		}

		s.locks[key] = true
		defer func() {
			delete(s.locks, key)
		}()

		recorder := &responseRecorder{
			ResponseWriter: c.Writer,
			body:           &bytes.Buffer{},
		}
		c.Writer = recorder

		c.Next()

		statusCode := c.Writer.Status()
		if statusCode >= 200 && statusCode < 300 {
			s.cache[key] = CachedResponse{
				StatusCode: statusCode,
				Body:       recorder.body.String(),
			}
		}
	}
}

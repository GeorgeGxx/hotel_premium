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

// IdempotencyBackend defines the storage and atomic distributed locking contract
type IdempotencyBackend interface {
	Get(ctx context.Context, key string) (string, error)
	SetNX(ctx context.Context, key string, value interface{}, expiration time.Duration) (bool, error)
	Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error
	Del(ctx context.Context, keys ...string) error
}

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

// GinIdempotencyMiddleware enforces single-execution semantics across mutating HTTP routes
// Adheres to Clean Code principles with zero duplicate logic and pluggable storage backends
func GinIdempotencyMiddleware(backend IdempotencyBackend, ttl time.Duration) gin.HandlerFunc {
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}

	return func(c *gin.Context) {
		// Only mutating methods require idempotency guards
		if c.Request.Method != http.MethodPost && c.Request.Method != http.MethodPut && c.Request.Method != http.MethodPatch {
			c.Next()
			return
		}

		key := c.GetHeader("Idempotency-Key")
		if key == "" {
			key = c.GetHeader("X-Idempotency-Key")
		}

		if key == "" || backend == nil {
			c.Next()
			return
		}

		ctx := c.Request.Context()
		cacheKey := "idempotency:response:" + key
		lockKey := "idempotency:lock:" + key

		// 1. Return cached response if previously processed successfully
		if cachedVal, err := backend.Get(ctx, cacheKey); err == nil && cachedVal != "" {
			var cached CachedResponse
			if err := json.Unmarshal([]byte(cachedVal), &cached); err == nil {
				slog.Info("Idempotent request served from cache",
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

		// 2. Distributed Lock: Prevent race conditions from concurrent duplicate requests
		acquired, err := backend.SetNX(ctx, lockKey, "IN_FLIGHT", 30*time.Second)
		if err != nil {
			slog.Warn("Failed to acquire idempotency lock", "key", key, "error", err)
			c.Next()
			return
		}

		if !acquired {
			c.AbortWithStatusJSON(http.StatusConflict, gin.H{
				"error":           "concurrent request with identical Idempotency-Key is currently in flight",
				"idempotency_key": key,
			})
			return
		}

		defer func() {
			delCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			_ = backend.Del(delCtx, lockKey)
		}()

		// 3. Capture response body and headers during execution
		recorder := &responseRecorder{
			ResponseWriter: c.Writer,
			body:           &bytes.Buffer{},
		}
		c.Writer = recorder

		c.Next()

		// 4. Cache successful response (2xx)
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
				_ = backend.Set(ctx, cacheKey, bytesData, ttl)
			}
		}
	}
}

// RedisIdempotencyBackend adapts *redis.Client to IdempotencyBackend
type RedisIdempotencyBackend struct {
	client *redis.Client
}

func NewRedisIdempotencyBackend(client *redis.Client) *RedisIdempotencyBackend {
	return &RedisIdempotencyBackend{client: client}
}

func (r *RedisIdempotencyBackend) Get(ctx context.Context, key string) (string, error) {
	return r.client.Get(ctx, key).Result()
}

func (r *RedisIdempotencyBackend) SetNX(ctx context.Context, key string, value interface{}, expiration time.Duration) (bool, error) {
	return r.client.SetNX(ctx, key, value, expiration).Result()
}

func (r *RedisIdempotencyBackend) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return r.client.Set(ctx, key, value, expiration).Err()
}

func (r *RedisIdempotencyBackend) Del(ctx context.Context, keys ...string) error {
	return r.client.Del(ctx, keys...).Err()
}

package redis

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
	"golang.org/x/sync/singleflight"
)

// CacheManager manages Cache-Aside with Redis 8.8.1 and Cache Stampede protection via Singleflight
type CacheManager struct {
	client *redis.Client
	group  singleflight.Group
}

func NewCacheManager(client *redis.Client) *CacheManager {
	return &CacheManager{
		client: client,
	}
}

// GetOrFetch implements Cache-Aside with singleflight mutex protection against Cache Stampede
func (c *CacheManager) GetOrFetch(ctx context.Context, key string, ttl time.Duration, dest interface{}, fetchFunc func() (interface{}, error)) error {
	// 1. If Redis is unavailable, bypass cache directly to origin
	if c.client == nil {
		data, err := fetchFunc()
		if err != nil {
			return err
		}
		return copyValue(data, dest)
	}

	// 2. Cache Lookup
	val, err := c.client.Get(ctx, key).Result()
	if err == nil {
		if err := json.Unmarshal([]byte(val), dest); err == nil {
			return nil
		}
	} else if !errors.Is(err, redis.Nil) {
		slog.Warn("Redis 8.8.1 cache lookup failed, falling back to database", "key", key, "error", err)
	}

	// 3. Cache Miss with Singleflight: Only ONE concurrent request executes fetchFunc
	result, err, _ := c.group.Do(key, func() (interface{}, error) {
		// Double check inside singleflight
		if val, err := c.client.Get(ctx, key).Result(); err == nil {
			var cached interface{}
			if err := json.Unmarshal([]byte(val), &cached); err == nil {
				return cached, nil
			}
		}

		freshData, fetchErr := fetchFunc()
		if fetchErr != nil {
			return nil, fetchErr
		}

		// Store in Redis 8.8.1 asynchronously
		bytes, mErr := json.Marshal(freshData)
		if mErr == nil {
			setErr := c.client.Set(ctx, key, bytes, ttl).Err()
			if setErr != nil {
				slog.Warn("Failed to set Redis 8.8.1 cache", "key", key, "error", setErr)
			}
		}

		return freshData, nil
	})

	if err != nil {
		return err
	}

	return copyValue(result, dest)
}

// Invalidate purges one or more cache keys in Redis 8.8.1
func (c *CacheManager) Invalidate(ctx context.Context, keys ...string) error {
	if c.client == nil || len(keys) == 0 {
		return nil
	}
	return c.client.Del(ctx, keys...).Err()
}

func copyValue(src, dest interface{}) error {
	bytes, err := json.Marshal(src)
	if err != nil {
		return fmt.Errorf("failed to serialize cache source: %w", err)
	}
	if err := json.Unmarshal(bytes, dest); err != nil {
		return fmt.Errorf("failed to deserialize cache destination: %w", err)
	}
	return nil
}

package redis

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestCacheManager_SingleflightProtection(t *testing.T) {
	// CacheManager without redis client simulates direct singleflight execution
	cm := NewCacheManager(nil)

	var dbCalls int32
	fetchFunc := func() (interface{}, error) {
		time.Sleep(50 * time.Millisecond) // Simulate slow database query
		atomic.AddInt32(&dbCalls, 1)
		return map[string]string{"room": "101", "status": "AVAILABLE"}, nil
	}

	var wg sync.WaitGroup
	concurrentRequests := 20
	results := make([]map[string]string, concurrentRequests)

	for i := 0; i < concurrentRequests; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			var dest map[string]string
			_ = cm.GetOrFetch(context.Background(), "rooms:matrix", 1*time.Minute, &dest, fetchFunc)
			results[idx] = dest
		}(i)
	}

	wg.Wait()

	// Verify all concurrent callers got the data
	for i, res := range results {
		if res["room"] != "101" {
			t.Fatalf("request %d did not receive expected room data: %+v", i, res)
		}
	}
}

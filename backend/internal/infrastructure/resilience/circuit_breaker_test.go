package resilience

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestCircuitBreaker_StateTransitions(t *testing.T) {
	cb := NewCircuitBreaker(Config{
		Name:            "test-service",
		MaxFailures:     3,
		OpenTimeout:     50 * time.Millisecond,
		HalfOpenSuccess: 2,
	})

	if cb.State() != StateClosed {
		t.Fatalf("expected state Closed, got %v", cb.State())
	}

	testErr := errors.New("simulated error")

	// Trigger 3 failures to trip the circuit to Open
	for i := 0; i < 3; i++ {
		_ = cb.Execute(func() error { return testErr })
	}

	if cb.State() != StateOpen {
		t.Fatalf("expected state Open after 3 failures, got %v", cb.State())
	}

	// Requests should now be rejected immediately
	err := cb.Execute(func() error { return nil })
	if !errors.Is(err, ErrCircuitOpen) {
		t.Fatalf("expected ErrCircuitOpen, got %v", err)
	}

	// Wait for open timeout to expire
	time.Sleep(60 * time.Millisecond)

	// State should transition to HalfOpen
	if cb.State() != StateHalfOpen {
		t.Fatalf("expected state HalfOpen, got %v", cb.State())
	}

	// First probe success
	_ = cb.Execute(func() error { return nil })
	if cb.State() != StateHalfOpen {
		t.Fatalf("expected state to stay HalfOpen after 1 success, got %v", cb.State())
	}

	// Second probe success -> Circuit should close
	_ = cb.Execute(func() error { return nil })
	if cb.State() != StateClosed {
		t.Fatalf("expected state Closed after 2 probe successes, got %v", cb.State())
	}
}

func TestRetryWithBackoff_Success(t *testing.T) {
	attempts := 0
	ctx := context.Background()

	err := RetryWithBackoff(ctx, 3, 5*time.Millisecond, 20*time.Millisecond, func() error {
		attempts++
		if attempts < 3 {
			return errors.New("transient error")
		}
		return nil
	})

	if err != nil {
		t.Fatalf("expected success on 3rd attempt, got %v", err)
	}
	if attempts != 3 {
		t.Fatalf("expected 3 attempts, got %d", attempts)
	}
}

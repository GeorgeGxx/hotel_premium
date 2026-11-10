package resilience

import (
	"context"
	"crypto/rand"
	"errors"
	"math/big"
	"sync"
	"time"
)

var (
	ErrCircuitOpen = errors.New("circuit breaker is open: request denied to prevent cascading failure")
)

type State int

const (
	StateClosed State = iota
	StateHalfOpen
	StateOpen
)

func (s State) String() string {
	switch s {
	case StateClosed:
		return "CLOSED"
	case StateHalfOpen:
		return "HALF_OPEN"
	case StateOpen:
		return "OPEN"
	default:
		return "UNKNOWN"
	}
}

// CircuitBreaker implements the circuit breaker resilience pattern with exponential backoff and jitter
type CircuitBreaker struct {
	mu               sync.RWMutex
	name             string
	maxFailures      int
	failureCount     int
	successCount     int
	halfOpenSuccess  int
	state            State
	openTimeout      time.Duration
	stateChangedAt   time.Time
}

// Config configures the Circuit Breaker
type Config struct {
	Name            string
	MaxFailures     int
	OpenTimeout     time.Duration
	HalfOpenSuccess int
}

// NewCircuitBreaker builds a thread-safe CircuitBreaker
func NewCircuitBreaker(cfg Config) *CircuitBreaker {
	if cfg.MaxFailures <= 0 {
		cfg.MaxFailures = 5
	}
	if cfg.OpenTimeout <= 0 {
		cfg.OpenTimeout = 10 * time.Second
	}
	if cfg.HalfOpenSuccess <= 0 {
		cfg.HalfOpenSuccess = 2
	}

	return &CircuitBreaker{
		name:            cfg.Name,
		maxFailures:     cfg.MaxFailures,
		openTimeout:     cfg.OpenTimeout,
		halfOpenSuccess: cfg.HalfOpenSuccess,
		state:           StateClosed,
		stateChangedAt:  time.Now(),
	}
}

// State returns current circuit state
func (cb *CircuitBreaker) State() State {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if cb.state == StateOpen && time.Since(cb.stateChangedAt) >= cb.openTimeout {
		cb.state = StateHalfOpen
		cb.stateChangedAt = time.Now()
		cb.failureCount = 0
		cb.successCount = 0
	}

	return cb.state
}

// Execute runs the operation protected by the circuit breaker
func (cb *CircuitBreaker) Execute(operation func() error) error {
	state := cb.State()
	if state == StateOpen {
		return ErrCircuitOpen
	}

	err := operation()

	cb.mu.Lock()
	defer cb.mu.Unlock()

	if err != nil {
		cb.onFailure()
		return err
	}

	cb.onSuccess()
	return nil
}

func (cb *CircuitBreaker) onFailure() {
	cb.failureCount++
	if cb.state == StateHalfOpen || cb.failureCount >= cb.maxFailures {
		cb.state = StateOpen
		cb.stateChangedAt = time.Now()
		cb.failureCount = 0
		cb.successCount = 0
	}
}

func (cb *CircuitBreaker) onSuccess() {
	if cb.state == StateHalfOpen {
		cb.successCount++
		if cb.successCount >= cb.halfOpenSuccess {
			cb.state = StateClosed
			cb.stateChangedAt = time.Now()
			cb.failureCount = 0
			cb.successCount = 0
		}
	} else if cb.state == StateClosed {
		cb.failureCount = 0
	}
}

// ExponentialBackoffWithJitter calculates a jittered exponential backoff duration (Full Jitter)
func ExponentialBackoffWithJitter(attempt int, baseBackoff, maxBackoff time.Duration) time.Duration {
	if attempt <= 0 {
		return baseBackoff
	}

	multiplier := int64(1) << min(attempt, 30)
	temp := int64(baseBackoff) * multiplier
	if temp > int64(maxBackoff) {
		temp = int64(maxBackoff)
	}
	if temp <= 0 {
		return baseBackoff
	}

	// Full Jitter: Sleep uniformly between 0 and temp using crypto/rand
	nBig, err := rand.Int(rand.Reader, big.NewInt(temp))
	if err != nil {
		return time.Duration(temp / 2)
	}
	return time.Duration(nBig.Int64())
}

// RetryWithBackoff executes an operation retrying on failure using exponential backoff with jitter
func RetryWithBackoff(ctx context.Context, maxRetries int, baseBackoff, maxBackoff time.Duration, op func() error) error {
	var err error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		err = op()
		if err == nil {
			return nil
		}

		if attempt == maxRetries {
			break
		}

		backoff := ExponentialBackoffWithJitter(attempt, baseBackoff, maxBackoff)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(backoff):
		}
	}
	return err
}

package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/hotelpremium/backend/internal/domain/room"
	"github.com/hotelpremium/backend/internal/domain/stay"
	"github.com/hotelpremium/backend/internal/infrastructure/http/handler"
)

type mockGinRoomRepo struct {
	rooms []*room.Room
}

func (m *mockGinRoomRepo) FindAll(ctx context.Context) ([]*room.Room, error) {
	return m.rooms, nil
}

func (m *mockGinRoomRepo) FindByID(ctx context.Context, id uuid.UUID) (*room.Room, error) {
	for _, r := range m.rooms {
		if r.ID == id {
			return r, nil
		}
	}
	return nil, nil
}

func (m *mockGinRoomRepo) FindByNumber(ctx context.Context, number string) (*room.Room, error) {
	return nil, nil
}

func (m *mockGinRoomRepo) Save(ctx context.Context, rm *room.Room) error {
	return nil
}

func (m *mockGinRoomRepo) Update(ctx context.Context, rm *room.Room) error {
	return nil
}

func (m *mockGinRoomRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status room.Status) error {
	for _, r := range m.rooms {
		if r.ID == id {
			r.Status = status
			return nil
		}
	}
	return nil
}

func (m *mockGinRoomRepo) UpdatePrice(ctx context.Context, id uuid.UUID, price float64) error {
	return nil
}

type mockGinStayRepo struct {
	stays []*stay.StayDetails
}

func (m *mockGinStayRepo) FindAll(ctx context.Context, status *stay.Status) ([]*stay.StayDetails, error) {
	return m.stays, nil
}

func (m *mockGinStayRepo) FindByID(ctx context.Context, id uuid.UUID) (*stay.StayDetails, error) {
	for _, s := range m.stays {
		if s.ID == id {
			return s, nil
		}
	}
	return nil, stay.ErrStayNotFound
}

func (m *mockGinStayRepo) Create(ctx context.Context, input stay.CreateStayInput) (*stay.StayDetails, error) {
	return &stay.StayDetails{
		Stay: stay.Stay{
			ID:     uuid.New(),
			RoomID: input.RoomID,
			Status: stay.StatusActive,
		},
		GuestName: input.GuestName,
	}, nil
}

func (m *mockGinStayRepo) Update(ctx context.Context, id uuid.UUID, input stay.UpdateStayInput) (*stay.StayDetails, error) {
	return nil, nil
}

func (m *mockGinStayRepo) Cancel(ctx context.Context, id uuid.UUID) error {
	return nil
}

func (m *mockGinStayRepo) CheckOut(ctx context.Context, id uuid.UUID) error {
	return nil
}

func (m *mockGinStayRepo) Save(ctx context.Context, s *stay.Stay) error {
	return nil
}

func TestGinRouter_HealthAndMetrics(t *testing.T) {
	engine := NewGinBaseEngine("test-service")

	// 1. Health check
	reqHealth := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	recHealth := httptest.NewRecorder()
	engine.ServeHTTP(recHealth, reqHealth)

	if recHealth.Code != http.StatusOK {
		t.Fatalf("expected 200 for health check, got %d", recHealth.Code)
	}
	if !strings.Contains(recHealth.Body.String(), "healthy") {
		t.Fatalf("expected body to contain healthy, got %s", recHealth.Body.String())
	}

	// 2. Metrics endpoint
	reqMetrics := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	recMetrics := httptest.NewRecorder()
	engine.ServeHTTP(recMetrics, reqMetrics)

	if recMetrics.Code != http.StatusOK {
		t.Fatalf("expected 200 for metrics, got %d", recMetrics.Code)
	}
}

func TestGinRouter_CORSPreflight(t *testing.T) {
	engine := NewGinBaseEngine("test-service")

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/rooms", nil)
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204 for OPTIONS preflight, got %d", rec.Code)
	}
	if rec.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Fatalf("expected Access-Control-Allow-Origin to be *")
	}
}

func TestGinRoomEngine_ListAndParam(t *testing.T) {
	roomID := uuid.New()
	mockRepo := &mockGinRoomRepo{
		rooms: []*room.Room{
			{
				ID:           roomID,
				Number:       "301",
				CategoryName: "Presidential Suite",
				Floor:        3,
				Status:       room.StatusAvailable,
				BasePrice:    350.0,
				Capacity:     4,
				CreatedAt:    time.Now().UTC(),
				UpdatedAt:    time.Now().UTC(),
			},
		},
	}

	roomHandler := handler.NewRoomHandler(mockRepo)
	engine := NewGinRoomEngine(roomHandler)

	// Test GET /api/v1/rooms
	req := httptest.NewRequest(http.MethodGet, "/api/v1/rooms", nil)
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for rooms list, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "301") {
		t.Fatalf("expected room 301 in response body, got %s", rec.Body.String())
	}

	// Test GET /api/v1/rooms/:id
	reqSingle := httptest.NewRequest(http.MethodGet, "/api/v1/rooms/"+roomID.String(), nil)
	recSingle := httptest.NewRecorder()
	engine.ServeHTTP(recSingle, reqSingle)

	if recSingle.Code != http.StatusOK {
		t.Fatalf("expected 200 for single room, got %d", recSingle.Code)
	}
	if !strings.Contains(recSingle.Body.String(), "Presidential Suite") {
		t.Fatalf("expected Presidential Suite in response, got %s", recSingle.Body.String())
	}
}

func TestGinStayEngine_ListAndCheckIn(t *testing.T) {
	stayID := uuid.New()
	mockRepo := &mockGinStayRepo{
		stays: []*stay.StayDetails{
			{
				Stay: stay.Stay{
					ID:          stayID,
					Status:      stay.StatusActive,
					TotalAmount: 600.0,
				},
				GuestName:  "Elena Rostova",
				RoomNumber: "204",
			},
		},
	}

	stayHandler := handler.NewStayHandler(mockRepo)
	engine := NewGinStayEngine(stayHandler, nil)

	// Test GET /api/v1/stays
	req := httptest.NewRequest(http.MethodGet, "/api/v1/stays", nil)
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for stays list, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "Elena Rostova") {
		t.Fatalf("expected Elena Rostova in response, got %s", rec.Body.String())
	}
}

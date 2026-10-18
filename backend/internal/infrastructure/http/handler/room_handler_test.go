package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/hotelpremium/backend/internal/domain/room"
	"github.com/hotelpremium/backend/internal/infrastructure/http/handler"
)

type mockRoomRepo struct {
	findAllFunc      func(ctx context.Context) ([]*room.Room, error)
	findByIDFunc     func(ctx context.Context, id uuid.UUID) (*room.Room, error)
	updateStatusFunc func(ctx context.Context, id uuid.UUID, status room.Status) error
}

func (m *mockRoomRepo) FindAll(ctx context.Context) ([]*room.Room, error) {
	if m.findAllFunc != nil {
		return m.findAllFunc(ctx)
	}
	return nil, nil
}

func (m *mockRoomRepo) FindByID(ctx context.Context, id uuid.UUID) (*room.Room, error) {
	if m.findByIDFunc != nil {
		return m.findByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *mockRoomRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status room.Status) error {
	if m.updateStatusFunc != nil {
		return m.updateStatusFunc(ctx, id, status)
	}
	return nil
}

func (m *mockRoomRepo) FindByNumber(ctx context.Context, number string) (*room.Room, error) {
	return nil, nil
}

func (m *mockRoomRepo) Save(ctx context.Context, r *room.Room) error {
	return nil
}

func (m *mockRoomRepo) Update(ctx context.Context, r *room.Room) error {
	return nil
}

func (m *mockRoomRepo) UpdatePrice(ctx context.Context, id uuid.UUID, price float64) error {
	return nil
}

func TestRoomHandler_ListRooms_Success(t *testing.T) {
	mockRepo := &mockRoomRepo{
		findAllFunc: func(ctx context.Context) ([]*room.Room, error) {
			return []*room.Room{
				{
					ID:        uuid.New(),
					Number:    "101",
					Status:    room.StatusAvailable,
					BasePrice: 65.0,
				},
				{
					ID:        uuid.New(),
					Number:    "102",
					Status:    room.StatusOccupied,
					BasePrice: 95.0,
				},
			}, nil
		},
	}

	h := handler.NewRoomHandler(mockRepo)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/rooms", nil)
	rr := httptest.NewRecorder()

	h.ListRooms(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got: %d", rr.Code)
	}

	var rooms []*room.Room
	if err := json.NewDecoder(rr.Body).Decode(&rooms); err != nil {
		t.Fatalf("failed to decode json: %v", err)
	}
	if len(rooms) != 2 {
		t.Errorf("expected 2 rooms, got: %d", len(rooms))
	}
}

func TestRoomHandler_GetRoomByID_NotFound(t *testing.T) {
	mockRepo := &mockRoomRepo{
		findByIDFunc: func(ctx context.Context, id uuid.UUID) (*room.Room, error) {
			return nil, nil
		},
	}

	h := handler.NewRoomHandler(mockRepo)
	testID := uuid.New().String()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/rooms/"+testID, nil)
	req.SetPathValue("id", testID)
	rr := httptest.NewRecorder()

	h.GetRoomByID(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Errorf("expected status 404, got: %d", rr.Code)
	}
}

func TestRoomHandler_UpdateRoomStatus_Success(t *testing.T) {
	mockRepo := &mockRoomRepo{
		updateStatusFunc: func(ctx context.Context, id uuid.UUID, status room.Status) error {
			return nil
		},
	}

	h := handler.NewRoomHandler(mockRepo)
	testID := uuid.New().String()
	body := map[string]string{"status": "DIRTY"}
	bodyBytes, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPatch, "/api/v1/rooms/"+testID+"/status", bytes.NewReader(bodyBytes))
	req.SetPathValue("id", testID)
	rr := httptest.NewRecorder()

	h.UpdateRoomStatus(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected status 200, got: %d", rr.Code)
	}
}

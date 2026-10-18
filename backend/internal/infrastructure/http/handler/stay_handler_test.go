package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/hotelpremium/backend/internal/domain/stay"
	"github.com/hotelpremium/backend/internal/infrastructure/http/handler"
)

type mockStayRepo struct {
	findAllFunc  func(ctx context.Context, status *stay.Status) ([]*stay.StayDetails, error)
	findByIDFunc func(ctx context.Context, id uuid.UUID) (*stay.StayDetails, error)
	createFunc   func(ctx context.Context, input stay.CreateStayInput) (*stay.StayDetails, error)
	updateFunc   func(ctx context.Context, id uuid.UUID, input stay.UpdateStayInput) (*stay.StayDetails, error)
	cancelFunc   func(ctx context.Context, id uuid.UUID) error
	checkOutFunc func(ctx context.Context, id uuid.UUID) error
}

func (m *mockStayRepo) FindAll(ctx context.Context, status *stay.Status) ([]*stay.StayDetails, error) {
	if m.findAllFunc != nil {
		return m.findAllFunc(ctx, status)
	}
	return nil, nil
}

func (m *mockStayRepo) FindByID(ctx context.Context, id uuid.UUID) (*stay.StayDetails, error) {
	if m.findByIDFunc != nil {
		return m.findByIDFunc(ctx, id)
	}
	return nil, stay.ErrStayNotFound
}

func (m *mockStayRepo) Create(ctx context.Context, input stay.CreateStayInput) (*stay.StayDetails, error) {
	if m.createFunc != nil {
		return m.createFunc(ctx, input)
	}
	return nil, nil
}

func (m *mockStayRepo) Update(ctx context.Context, id uuid.UUID, input stay.UpdateStayInput) (*stay.StayDetails, error) {
	if m.updateFunc != nil {
		return m.updateFunc(ctx, id, input)
	}
	return nil, nil
}

func (m *mockStayRepo) Cancel(ctx context.Context, id uuid.UUID) error {
	if m.cancelFunc != nil {
		return m.cancelFunc(ctx, id)
	}
	return nil
}

func (m *mockStayRepo) CheckOut(ctx context.Context, id uuid.UUID) error {
	if m.checkOutFunc != nil {
		return m.checkOutFunc(ctx, id)
	}
	return nil
}

func (m *mockStayRepo) Save(ctx context.Context, s *stay.Stay) error {
	return nil
}

func TestStayHandler_ListStays_Success(t *testing.T) {
	mockRepo := &mockStayRepo{
		findAllFunc: func(ctx context.Context, status *stay.Status) ([]*stay.StayDetails, error) {
			return []*stay.StayDetails{
				{
					Stay: stay.Stay{
						ID:     uuid.New(),
						Status: stay.StatusReserved,
					},
					GuestName:  "Test Guest",
					RoomNumber: "101",
				},
			}, nil
		},
	}

	h := handler.NewStayHandler(mockRepo)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/stays", nil)
	rr := httptest.NewRecorder()

	h.ListStays(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got: %d", rr.Code)
	}

	var stays []*stay.StayDetails
	if err := json.NewDecoder(rr.Body).Decode(&stays); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(stays) != 1 || stays[0].RoomNumber != "101" {
		t.Errorf("unexpected payload content: %+v", stays)
	}
}

func TestStayHandler_GetStayByID_NotFound(t *testing.T) {
	mockRepo := &mockStayRepo{
		findByIDFunc: func(ctx context.Context, id uuid.UUID) (*stay.StayDetails, error) {
			return nil, stay.ErrStayNotFound
		},
	}

	h := handler.NewStayHandler(mockRepo)
	testID := uuid.New().String()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/stays/"+testID, nil)
	req.SetPathValue("id", testID)
	rr := httptest.NewRecorder()

	h.GetStayByID(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Errorf("expected status 404, got: %d", rr.Code)
	}
}

func TestStayHandler_CreateStay_Conflict(t *testing.T) {
	mockRepo := &mockStayRepo{
		createFunc: func(ctx context.Context, input stay.CreateStayInput) (*stay.StayDetails, error) {
			return nil, stay.ErrRoomAlreadyBooked
		},
	}

	h := handler.NewStayHandler(mockRepo)
	body := handler.CreateStayRequest{
		RoomID:       uuid.New().String(),
		GuestName:    "Conflict Guest",
		CheckInDate:  time.Now().Format("2006-01-02"),
		CheckOutDate: time.Now().Add(48 * time.Hour).Format("2006-01-02"),
		TotalNights:  2,
		NightlyRate:  100.0,
	}
	bodyBytes, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/stays", bytes.NewReader(bodyBytes))
	rr := httptest.NewRecorder()

	h.CreateStay(rr, req)

	if rr.Code != http.StatusConflict {
		t.Errorf("expected status 409 Conflict, got: %d", rr.Code)
	}
}

func TestStayHandler_CancelStay_Success(t *testing.T) {
	mockRepo := &mockStayRepo{
		cancelFunc: func(ctx context.Context, id uuid.UUID) error {
			return nil
		},
	}

	h := handler.NewStayHandler(mockRepo)
	testID := uuid.New().String()
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/stays/"+testID, nil)
	req.SetPathValue("id", testID)
	rr := httptest.NewRecorder()

	h.CancelStay(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected status 200, got: %d", rr.Code)
	}
}

package saga

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/hotelpremium/backend/internal/domain/billing"
	"github.com/hotelpremium/backend/internal/domain/room"
	"github.com/hotelpremium/backend/internal/domain/stay"
)

type mockRoomRepo struct {
	targetRoom *room.Room
	lastStatus room.Status
}

func (m *mockRoomRepo) FindAll(ctx context.Context) ([]*room.Room, error) {
	return nil, nil
}

func (m *mockRoomRepo) FindByID(ctx context.Context, id uuid.UUID) (*room.Room, error) {
	return m.targetRoom, nil
}

func (m *mockRoomRepo) FindByNumber(ctx context.Context, number string) (*room.Room, error) {
	return nil, nil
}

func (m *mockRoomRepo) Save(ctx context.Context, rm *room.Room) error {
	return nil
}

func (m *mockRoomRepo) Update(ctx context.Context, rm *room.Room) error {
	return nil
}

func (m *mockRoomRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status room.Status) error {
	m.lastStatus = status
	if m.targetRoom != nil {
		m.targetRoom.Status = status
	}
	return nil
}

func (m *mockRoomRepo) UpdatePrice(ctx context.Context, id uuid.UUID, price float64) error {
	return nil
}

type mockStayRepo struct {
	shouldFail bool
}

func (m *mockStayRepo) FindAll(ctx context.Context, status *stay.Status) ([]*stay.StayDetails, error) {
	return nil, nil
}

func (m *mockStayRepo) FindByID(ctx context.Context, id uuid.UUID) (*stay.StayDetails, error) {
	return nil, nil
}

func (m *mockStayRepo) Create(ctx context.Context, input stay.CreateStayInput) (*stay.StayDetails, error) {
	if m.shouldFail {
		return nil, errors.New("database connection lost during stay persist")
	}
	return &stay.StayDetails{
		Stay: stay.Stay{
			ID:          uuid.New(),
			RoomID:      input.RoomID,
			Status:      stay.StatusActive,
			TotalAmount: input.NightlyRate * float64(input.TotalNights),
		},
		GuestName: input.GuestName,
	}, nil
}

func (m *mockStayRepo) Update(ctx context.Context, id uuid.UUID, input stay.UpdateStayInput) (*stay.StayDetails, error) {
	return nil, nil
}

func (m *mockStayRepo) Cancel(ctx context.Context, id uuid.UUID) error {
	return nil
}

func (m *mockStayRepo) CheckOut(ctx context.Context, id uuid.UUID) error {
	return nil
}

func (m *mockStayRepo) Save(ctx context.Context, s *stay.Stay) error {
	return nil
}

type mockBillingRepo struct {
	charges []*billing.StayCharge
}

func (m *mockBillingRepo) GetActiveShift(ctx context.Context, userID uuid.UUID) (*billing.CashShift, error) {
	return nil, nil
}

func (m *mockBillingRepo) OpenShift(ctx context.Context, userID uuid.UUID, openingAmount float64, notes string) (*billing.CashShift, error) {
	return nil, nil
}

func (m *mockBillingRepo) CloseShift(ctx context.Context, shiftID uuid.UUID, actualAmount float64, notes string) (*billing.CashShift, error) {
	return nil, nil
}

func (m *mockBillingRepo) ListProducts(ctx context.Context) ([]*billing.Product, error) {
	return nil, nil
}

func (m *mockBillingRepo) FindProductByID(ctx context.Context, id uuid.UUID) (*billing.Product, error) {
	return nil, nil
}

func (m *mockBillingRepo) CreateProduct(ctx context.Context, product *billing.Product) error {
	return nil
}

func (m *mockBillingRepo) ListChargesByStayID(ctx context.Context, stayID uuid.UUID) ([]*billing.StayCharge, error) {
	return m.charges, nil
}

func (m *mockBillingRepo) AddCharge(ctx context.Context, charge *billing.StayCharge) error {
	m.charges = append(m.charges, charge)
	return nil
}

func TestBookingSaga_SuccessFlow(t *testing.T) {
	roomID := uuid.New()
	roomRepo := &mockRoomRepo{
		targetRoom: &room.Room{
			ID:        roomID,
			Number:    "401",
			Status:    room.StatusAvailable,
			BasePrice: 200.0,
		},
	}
	stayRepo := &mockStayRepo{shouldFail: false}
	billingRepo := &mockBillingRepo{}

	broadcastEvents := make(map[string]interface{})
	broadcaster := func(event string, data interface{}) {
		broadcastEvents[event] = data
	}

	sagaOrchestrator := NewBookingSagaOrchestrator(roomRepo, stayRepo, billingRepo, nil, broadcaster)

	input := stay.CreateStayInput{
		RoomID:        roomID,
		GuestName:     "Sir Arthur Conan Doyle",
		CheckInDate:   time.Now().UTC(),
		CheckOutDate:  time.Now().UTC().Add(48 * time.Hour),
		TotalNights:   2,
		NightlyRate:   200.0,
		DepositAmount: 100.0,
	}

	result, err := sagaOrchestrator.Execute(context.Background(), input, "ADMIN")
	if err != nil {
		t.Fatalf("expected saga success, got err: %v", err)
	}

	if result.Status != StepCompleted {
		t.Fatalf("expected status COMPLETED, got %s", result.Status)
	}

	if roomRepo.lastStatus != room.StatusOccupied {
		t.Fatalf("expected room to be occupied, got %s", roomRepo.lastStatus)
	}

	if len(billingRepo.charges) != 1 {
		t.Fatalf("expected 1 deposit charge recorded, got %d", len(billingRepo.charges))
	}

	if broadcastEvents["stay_created"] == nil || broadcastEvents["room_updated"] == nil {
		t.Fatalf("expected SSE events stay_created and room_updated to be broadcasted")
	}
}

func TestBookingSaga_CompensatingTransaction_WhenStayFails(t *testing.T) {
	roomID := uuid.New()
	roomRepo := &mockRoomRepo{
		targetRoom: &room.Room{
			ID:        roomID,
			Number:    "402",
			Status:    room.StatusAvailable,
			BasePrice: 250.0,
		},
	}
	stayRepo := &mockStayRepo{shouldFail: true} // Trigger failure on stay creation
	billingRepo := &mockBillingRepo{}

	sagaOrchestrator := NewBookingSagaOrchestrator(roomRepo, stayRepo, billingRepo, nil, nil)

	input := stay.CreateStayInput{
		RoomID:        roomID,
		GuestName:     "Failed Booking Guest",
		CheckInDate:   time.Now().UTC(),
		CheckOutDate:  time.Now().UTC().Add(24 * time.Hour),
		TotalNights:   1,
		NightlyRate:   250.0,
		DepositAmount: 0.0,
	}

	result, err := sagaOrchestrator.Execute(context.Background(), input, "USER")
	if err == nil {
		t.Fatalf("expected error from failed stay creation, got nil")
	}

	if result.Status != StepCompensating {
		t.Fatalf("expected status COMPENSATING, got %s", result.Status)
	}

	// Verify compensating transaction: room released back to AVAILABLE!
	if roomRepo.lastStatus != room.StatusAvailable {
		t.Fatalf("expected compensating rollback to set room AVAILABLE, got %s", roomRepo.lastStatus)
	}
}

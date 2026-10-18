package stay_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	stayApp "github.com/hotelpremium/backend/internal/application/stay"
	roomDomain "github.com/hotelpremium/backend/internal/domain/room"
	stayDomain "github.com/hotelpremium/backend/internal/domain/stay"
)

type mockRoomRepository struct {
	rooms map[uuid.UUID]*roomDomain.Room
}

func (m *mockRoomRepository) FindAll(ctx context.Context) ([]*roomDomain.Room, error) {
	var list []*roomDomain.Room
	for _, r := range m.rooms {
		list = append(list, r)
	}
	return list, nil
}

func (m *mockRoomRepository) FindByID(ctx context.Context, id uuid.UUID) (*roomDomain.Room, error) {
	if r, ok := m.rooms[id]; ok {
		return r, nil
	}
	return nil, nil
}

func (m *mockRoomRepository) FindByNumber(ctx context.Context, number string) (*roomDomain.Room, error) {
	for _, r := range m.rooms {
		if r.Number == number {
			return r, nil
		}
	}
	return nil, nil
}

func (m *mockRoomRepository) Save(ctx context.Context, room *roomDomain.Room) error {
	m.rooms[room.ID] = room
	return nil
}

func (m *mockRoomRepository) Update(ctx context.Context, room *roomDomain.Room) error {
	m.rooms[room.ID] = room
	return nil
}

func (m *mockRoomRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status roomDomain.Status) error {
	if r, ok := m.rooms[id]; ok {
		r.Status = status
	}
	return nil
}

func (m *mockRoomRepository) UpdatePrice(ctx context.Context, id uuid.UUID, price float64) error {
	if r, ok := m.rooms[id]; ok {
		r.BasePrice = price
	}
	return nil
}

type mockStayRepository struct {
	stays map[uuid.UUID]*stayDomain.Stay
}

func (m *mockStayRepository) FindAll(ctx context.Context, status *stayDomain.Status) ([]*stayDomain.StayDetails, error) {
	var list []*stayDomain.StayDetails
	for _, s := range m.stays {
		list = append(list, &stayDomain.StayDetails{Stay: *s})
	}
	return list, nil
}

func (m *mockStayRepository) FindByID(ctx context.Context, id uuid.UUID) (*stayDomain.StayDetails, error) {
	if s, ok := m.stays[id]; ok {
		return &stayDomain.StayDetails{Stay: *s}, nil
	}
	return nil, nil
}

func (m *mockStayRepository) Create(ctx context.Context, input stayDomain.CreateStayInput) (*stayDomain.StayDetails, error) {
	st, err := stayDomain.NewReservation(input)
	if err != nil {
		return nil, err
	}
	m.stays[st.ID] = st
	return &stayDomain.StayDetails{Stay: *st}, nil
}

func (m *mockStayRepository) Update(ctx context.Context, id uuid.UUID, input stayDomain.UpdateStayInput) (*stayDomain.StayDetails, error) {
	if s, ok := m.stays[id]; ok {
		return &stayDomain.StayDetails{Stay: *s}, nil
	}
	return nil, stayDomain.ErrStayNotFound
}

func (m *mockStayRepository) Cancel(ctx context.Context, id uuid.UUID) error {
	if s, ok := m.stays[id]; ok {
		return s.Cancel()
	}
	return stayDomain.ErrStayNotFound
}

func (m *mockStayRepository) CheckOut(ctx context.Context, id uuid.UUID) error {
	if s, ok := m.stays[id]; ok {
		return s.CheckOut()
	}
	return stayDomain.ErrStayNotFound
}

func (m *mockStayRepository) Save(ctx context.Context, stay *stayDomain.Stay) error {
	m.stays[stay.ID] = stay
	return nil
}

func TestProcessCheckIn_Success(t *testing.T) {
	roomID := uuid.New()
	room := &roomDomain.Room{
		ID:        roomID,
		Number:    "101",
		Status:    roomDomain.StatusAvailable,
		BasePrice: 100.0,
		Capacity:  2,
	}

	roomRepo := &mockRoomRepository{rooms: map[uuid.UUID]*roomDomain.Room{roomID: room}}
	stayRepo := &mockStayRepository{stays: make(map[uuid.UUID]*stayDomain.Stay)}

	service := stayApp.NewService(roomRepo, stayRepo)

	req := stayApp.CheckInRequest{
		RoomID:      roomID,
		GuestID:     uuid.New(),
		UserID:      uuid.New(),
		CheckIn:     time.Now().UTC(),
		CheckOut:    time.Now().UTC().Add(48 * time.Hour),
		NightlyRate: 100.0,
		Nights:      2,
		Deposit:     200.0,
		Notes:       "VIP Guest Arrival",
	}

	res, err := service.ProcessCheckIn(context.Background(), req)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if res.Status != string(stayDomain.StatusActive) {
		t.Errorf("expected status %s, got: %s", stayDomain.StatusActive, res.Status)
	}

	if room.Status != roomDomain.StatusOccupied {
		t.Errorf("expected room status to be OCCUPIED, got: %s", room.Status)
	}
}

func TestProcessCheckOut_Success(t *testing.T) {
	roomID := uuid.New()
	stayID := uuid.New()

	room := &roomDomain.Room{
		ID:     roomID,
		Number: "101",
		Status: roomDomain.StatusOccupied,
	}

	stayEntity := &stayDomain.Stay{
		ID:     stayID,
		RoomID: roomID,
		Status: stayDomain.StatusActive,
	}

	roomRepo := &mockRoomRepository{rooms: map[uuid.UUID]*roomDomain.Room{roomID: room}}
	stayRepo := &mockStayRepository{stays: map[uuid.UUID]*stayDomain.Stay{stayID: stayEntity}}

	service := stayApp.NewService(roomRepo, stayRepo)

	err := service.ProcessCheckOut(context.Background(), stayID)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if stayEntity.Status != stayDomain.StatusCheckedOut {
		t.Errorf("expected stay status CHECKED_OUT, got: %s", stayEntity.Status)
	}

	if room.Status != roomDomain.StatusDirty {
		t.Errorf("expected room status DIRTY, got: %s", room.Status)
	}
}

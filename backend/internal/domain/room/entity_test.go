package room_test

import (
	"testing"

	"github.com/google/uuid"
	"github.com/hotelpremium/backend/internal/domain/room"
)

func TestNewRoom_Success(t *testing.T) {
	catID := uuid.New()
	r, err := room.NewRoom("301", catID, 3, 220.0, 4)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if r.Number != "301" {
		t.Errorf("expected number 301, got: %s", r.Number)
	}
	if r.Status != room.StatusAvailable {
		t.Errorf("expected initial status AVAILABLE, got: %s", r.Status)
	}
	if !r.CanBeOccupied() {
		t.Errorf("expected CanBeOccupied to be true for AVAILABLE room")
	}
}

func TestNewRoom_EmptyNumber(t *testing.T) {
	_, err := room.NewRoom("", uuid.New(), 1, 100.0, 2)
	if err != room.ErrInvalidRoomNumber {
		t.Errorf("expected ErrInvalidRoomNumber, got: %v", err)
	}
}

func TestRoom_MarkOccupied_Success(t *testing.T) {
	r, _ := room.NewRoom("101", uuid.New(), 1, 65.0, 1)

	if err := r.MarkOccupied(); err != nil {
		t.Fatalf("expected success, got: %v", err)
	}
	if r.Status != room.StatusOccupied {
		t.Errorf("expected status OCCUPIED, got: %s", r.Status)
	}
	if r.CanBeOccupied() {
		t.Errorf("expected CanBeOccupied to be false for OCCUPIED room")
	}
}

func TestRoom_MarkOccupied_WhenNotAvailable(t *testing.T) {
	r, _ := room.NewRoom("102", uuid.New(), 1, 95.0, 2)
	r.Status = room.StatusMaintenance

	err := r.MarkOccupied()
	if err != room.ErrRoomNotAvailable {
		t.Errorf("expected ErrRoomNotAvailable, got: %v", err)
	}
}

func TestRoom_HousekeepingLifecycle(t *testing.T) {
	r, _ := room.NewRoom("201", uuid.New(), 2, 95.0, 2)

	// Occupy -> Checkout -> Dirty
	_ = r.MarkOccupied()
	r.MarkDirty()
	if r.Status != room.StatusDirty {
		t.Errorf("expected status DIRTY, got: %s", r.Status)
	}

	// Dirty -> Cleaned -> Available
	r.MarkCleaned()
	if r.Status != room.StatusAvailable {
		t.Errorf("expected status AVAILABLE, got: %s", r.Status)
	}
	if !r.CanBeOccupied() {
		t.Errorf("expected CanBeOccupied to be true after cleaning")
	}
}

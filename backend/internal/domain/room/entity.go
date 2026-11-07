package room

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

type Status string

const (
	StatusAvailable   Status = "AVAILABLE"
	StatusOccupied    Status = "OCCUPIED"
	StatusDirty       Status = "DIRTY"
	StatusCleaning    Status = "CLEANING"
	StatusMaintenance Status = "MAINTENANCE"
	StatusBlocked     Status = "BLOCKED"
)

var (
	ErrInvalidRoomNumber = errors.New("room number cannot be empty")
	ErrRoomNotAvailable  = errors.New("room is not available for check-in")
)

type Room struct {
	ID           uuid.UUID `json:"id"`
	Number       string    `json:"number"`
	CategoryID   uuid.UUID `json:"category_id"`
	CategoryName string    `json:"category_name,omitempty"`
	Floor        int       `json:"floor"`
	Status       Status    `json:"status"`
	BasePrice    float64   `json:"base_price"`
	Capacity     int       `json:"capacity"`
	ImageURL     string    `json:"image_url,omitempty"`
	Notes        string    `json:"notes,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func NewRoom(number string, categoryID uuid.UUID, floor int, basePrice float64, capacity int) (*Room, error) {
	if number == "" {
		return nil, ErrInvalidRoomNumber
	}
	now := time.Now().UTC()
	return &Room{
		ID:         uuid.New(),
		Number:     number,
		CategoryID: categoryID,
		Floor:      floor,
		Status:     StatusAvailable,
		BasePrice:  basePrice,
		Capacity:   capacity,
		CreatedAt:  now,
		UpdatedAt:  now,
	}, nil
}

func (r *Room) CanBeOccupied() bool {
	return r.Status == StatusAvailable
}

func (r *Room) MarkOccupied() error {
	if !r.CanBeOccupied() {
		return ErrRoomNotAvailable
	}
	r.Status = StatusOccupied
	r.UpdatedAt = time.Now().UTC()
	return nil
}

func (r *Room) MarkDirty() {
	r.Status = StatusDirty
	r.UpdatedAt = time.Now().UTC()
}

func (r *Room) MarkCleaned() {
	r.Status = StatusAvailable
	r.UpdatedAt = time.Now().UTC()
}

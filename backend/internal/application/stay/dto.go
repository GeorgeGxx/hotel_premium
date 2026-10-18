package stay

import (
	"time"

	"github.com/google/uuid"
)

type CheckInRequest struct {
	RoomID      uuid.UUID  `json:"room_id"`
	GuestID     uuid.UUID  `json:"guest_id"`
	UserID      uuid.UUID  `json:"user_id"`
	CashShiftID *uuid.UUID `json:"cash_shift_id,omitempty"`
	CheckIn     time.Time  `json:"check_in"`
	CheckOut    time.Time  `json:"check_out"`
	NightlyRate float64    `json:"nightly_rate"`
	Nights      int        `json:"nights"`
	Deposit     float64    `json:"deposit"`
	Notes       string     `json:"notes"`
}

type CheckInResponse struct {
	StayID        uuid.UUID `json:"stay_id"`
	RoomID        uuid.UUID `json:"room_id"`
	TotalAmount   float64   `json:"total_amount"`
	DepositAmount float64   `json:"deposit_amount"`
	PaymentStatus string    `json:"payment_status"`
	Status        string    `json:"status"`
}

package stay

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

type Status string

const (
	StatusReserved   Status = "RESERVED"
	StatusActive     Status = "ACTIVE"
	StatusCheckedOut Status = "CHECKED_OUT"
	StatusCancelled  Status = "CANCELLED"
)

type PaymentStatus string

const (
	PaymentPending  PaymentStatus = "PENDING"
	PaymentPartial  PaymentStatus = "PARTIAL"
	PaymentPaid     PaymentStatus = "PAID"
	PaymentRefunded PaymentStatus = "REFUNDED"
)

var (
	ErrInvalidNights       = errors.New("total nights must be at least 1")
	ErrInvalidNightlyRate  = errors.New("nightly rate must be greater than zero")
	ErrStayAlreadyFinished = errors.New("stay is already checked out or cancelled")
	ErrInvalidDateRange    = errors.New("check-out date must be after check-in date")
	ErrStayNotFound        = errors.New("stay record not found")
	ErrRoomAlreadyBooked   = errors.New("room is already booked for the selected period")
)

type Stay struct {
	ID                 uuid.UUID     `json:"id"`
	RoomID             uuid.UUID     `json:"room_id"`
	PrimaryGuestID     uuid.UUID     `json:"primary_guest_id"`
	CashShiftID        *uuid.UUID    `json:"cash_shift_id,omitempty"`
	RegisteredByUserID uuid.UUID     `json:"registered_by_user_id"`
	CheckInDate        time.Time     `json:"check_in_date"`
	CheckOutDate       time.Time     `json:"check_out_date"`
	Status             Status        `json:"status"`
	NightlyRate        float64       `json:"nightly_rate"`
	TotalNights        int           `json:"total_nights"`
	DepositAmount      float64       `json:"deposit_amount"`
	TotalAmount        float64       `json:"total_amount"`
	PaymentStatus      PaymentStatus `json:"payment_status"`
	Notes              string        `json:"notes,omitempty"`
	CreatedAt          time.Time     `json:"created_at"`
	UpdatedAt          time.Time     `json:"updated_at"`
}

type StayDetails struct {
	Stay
	RoomNumber   string `json:"room_number"`
	CategoryName string `json:"category_name"`
	RoomFloor    int    `json:"room_floor"`
	GuestName    string `json:"guest_name"`
	GuestEmail   string `json:"guest_email"`
	GuestPhone   string `json:"guest_phone"`
	DocumentType string `json:"document_type"`
	DocumentNum  string `json:"document_number"`
}

type CreateStayInput struct {
	RoomID         uuid.UUID `json:"room_id"`
	GuestName      string    `json:"guest_name"`
	GuestEmail     string    `json:"guest_email"`
	GuestPhone     string    `json:"guest_phone"`
	DocumentType   string    `json:"document_type"`
	DocumentNumber string    `json:"document_number"`
	CheckInDate    time.Time `json:"check_in_date"`
	CheckOutDate   time.Time `json:"check_out_date"`
	TotalNights    int       `json:"total_nights"`
	NightlyRate    float64   `json:"nightly_rate"`
	DepositAmount  float64   `json:"deposit_amount"`
	Notes          string    `json:"notes"`
	Status         Status    `json:"status"`
	RegisteredByID uuid.UUID `json:"registered_by_id"`
}

type UpdateStayInput struct {
	CheckInDate   *time.Time `json:"check_in_date,omitempty"`
	CheckOutDate  *time.Time `json:"check_out_date,omitempty"`
	TotalNights   *int       `json:"total_nights,omitempty"`
	NightlyRate   *float64   `json:"nightly_rate,omitempty"`
	DepositAmount *float64   `json:"deposit_amount,omitempty"`
	Notes         *string    `json:"notes,omitempty"`
}

func NewReservation(input CreateStayInput) (*Stay, error) {
	if input.TotalNights < 1 {
		return nil, ErrInvalidNights
	}
	if input.NightlyRate <= 0 {
		return nil, ErrInvalidNightlyRate
	}
	if !input.CheckOutDate.After(input.CheckInDate) {
		return nil, ErrInvalidDateRange
	}

	total := float64(input.TotalNights) * input.NightlyRate
	pStatus := PaymentPending
	if input.DepositAmount >= total {
		pStatus = PaymentPaid
	} else if input.DepositAmount > 0 {
		pStatus = PaymentPartial
	}

	now := time.Now().UTC()
	initStatus := input.Status
	if initStatus == "" {
		initStatus = StatusReserved
	}

	return &Stay{
		ID:                 uuid.New(),
		RoomID:             input.RoomID,
		PrimaryGuestID:     uuid.Nil,
		RegisteredByUserID: input.RegisteredByID,
		CheckInDate:        input.CheckInDate,
		CheckOutDate:       input.CheckOutDate,
		Status:             initStatus,
		NightlyRate:        input.NightlyRate,
		TotalNights:        input.TotalNights,
		DepositAmount:      input.DepositAmount,
		TotalAmount:        total,
		PaymentStatus:      pStatus,
		Notes:              input.Notes,
		CreatedAt:          now,
		UpdatedAt:          now,
	}, nil
}

func NewCheckIn(
	roomID, guestID, userID uuid.UUID,
	cashShiftID *uuid.UUID,
	checkIn, checkOut time.Time,
	nightlyRate float64,
	nights int,
	deposit float64,
	notes string,
) (*Stay, error) {
	if nights < 1 {
		return nil, ErrInvalidNights
	}
	if nightlyRate <= 0 {
		return nil, ErrInvalidNightlyRate
	}

	total := float64(nights) * nightlyRate
	pStatus := PaymentPending
	if deposit >= total {
		pStatus = PaymentPaid
	} else if deposit > 0 {
		pStatus = PaymentPartial
	}

	now := time.Now().UTC()
	return &Stay{
		ID:                 uuid.New(),
		RoomID:             roomID,
		PrimaryGuestID:     guestID,
		CashShiftID:        cashShiftID,
		RegisteredByUserID: userID,
		CheckInDate:        checkIn,
		CheckOutDate:       checkOut,
		Status:             StatusActive,
		NightlyRate:        nightlyRate,
		TotalNights:        nights,
		DepositAmount:      deposit,
		TotalAmount:        total,
		PaymentStatus:      pStatus,
		Notes:              notes,
		CreatedAt:          now,
		UpdatedAt:          now,
	}, nil
}

func (s *Stay) Cancel() error {
	if s.Status == StatusCheckedOut || s.Status == StatusCancelled {
		return ErrStayAlreadyFinished
	}
	s.Status = StatusCancelled
	s.UpdatedAt = time.Now().UTC()
	return nil
}

func (s *Stay) CheckOut() error {
	if s.Status != StatusActive && s.Status != StatusReserved {
		return ErrStayAlreadyFinished
	}
	s.Status = StatusCheckedOut
	s.UpdatedAt = time.Now().UTC()
	return nil
}

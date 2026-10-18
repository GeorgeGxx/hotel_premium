package stay_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/hotelpremium/backend/internal/domain/stay"
)

func TestNewReservation_Valid(t *testing.T) {
	now := time.Now().UTC()
	roomID := uuid.New()
	userID := uuid.New()

	input := stay.CreateStayInput{
		RoomID:         roomID,
		GuestName:      "Lord Kelvin",
		GuestEmail:     "kelvin@thermo.org",
		CheckInDate:    now.Add(24 * time.Hour),
		CheckOutDate:   now.Add(72 * time.Hour),
		TotalNights:    2,
		NightlyRate:    120.0,
		DepositAmount:  120.0,
		Status:         stay.StatusReserved,
		RegisteredByID: userID,
	}

	res, err := stay.NewReservation(input)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if res.ID == uuid.Nil {
		t.Errorf("expected generated UUID, got nil")
	}
	if res.TotalAmount != 240.0 {
		t.Errorf("expected total amount 240.0, got: %f", res.TotalAmount)
	}
	if res.PaymentStatus != stay.PaymentPartial {
		t.Errorf("expected payment status PARTIAL, got: %s", res.PaymentStatus)
	}
	if res.Status != stay.StatusReserved {
		t.Errorf("expected status RESERVED, got: %s", res.Status)
	}
}

func TestNewReservation_InvalidNights(t *testing.T) {
	now := time.Now().UTC()
	input := stay.CreateStayInput{
		RoomID:       uuid.New(),
		CheckInDate:  now,
		CheckOutDate: now.Add(24 * time.Hour),
		TotalNights:  0,
		NightlyRate:  100.0,
	}

	_, err := stay.NewReservation(input)
	if err != stay.ErrInvalidNights {
		t.Errorf("expected ErrInvalidNights, got: %v", err)
	}
}

func TestNewReservation_InvalidNightlyRate(t *testing.T) {
	now := time.Now().UTC()
	input := stay.CreateStayInput{
		RoomID:       uuid.New(),
		CheckInDate:  now,
		CheckOutDate: now.Add(24 * time.Hour),
		TotalNights:  1,
		NightlyRate:  -10.0,
	}

	_, err := stay.NewReservation(input)
	if err != stay.ErrInvalidNightlyRate {
		t.Errorf("expected ErrInvalidNightlyRate, got: %v", err)
	}
}

func TestNewReservation_InvalidDateRange(t *testing.T) {
	now := time.Now().UTC()
	input := stay.CreateStayInput{
		RoomID:       uuid.New(),
		CheckInDate:  now.Add(48 * time.Hour),
		CheckOutDate: now.Add(24 * time.Hour),
		TotalNights:  1,
		NightlyRate:  100.0,
	}

	_, err := stay.NewReservation(input)
	if err != stay.ErrInvalidDateRange {
		t.Errorf("expected ErrInvalidDateRange, got: %v", err)
	}
}

func TestNewReservation_PaymentStatusRules(t *testing.T) {
	now := time.Now().UTC()
	baseInput := stay.CreateStayInput{
		RoomID:       uuid.New(),
		CheckInDate:  now,
		CheckOutDate: now.Add(48 * time.Hour),
		TotalNights:  2,
		NightlyRate:  100.0,
	}

	// 1. Zero Deposit -> PENDING
	baseInput.DepositAmount = 0
	r1, err := stay.NewReservation(baseInput)
	if err != nil || r1.PaymentStatus != stay.PaymentPending {
		t.Errorf("expected PENDING, got: %v", r1.PaymentStatus)
	}

	// 2. Exact Deposit -> PAID
	baseInput.DepositAmount = 200.0
	r2, err := stay.NewReservation(baseInput)
	if err != nil || r2.PaymentStatus != stay.PaymentPaid {
		t.Errorf("expected PAID, got: %v", r2.PaymentStatus)
	}

	// 3. Overpayment -> PAID
	baseInput.DepositAmount = 250.0
	r3, err := stay.NewReservation(baseInput)
	if err != nil || r3.PaymentStatus != stay.PaymentPaid {
		t.Errorf("expected PAID, got: %v", r3.PaymentStatus)
	}
}

func TestStay_Cancel_Transitions(t *testing.T) {
	now := time.Now().UTC()
	s := &stay.Stay{
		ID:          uuid.New(),
		Status:      stay.StatusReserved,
		CheckInDate: now,
	}

	// 1. Valid cancel
	if err := s.Cancel(); err != nil {
		t.Fatalf("expected cancel success, got: %v", err)
	}
	if s.Status != stay.StatusCancelled {
		t.Errorf("expected status CANCELLED, got: %s", s.Status)
	}

	// 2. Redundant cancel on already cancelled stay
	if err := s.Cancel(); err != stay.ErrStayAlreadyFinished {
		t.Errorf("expected ErrStayAlreadyFinished, got: %v", err)
	}
}

func TestStay_CheckOut_Transitions(t *testing.T) {
	s := &stay.Stay{
		ID:     uuid.New(),
		Status: stay.StatusActive,
	}

	// 1. Check out active stay
	if err := s.CheckOut(); err != nil {
		t.Fatalf("expected checkout success, got: %v", err)
	}
	if s.Status != stay.StatusCheckedOut {
		t.Errorf("expected status CHECKED_OUT, got: %s", s.Status)
	}

	// 2. Checkout already finished stay
	if err := s.CheckOut(); err != stay.ErrStayAlreadyFinished {
		t.Errorf("expected ErrStayAlreadyFinished, got: %v", err)
	}
}

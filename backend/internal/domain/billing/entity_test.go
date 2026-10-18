package billing_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/hotelpremium/backend/internal/domain/billing"
)

func TestStayCharge_Calculation(t *testing.T) {
	charge := billing.StayCharge{
		ID:          uuid.New(),
		StayID:      uuid.New(),
		Description: "Champagne Room Service",
		Quantity:    2,
		UnitPrice:   75.50,
		TotalPrice:  2 * 75.50,
		CreatedAt:   time.Now().UTC(),
	}

	if charge.TotalPrice != 151.0 {
		t.Errorf("expected total price 151.0, got: %f", charge.TotalPrice)
	}
	if charge.Quantity <= 0 {
		t.Errorf("expected positive quantity")
	}
}

func TestCashShift_OpenStatus(t *testing.T) {
	shift := billing.CashShift{
		ID:            uuid.New(),
		UserID:        uuid.New(),
		OpenedAt:      time.Now().UTC(),
		OpeningAmount: 500.0,
		Status:        billing.ShiftOpen,
	}

	if shift.Status != billing.ShiftOpen {
		t.Errorf("expected shift OPEN, got: %s", shift.Status)
	}
	if shift.OpeningAmount < 0 {
		t.Errorf("opening amount cannot be negative")
	}
}

func TestProduct_Availability(t *testing.T) {
	prod := billing.Product{
		ID:           uuid.New(),
		SKU:          "MINIBAR-001",
		Name:         "Sparkling Water San Pellegrino",
		SalePrice:    6.0,
		CurrentStock: 24,
		IsActive:     true,
	}

	if !prod.IsActive {
		t.Errorf("expected product to be active")
	}
	if prod.CurrentStock <= 0 {
		t.Errorf("expected stock in inventory")
	}
}

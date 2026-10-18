package billing

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrShiftAlreadyClosed = errors.New("cash shift is already closed")
	ErrInvalidAmount      = errors.New("amount must be non-negative")
	ErrProductNotFound    = errors.New("product not found")
	ErrInsufficientStock  = errors.New("insufficient product inventory")
)

type ShiftStatus string

const (
	ShiftOpen   ShiftStatus = "OPEN"
	ShiftClosed ShiftStatus = "CLOSED"
)

type CashShift struct {
	ID                  uuid.UUID   `json:"id"`
	UserID              uuid.UUID   `json:"user_id"`
	OpenedAt            time.Time   `json:"opened_at"`
	ClosedAt            *time.Time  `json:"closed_at,omitempty"`
	OpeningAmount       float64     `json:"opening_amount"`
	ClosingAmount       *float64    `json:"closing_amount,omitempty"`
	ActualClosingAmount *float64    `json:"actual_closing_amount,omitempty"`
	Difference          *float64    `json:"difference,omitempty"`
	Status              ShiftStatus `json:"status"`
	Notes               string      `json:"notes,omitempty"`
	CreatedAt           time.Time   `json:"created_at"`
}

type Product struct {
	ID           uuid.UUID `json:"id"`
	SKU          string    `json:"sku"`
	Name         string    `json:"name"`
	Description  string    `json:"description,omitempty"`
	CostPrice    float64   `json:"cost_price"`
	SalePrice    float64   `json:"sale_price"`
	CurrentStock int       `json:"current_stock"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
}

type StayCharge struct {
	ID          uuid.UUID  `json:"id"`
	StayID      uuid.UUID  `json:"stay_id"`
	ProductID   *uuid.UUID `json:"product_id,omitempty"`
	Description string     `json:"description"`
	Quantity    int        `json:"quantity"`
	UnitPrice   float64    `json:"unit_price"`
	TotalPrice  float64    `json:"total_price"`
	CreatedAt   time.Time  `json:"created_at"`
}

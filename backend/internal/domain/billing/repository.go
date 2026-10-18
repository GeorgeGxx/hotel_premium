package billing

import (
	"context"

	"github.com/google/uuid"
)

type Repository interface {
	// Cash Shifts
	GetActiveShift(ctx context.Context, userID uuid.UUID) (*CashShift, error)
	OpenShift(ctx context.Context, userID uuid.UUID, openingAmount float64, notes string) (*CashShift, error)
	CloseShift(ctx context.Context, shiftID uuid.UUID, actualAmount float64, notes string) (*CashShift, error)

	// Products
	ListProducts(ctx context.Context) ([]*Product, error)
	FindProductByID(ctx context.Context, id uuid.UUID) (*Product, error)
	CreateProduct(ctx context.Context, product *Product) error

	// Stay Folio Charges
	ListChargesByStayID(ctx context.Context, stayID uuid.UUID) ([]*StayCharge, error)
	AddCharge(ctx context.Context, charge *StayCharge) error
}

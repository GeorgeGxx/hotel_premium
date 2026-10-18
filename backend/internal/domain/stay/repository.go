package stay

import (
	"context"

	"github.com/google/uuid"
)

type Repository interface {
	FindAll(ctx context.Context, status *Status) ([]*StayDetails, error)
	FindByID(ctx context.Context, id uuid.UUID) (*StayDetails, error)
	Create(ctx context.Context, input CreateStayInput) (*StayDetails, error)
	Update(ctx context.Context, id uuid.UUID, input UpdateStayInput) (*StayDetails, error)
	Cancel(ctx context.Context, id uuid.UUID) error
	CheckOut(ctx context.Context, id uuid.UUID) error
	Save(ctx context.Context, stay *Stay) error
}

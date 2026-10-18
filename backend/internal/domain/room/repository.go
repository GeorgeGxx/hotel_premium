package room

import (
	"context"

	"github.com/google/uuid"
)

type Repository interface {
	FindAll(ctx context.Context) ([]*Room, error)
	FindByID(ctx context.Context, id uuid.UUID) (*Room, error)
	FindByNumber(ctx context.Context, number string) (*Room, error)
	Save(ctx context.Context, room *Room) error
	Update(ctx context.Context, room *Room) error
	UpdateStatus(ctx context.Context, id uuid.UUID, status Status) error
	UpdatePrice(ctx context.Context, id uuid.UUID, price float64) error
}

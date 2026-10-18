package stay

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	roomDomain "github.com/hotelpremium/backend/internal/domain/room"
	stayDomain "github.com/hotelpremium/backend/internal/domain/stay"
)

var (
	ErrRoomNotFound = errors.New("room not found")
	ErrStayNotFound = errors.New("stay record not found")
)

type Service struct {
	roomRepo roomDomain.Repository
	stayRepo stayDomain.Repository
}

func NewService(roomRepo roomDomain.Repository, stayRepo stayDomain.Repository) *Service {
	return &Service{
		roomRepo: roomRepo,
		stayRepo: stayRepo,
	}
}

func (s *Service) ProcessCheckIn(ctx context.Context, req CheckInRequest) (*CheckInResponse, error) {
	room, err := s.roomRepo.FindByID(ctx, req.RoomID)
	if err != nil || room == nil {
		return nil, ErrRoomNotFound
	}

	if err := room.MarkOccupied(); err != nil {
		return nil, fmt.Errorf("cannot check in: %w", err)
	}

	stayEntity, err := stayDomain.NewCheckIn(
		req.RoomID,
		req.GuestID,
		req.UserID,
		req.CashShiftID,
		req.CheckIn,
		req.CheckOut,
		req.NightlyRate,
		req.Nights,
		req.Deposit,
		req.Notes,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create stay entity: %w", err)
	}

	if err := s.stayRepo.Save(ctx, stayEntity); err != nil {
		return nil, fmt.Errorf("failed to persist stay: %w", err)
	}

	if err := s.roomRepo.Update(ctx, room); err != nil {
		return nil, fmt.Errorf("failed to update room state: %w", err)
	}

	return &CheckInResponse{
		StayID:        stayEntity.ID,
		RoomID:        stayEntity.RoomID,
		TotalAmount:   stayEntity.TotalAmount,
		DepositAmount: stayEntity.DepositAmount,
		PaymentStatus: string(stayEntity.PaymentStatus),
		Status:        string(stayEntity.Status),
	}, nil
}

func (s *Service) ProcessCheckOut(ctx context.Context, stayID uuid.UUID) error {
	stayEntity, err := s.stayRepo.FindByID(ctx, stayID)
	if err != nil || stayEntity == nil {
		return ErrStayNotFound
	}

	if err := stayEntity.CheckOut(); err != nil {
		return err
	}

	room, err := s.roomRepo.FindByID(ctx, stayEntity.RoomID)
	if err != nil || room == nil {
		return ErrRoomNotFound
	}

	room.MarkDirty()

	if err := s.stayRepo.CheckOut(ctx, stayID); err != nil {
		return err
	}

	return s.roomRepo.Update(ctx, room)
}

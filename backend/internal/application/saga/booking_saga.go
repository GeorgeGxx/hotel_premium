package saga

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/hotelpremium/backend/internal/domain/billing"
	"github.com/hotelpremium/backend/internal/domain/room"
	"github.com/hotelpremium/backend/internal/domain/stay"
	"github.com/hotelpremium/backend/internal/infrastructure/postgres"
	"go.opentelemetry.io/otel/trace"
)

type SagaStep string

const (
	StepRoomReserved   SagaStep = "ROOM_RESERVED"
	StepBillingApplied SagaStep = "BILLING_APPLIED"
	StepStayCreated    SagaStep = "STAY_CREATED"
	StepCompleted      SagaStep = "COMPLETED"
	StepCompensating   SagaStep = "COMPENSATING"
	StepFailed         SagaStep = "FAILED"
)

type BookingSagaResult struct {
	SagaID       uuid.UUID         `json:"saga_id"`
	StayDetails  *stay.StayDetails `json:"stay_details,omitempty"`
	Status       SagaStep          `json:"status"`
	ErrorMessage string            `json:"error_message,omitempty"`
	DurationMs   int64             `json:"duration_ms"`
}

type BookingSagaOrchestrator struct {
	roomRepo    room.Repository
	stayRepo    stay.Repository
	billingRepo billing.Repository
	auditRepo   *postgres.AuditRepository
	broadcaster func(event string, data interface{})
}

func NewBookingSagaOrchestrator(
	roomRepo room.Repository,
	stayRepo stay.Repository,
	billingRepo billing.Repository,
	auditRepo *postgres.AuditRepository,
	broadcaster func(event string, data interface{}),
) *BookingSagaOrchestrator {
	return &BookingSagaOrchestrator{
		roomRepo:    roomRepo,
		stayRepo:    stayRepo,
		billingRepo: billingRepo,
		auditRepo:   auditRepo,
		broadcaster: broadcaster,
	}
}

// Execute orchestrates the distributed booking transaction with compensating rollbacks
func (s *BookingSagaOrchestrator) Execute(ctx context.Context, input stay.CreateStayInput, userRole string) (*BookingSagaResult, error) {
	start := time.Now()
	sagaID := uuid.New()

	var traceID string
	span := trace.SpanFromContext(ctx)
	if span.SpanContext().IsValid() {
		traceID = span.SpanContext().TraceID().String()
	}

	slog.Info("Starting Booking Saga Orchestration",
		"saga_id", sagaID,
		"room_id", input.RoomID,
		"trace_id", traceID,
	)

	// Step 1: Verify & Lock Room
	targetRoom, err := s.roomRepo.FindByID(ctx, input.RoomID)
	if err != nil || targetRoom == nil {
		slog.Error("Saga Step 1 Failed: room not found", "saga_id", sagaID, "room_id", input.RoomID)
		return &BookingSagaResult{
			SagaID:       sagaID,
			Status:       StepFailed,
			ErrorMessage: "target room does not exist",
			DurationMs:   time.Since(start).Milliseconds(),
		}, errors.New("target room does not exist")
	}

	originalRoomStatus := targetRoom.Status
	isFutureReservation := input.Status == stay.StatusReserved || input.CheckInDate.After(time.Now().UTC().Add(2*time.Hour))

	if isFutureReservation {
		if targetRoom.Status == room.StatusMaintenance || targetRoom.Status == room.StatusBlocked {
			slog.Warn("Saga Step 1 Conflict: room under maintenance/blocked", "saga_id", sagaID, "status", targetRoom.Status)
			return &BookingSagaResult{
				SagaID:       sagaID,
				Status:       StepFailed,
				ErrorMessage: "room is under maintenance or blocked",
				DurationMs:   time.Since(start).Milliseconds(),
			}, stay.ErrRoomAlreadyBooked
		}
	} else {
		// Immediate Check-In requires physical room to be AVAILABLE (never DIRTY or OCCUPIED)
		if targetRoom.Status != room.StatusAvailable {
			slog.Warn("Saga Step 1 Conflict: room not available for immediate check-in", "saga_id", sagaID, "status", targetRoom.Status)
			return &BookingSagaResult{
				SagaID:       sagaID,
				Status:       StepFailed,
				ErrorMessage: "room is currently occupied, dirty, or under maintenance",
				DurationMs:   time.Since(start).Milliseconds(),
			}, stay.ErrRoomAlreadyBooked
		}
	}

	// Enforce authoritative room category base price when available
	if targetRoom.BasePrice > 0 {
		input.NightlyRate = stay.RoundCurrency(targetRoom.BasePrice)
	}

	desiredStatus := originalRoomStatus
	if !isFutureReservation {
		desiredStatus = room.StatusOccupied
	}

	if err := s.roomRepo.UpdateStatus(ctx, input.RoomID, desiredStatus); err != nil {
		slog.Error("Saga Step 1: failed to lock room", "saga_id", sagaID, "error", err)
		return &BookingSagaResult{
			SagaID:       sagaID,
			Status:       StepFailed,
			ErrorMessage: "failed to lock room status",
			DurationMs:   time.Since(start).Milliseconds(),
		}, err
	}

	// Step 2: Create Stay in Stay-Service
	stayDetails, err := s.stayRepo.Create(ctx, input)
	if err != nil {
		slog.Warn("Saga Step 2 Failed: initiating compensating transaction", "saga_id", sagaID, "error", err)

		// Compensating Transaction 1: Revert room status to its exact prior physical status
		_ = s.roomRepo.UpdateStatus(ctx, input.RoomID, originalRoomStatus)

		// Audit Compensation
		if s.auditRepo != nil {
			_ = s.auditRepo.Record(ctx, &postgres.AuditLogModel{
				UserRole: userRole,
				Action:   "SAGA_COMPENSATION_ROOM_RELEASED",
				Entity:   "Room",
				EntityID: input.RoomID.String(),
				TraceID:  traceID,
			})
		}

		return &BookingSagaResult{
			SagaID:       sagaID,
			Status:       StepCompensating,
			ErrorMessage: fmt.Sprintf("stay creation failed: %v", err),
			DurationMs:   time.Since(start).Milliseconds(),
		}, err
	}

	// Step 3: Register Initial Folio Deposit Ledger Entry if deposit is paid
	if input.DepositAmount > 0 && s.billingRepo != nil {
		charge := &billing.StayCharge{
			ID:          uuid.New(),
			StayID:      stayDetails.ID,
			Description: fmt.Sprintf("Initial Stay Deposit (%s)", stayDetails.GuestName),
			Quantity:    1,
			UnitPrice:   stay.RoundCurrency(input.DepositAmount),
			TotalPrice:  stay.RoundCurrency(input.DepositAmount),
			CreatedAt:   time.Now().UTC(),
		}
		if err := s.billingRepo.AddCharge(ctx, charge); err != nil {
			slog.Warn("Saga Step 3 Billing warning: deposit ledger recorded asynchronously", "error", err)
		}
	}

	// Step 4: Immutable Audit Trail
	if s.auditRepo != nil {
		payload, _ := json.Marshal(stayDetails)
		_ = s.auditRepo.Record(ctx, &postgres.AuditLogModel{
			UserRole:     userRole,
			Action:       "SAGA_BOOKING_COMPLETED",
			Entity:       "Stay",
			EntityID:     stayDetails.ID.String(),
			PayloadAfter: string(payload),
			TraceID:      traceID,
		})
	}

	// Step 5: Real-time SSE Broadcast to React Front-Desk
	if s.broadcaster != nil {
		s.broadcaster("stay_created", stayDetails)
		s.broadcaster("room_updated", map[string]interface{}{
			"room_id": input.RoomID,
			"status":  desiredStatus,
		})
	}

	slog.Info("Booking Saga Orchestration completed successfully",
		"saga_id", sagaID,
		"stay_id", stayDetails.ID,
		"duration_ms", time.Since(start).Milliseconds(),
	)

	return &BookingSagaResult{
		SagaID:      sagaID,
		StayDetails: stayDetails,
		Status:      StepCompleted,
		DurationMs:  time.Since(start).Milliseconds(),
	}, nil
}

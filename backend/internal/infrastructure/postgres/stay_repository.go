package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/hotelpremium/backend/internal/domain/stay"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel/trace"
)

type StayRepository struct {
	pool *pgxpool.Pool
}

func NewStayRepository(pool *pgxpool.Pool) *StayRepository {
	return &StayRepository{pool: pool}
}

func (r *StayRepository) FindAll(ctx context.Context, status *stay.Status) ([]*stay.StayDetails, error) {
	query := `
		SELECT 
			s.id, s.room_id, s.primary_guest_id, s.cash_shift_id, s.registered_by_user_id,
			lower(s.stay_period) as check_in_date,
			upper(s.stay_period) as check_out_date,
			s.status, s.nightly_rate, s.total_nights, s.deposit_amount, s.total_amount,
			s.payment_status, COALESCE(s.notes, ''), s.created_at, s.updated_at,
			r.number as room_number, c.name as category_name, r.floor as room_floor,
			g.full_name as guest_name, COALESCE(g.email, '') as guest_email, COALESCE(g.phone, '') as guest_phone,
			g.document_type, g.document_number
		FROM stays s
		JOIN rooms r ON s.room_id = r.id
		JOIN room_categories c ON r.category_id = c.id
		JOIN guests g ON s.primary_guest_id = g.id
	`
	var args []interface{}
	if status != nil && *status != "" {
		query += " WHERE s.status = $1"
		args = append(args, string(*status))
	}
	query += " ORDER BY s.created_at DESC"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query stays: %w", err)
	}
	defer rows.Close()

	var result []*stay.StayDetails
	for rows.Next() {
		var d stay.StayDetails
		err := rows.Scan(
			&d.ID, &d.RoomID, &d.PrimaryGuestID, &d.CashShiftID, &d.RegisteredByUserID,
			&d.CheckInDate, &d.CheckOutDate,
			&d.Status, &d.NightlyRate, &d.TotalNights, &d.DepositAmount, &d.TotalAmount,
			&d.PaymentStatus, &d.Notes, &d.CreatedAt, &d.UpdatedAt,
			&d.RoomNumber, &d.CategoryName, &d.RoomFloor,
			&d.GuestName, &d.GuestEmail, &d.GuestPhone,
			&d.DocumentType, &d.DocumentNum,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan stay row: %w", err)
		}
		result = append(result, &d)
	}

	return result, nil
}

func (r *StayRepository) FindByID(ctx context.Context, id uuid.UUID) (*stay.StayDetails, error) {
	query := `
		SELECT 
			s.id, s.room_id, s.primary_guest_id, s.cash_shift_id, s.registered_by_user_id,
			lower(s.stay_period) as check_in_date,
			upper(s.stay_period) as check_out_date,
			s.status, s.nightly_rate, s.total_nights, s.deposit_amount, s.total_amount,
			s.payment_status, COALESCE(s.notes, ''), s.created_at, s.updated_at,
			r.number as room_number, c.name as category_name, r.floor as room_floor,
			g.full_name as guest_name, COALESCE(g.email, '') as guest_email, COALESCE(g.phone, '') as guest_phone,
			g.document_type, g.document_number
		FROM stays s
		JOIN rooms r ON s.room_id = r.id
		JOIN room_categories c ON r.category_id = c.id
		JOIN guests g ON s.primary_guest_id = g.id
		WHERE s.id = $1
	`
	var d stay.StayDetails
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&d.ID, &d.RoomID, &d.PrimaryGuestID, &d.CashShiftID, &d.RegisteredByUserID,
		&d.CheckInDate, &d.CheckOutDate,
		&d.Status, &d.NightlyRate, &d.TotalNights, &d.DepositAmount, &d.TotalAmount,
		&d.PaymentStatus, &d.Notes, &d.CreatedAt, &d.UpdatedAt,
		&d.RoomNumber, &d.CategoryName, &d.RoomFloor,
		&d.GuestName, &d.GuestEmail, &d.GuestPhone,
		&d.DocumentType, &d.DocumentNum,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, stay.ErrStayNotFound
		}
		return nil, err
	}
	return &d, nil
}

func (r *StayRepository) Create(ctx context.Context, input stay.CreateStayInput) (*stay.StayDetails, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Get or create registered_by_user_id
	var userID uuid.UUID
	if input.RegisteredByID != uuid.Nil {
		userID = input.RegisteredByID
	} else {
		err = tx.QueryRow(ctx, "SELECT id FROM users LIMIT 1").Scan(&userID)
		if err != nil {
			// Fallback: create default user if none exists
			userID = uuid.New()
			_, _ = tx.Exec(ctx, `
				INSERT INTO users (id, username, email, password_hash, first_name, last_name, role)
				VALUES ($1, 'system', 'system@hotelpremium.com', 'none', 'System', 'Admin', 'ADMIN')
				ON CONFLICT DO NOTHING
			`, userID)
		}
	}

	// 2. Upsert guest
	var guestID uuid.UUID
	docType := input.DocumentType
	if docType == "" {
		docType = "PASSPORT"
	}
	docNum := input.DocumentNumber
	if docNum == "" {
		docNum = "DOC-" + uuid.New().String()[:8]
	}

	guestQuery := `
		INSERT INTO guests (id, document_type, document_number, full_name, email, phone, stay_count)
		VALUES ($1, $2, $3, $4, $5, $6, 1)
		ON CONFLICT (document_number) 
		DO UPDATE SET 
			full_name = EXCLUDED.full_name,
			email = COALESCE(EXCLUDED.email, guests.email),
			phone = COALESCE(EXCLUDED.phone, guests.phone),
			stay_count = guests.stay_count + 1,
			updated_at = CURRENT_TIMESTAMP
		RETURNING id
	`
	newGuestID := uuid.New()
	err = tx.QueryRow(ctx, guestQuery, newGuestID, docType, docNum, input.GuestName, input.GuestEmail, input.GuestPhone).Scan(&guestID)
	if err != nil {
		return nil, fmt.Errorf("failed to upsert guest: %w", err)
	}

	// 3. Create Stay domain model
	newStay, err := stay.NewReservation(input)
	if err != nil {
		return nil, err
	}
	newStay.PrimaryGuestID = guestID
	newStay.RegisteredByUserID = userID

	// 4. Insert into stays table using PostgreSQL tstzrange
	stayInsertQuery := `
		INSERT INTO stays (
			id, room_id, primary_guest_id, registered_by_user_id,
			stay_period, status, nightly_rate, total_nights, deposit_amount,
			total_amount, payment_status, notes, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4,
			tstzrange($5, $6, '[)'), $7, $8, $9, $10,
			$11, $12, $13, $14, $15
		)
	`
	_, err = tx.Exec(ctx, stayInsertQuery,
		newStay.ID, newStay.RoomID, newStay.PrimaryGuestID, newStay.RegisteredByUserID,
		newStay.CheckInDate, newStay.CheckOutDate, string(newStay.Status), newStay.NightlyRate, newStay.TotalNights, newStay.DepositAmount,
		newStay.TotalAmount, string(newStay.PaymentStatus), newStay.Notes, newStay.CreatedAt, newStay.UpdatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			if pgErr.Code == "23P01" || strings.Contains(pgErr.Message, "exclusion") || strings.Contains(pgErr.ConstraintName, "stays_room_period_exclusion") {
				return nil, stay.ErrRoomAlreadyBooked
			}
		}
		return nil, fmt.Errorf("failed to insert stay: %w", err)
	}

	// 5. Update room status if status is ACTIVE
	if newStay.Status == stay.StatusActive {
		_, err = tx.Exec(ctx, "UPDATE rooms SET status = 'OCCUPIED', updated_at = CURRENT_TIMESTAMP WHERE id = $1", newStay.RoomID)
		if err != nil {
			return nil, fmt.Errorf("failed to update room status: %w", err)
		}
	}

	// 6. Transactional Outbox Event for Kafka 7.8.0
	var traceID string
	span := trace.SpanFromContext(ctx)
	if span.SpanContext().IsValid() {
		traceID = span.SpanContext().TraceID().String()
	}

	payloadMap := map[string]interface{}{
		"stay_id":         newStay.ID,
		"room_id":         newStay.RoomID,
		"guest_id":        guestID,
		"guest_name":      input.GuestName,
		"guest_email":     input.GuestEmail,
		"check_in":        newStay.CheckInDate,
		"check_out":       newStay.CheckOutDate,
		"status":          newStay.Status,
		"total_amount":    newStay.TotalAmount,
		"deposit_amount":  newStay.DepositAmount,
		"payment_status":  newStay.PaymentStatus,
	}
	payloadBytes, _ := json.Marshal(payloadMap)

	_, err = tx.Exec(ctx, `
		INSERT INTO stay_outbox_events (id, aggregate_type, aggregate_id, event_type, payload, trace_id, status)
		VALUES ($1, 'Stay', $2, 'StayCreated', $3, $4, 'PENDING')
	`, uuid.New(), newStay.ID, payloadBytes, traceID)
	if err != nil {
		// Log but do not fail if outbox table hasn't been migrated yet
		// to allow graceful fallback
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit reservation transaction: %w", err)
	}

	return r.FindByID(ctx, newStay.ID)
}

func (r *StayRepository) Update(ctx context.Context, id uuid.UUID, input stay.UpdateStayInput) (*stay.StayDetails, error) {
	current, err := r.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	checkIn := current.CheckInDate
	if input.CheckInDate != nil {
		checkIn = *input.CheckInDate
	}
	checkOut := current.CheckOutDate
	if input.CheckOutDate != nil {
		checkOut = *input.CheckOutDate
	}
	if !checkOut.After(checkIn) {
		return nil, stay.ErrInvalidDateRange
	}

	nights := current.TotalNights
	if input.TotalNights != nil && *input.TotalNights >= 1 {
		nights = *input.TotalNights
	}
	rate := current.NightlyRate
	if input.NightlyRate != nil && *input.NightlyRate > 0 {
		rate = *input.NightlyRate
	}
	deposit := current.DepositAmount
	if input.DepositAmount != nil && *input.DepositAmount >= 0 {
		deposit = *input.DepositAmount
	}
	notes := current.Notes
	if input.Notes != nil {
		notes = *input.Notes
	}

	total := float64(nights) * rate
	pStatus := stay.PaymentPending
	if deposit >= total {
		pStatus = stay.PaymentPaid
	} else if deposit > 0 {
		pStatus = stay.PaymentPartial
	}

	query := `
		UPDATE stays
		SET 
			stay_period = tstzrange($1, $2, '[)'),
			total_nights = $3,
			nightly_rate = $4,
			deposit_amount = $5,
			total_amount = $6,
			payment_status = $7,
			notes = $8,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $9
	`
	_, err = r.pool.Exec(ctx, query,
		checkIn, checkOut, nights, rate, deposit, total, string(pStatus), notes, id,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			if pgErr.Code == "23P01" || strings.Contains(pgErr.Message, "exclusion") {
				return nil, stay.ErrRoomAlreadyBooked
			}
		}
		return nil, fmt.Errorf("failed to update stay: %w", err)
	}

	// Insert Outbox Event
	payloadBytes, _ := json.Marshal(map[string]interface{}{
		"stay_id":      id,
		"check_in":     checkIn,
		"check_out":    checkOut,
		"total_nights": nights,
		"total_amount": total,
	})
	_, _ = r.pool.Exec(ctx, `
		INSERT INTO stay_outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status)
		VALUES ($1, 'Stay', $2, 'StayUpdated', $3, 'PENDING')
	`, uuid.New(), id, payloadBytes)

	return r.FindByID(ctx, id)
}

func (r *StayRepository) Cancel(ctx context.Context, id uuid.UUID) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var roomID uuid.UUID
	var status string
	err = tx.QueryRow(ctx, "SELECT room_id, status FROM stays WHERE id = $1", id).Scan(&roomID, &status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return stay.ErrStayNotFound
		}
		return err
	}

	if status == string(stay.StatusCheckedOut) || status == string(stay.StatusCancelled) {
		return stay.ErrStayAlreadyFinished
	}

	_, err = tx.Exec(ctx, `
		UPDATE stays 
		SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP 
		WHERE id = $1
	`, id)
	if err != nil {
		return err
	}

	// If room was occupied by this stay, make it available
	if status == string(stay.StatusActive) {
		_, _ = tx.Exec(ctx, "UPDATE rooms SET status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP WHERE id = $1", roomID)
	}

	// Outbox event
	payloadBytes, _ := json.Marshal(map[string]interface{}{
		"stay_id": id,
		"room_id": roomID,
		"status":  "CANCELLED",
	})
	_, _ = tx.Exec(ctx, `
		INSERT INTO stay_outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status)
		VALUES ($1, 'Stay', $2, 'StayCancelled', $3, 'PENDING')
	`, uuid.New(), id, payloadBytes)

	return tx.Commit(ctx)
}

func (r *StayRepository) CheckOut(ctx context.Context, id uuid.UUID) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var roomID uuid.UUID
	var status string
	err = tx.QueryRow(ctx, "SELECT room_id, status FROM stays WHERE id = $1", id).Scan(&roomID, &status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return stay.ErrStayNotFound
		}
		return err
	}

	if status == string(stay.StatusCheckedOut) || status == string(stay.StatusCancelled) {
		return stay.ErrStayAlreadyFinished
	}

	_, err = tx.Exec(ctx, `
		UPDATE stays 
		SET status = 'CHECKED_OUT', updated_at = CURRENT_TIMESTAMP 
		WHERE id = $1
	`, id)
	if err != nil {
		return err
	}

	// Mark room as DIRTY for Housekeeping workflow
	_, _ = tx.Exec(ctx, "UPDATE rooms SET status = 'DIRTY', updated_at = CURRENT_TIMESTAMP WHERE id = $1", roomID)

	// Outbox event
	payloadBytes, _ := json.Marshal(map[string]interface{}{
		"stay_id": id,
		"room_id": roomID,
		"status":  "CHECKED_OUT",
	})
	_, _ = tx.Exec(ctx, `
		INSERT INTO stay_outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status)
		VALUES ($1, 'Stay', $2, 'GuestCheckedOut', $3, 'PENDING')
	`, uuid.New(), id, payloadBytes)

	return tx.Commit(ctx)
}

func (r *StayRepository) Save(ctx context.Context, s *stay.Stay) error {
	query := `
		INSERT INTO stays (
			id, room_id, primary_guest_id, cash_shift_id, registered_by_user_id,
			stay_period, status, nightly_rate, total_nights, deposit_amount,
			total_amount, payment_status, notes, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5,
			tstzrange($6, $7, '[)'), $8, $9, $10, $11,
			$12, $13, $14, $15, $16
		)
	`
	_, err := r.pool.Exec(ctx, query,
		s.ID, s.RoomID, s.PrimaryGuestID, s.CashShiftID, s.RegisteredByUserID,
		s.CheckInDate, s.CheckOutDate, string(s.Status), s.NightlyRate, s.TotalNights, s.DepositAmount,
		s.TotalAmount, string(s.PaymentStatus), s.Notes, s.CreatedAt, s.UpdatedAt,
	)
	return err
}

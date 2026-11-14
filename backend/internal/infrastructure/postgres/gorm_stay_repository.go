package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/hotelpremium/backend/internal/domain/stay"
	"go.opentelemetry.io/otel/trace"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type GormStayRepository struct {
	db *gorm.DB
}

func NewGormStayRepository(db *gorm.DB) *GormStayRepository {
	return &GormStayRepository{db: db}
}

func maskEmailPII(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) != 2 || len(parts[0]) == 0 {
		return "***"
	}
	if len(parts[0]) <= 2 {
		return parts[0][:1] + "***@" + parts[1]
	}
	return parts[0][:2] + "***@" + parts[1]
}

func (r *GormStayRepository) FindAll(ctx context.Context, status *stay.Status) ([]*stay.StayDetails, error) {
	if r.db == nil {
		return nil, errors.New("database connection unavailable")
	}

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
	var rows *gorm.DB
	if status != nil && *status != "" {
		query += " WHERE s.status = ? ORDER BY s.created_at DESC"
		rows = r.db.WithContext(ctx).Raw(query, string(*status))
	} else {
		query += " ORDER BY s.created_at DESC"
		rows = r.db.WithContext(ctx).Raw(query)
	}

	sqlRows, err := rows.Rows()
	if err != nil {
		return nil, fmt.Errorf("gorm: failed to query stays: %w", err)
	}
	defer sqlRows.Close()

	result := make([]*stay.StayDetails, 0)
	for sqlRows.Next() {
		var d stay.StayDetails
		err := sqlRows.Scan(
			&d.ID, &d.RoomID, &d.PrimaryGuestID, &d.CashShiftID, &d.RegisteredByUserID,
			&d.CheckInDate, &d.CheckOutDate,
			&d.Status, &d.NightlyRate, &d.TotalNights, &d.DepositAmount, &d.TotalAmount,
			&d.PaymentStatus, &d.Notes, &d.CreatedAt, &d.UpdatedAt,
			&d.RoomNumber, &d.CategoryName, &d.RoomFloor,
			&d.GuestName, &d.GuestEmail, &d.GuestPhone,
			&d.DocumentType, &d.DocumentNum,
		)
		if err != nil {
			return nil, fmt.Errorf("gorm: failed to scan stay row: %w", err)
		}
		result = append(result, &d)
	}

	return result, nil
}

func (r *GormStayRepository) FindByID(ctx context.Context, id uuid.UUID) (*stay.StayDetails, error) {
	if r.db == nil {
		return nil, errors.New("database connection unavailable")
	}

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
		WHERE s.id = ?
	`
	var d stay.StayDetails
	row := r.db.WithContext(ctx).Raw(query, id).Row()
	err := row.Scan(
		&d.ID, &d.RoomID, &d.PrimaryGuestID, &d.CashShiftID, &d.RegisteredByUserID,
		&d.CheckInDate, &d.CheckOutDate,
		&d.Status, &d.NightlyRate, &d.TotalNights, &d.DepositAmount, &d.TotalAmount,
		&d.PaymentStatus, &d.Notes, &d.CreatedAt, &d.UpdatedAt,
		&d.RoomNumber, &d.CategoryName, &d.RoomFloor,
		&d.GuestName, &d.GuestEmail, &d.GuestPhone,
		&d.DocumentType, &d.DocumentNum,
	)
	if err != nil {
		return nil, stay.ErrStayNotFound
	}

	return &d, nil
}

func (r *GormStayRepository) Create(ctx context.Context, input stay.CreateStayInput) (*stay.StayDetails, error) {
	if r.db == nil {
		return nil, errors.New("database connection unavailable")
	}
	if !input.CheckOutDate.After(input.CheckInDate) {
		return nil, stay.ErrInvalidDateRange
	}

	var createdDetails *stay.StayDetails

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 1. Lock target room row & read authoritative category base_price and physical status
		var currentRoomStatus string
		var authoritativeBasePrice float64
		roomRow := tx.Raw(`
			SELECT r.status, c.base_price
			FROM rooms r
			JOIN room_categories c ON r.category_id = c.id
			WHERE r.id = ?
			FOR UPDATE OF r
		`, input.RoomID).Row()
		if err := roomRow.Scan(&currentRoomStatus, &authoritativeBasePrice); err != nil {
			return errors.New("target room not found")
		}

		// Determine stay lifecycle status (RESERVED vs ACTIVE)
		status := string(input.Status)
		if status != string(stay.StatusReserved) && status != string(stay.StatusActive) {
			if input.CheckInDate.After(time.Now().UTC().Add(2 * time.Hour)) {
				status = string(stay.StatusReserved)
			} else {
				status = string(stay.StatusActive)
			}
		}

		// Enforce physical room status invariants:
		// - Immediate check-in (ACTIVE) requires room to be physically AVAILABLE.
		// - Future reservation (RESERVED) checks calendar availability via GiST exclusion without overwriting current physical room status.
		if status == string(stay.StatusActive) {
			if currentRoomStatus != "AVAILABLE" {
				return stay.ErrRoomNotReadyForCheckIn
			}
		} else {
			if currentRoomStatus == "MAINTENANCE" || currentRoomStatus == "BLOCKED" {
				return stay.ErrRoomNotReadyForCheckIn
			}
		}

		// Use authoritative room base price from database (never trust arbitrary low prices from client)
		nightlyRate := stay.RoundCurrency(authoritativeBasePrice)
		if nightlyRate <= 0 {
			nightlyRate = stay.RoundCurrency(input.NightlyRate)
		}
		if nightlyRate <= 0 {
			return stay.ErrInvalidNightlyRate
		}

		// 2. Resolve registered user
		var userID uuid.UUID
		if input.RegisteredByID != uuid.Nil {
			userID = input.RegisteredByID
		} else {
			var firstUser struct{ ID uuid.UUID }
			if err := tx.Raw("SELECT id FROM users LIMIT 1").Scan(&firstUser).Error; err != nil || firstUser.ID == uuid.Nil {
				userID = uuid.New()
				_ = tx.Exec(`
					INSERT INTO users (id, username, email, password_hash, first_name, last_name, role)
					VALUES (?, 'system', 'system@hotelpremium.com', 'none', 'System', 'Admin', 'ADMIN')
					ON CONFLICT DO NOTHING
				`, userID).Error
			} else {
				userID = firstUser.ID
			}
		}

		// 3. Upsert guest
		docType := input.DocumentType
		if docType == "" {
			docType = "PASSPORT"
		}
		docNum := input.DocumentNumber
		if docNum == "" {
			docNum = "DOC-" + uuid.New().String()[:8]
		}

		var guestID uuid.UUID
		guestQuery := `
			INSERT INTO guests (id, document_type, document_number, full_name, email, phone, stay_count)
			VALUES (?, ?, ?, ?, ?, ?, 1)
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
		if err := tx.Raw(guestQuery, newGuestID, docType, docNum, input.GuestName, input.GuestEmail, input.GuestPhone).Row().Scan(&guestID); err != nil {
			return fmt.Errorf("gorm: failed to upsert guest: %w", err)
		}

		// 4. Insert Stay record with exact integer-cents financial calculation
		stayID := uuid.New()
		totalNights := int(input.CheckOutDate.Sub(input.CheckInDate).Hours() / 24)
		if totalNights < 1 {
			totalNights = 1
		}
		depositAmount := stay.RoundCurrency(input.DepositAmount)
		totalAmount := stay.RoundCurrency(nightlyRate * float64(totalNights))
		paymentStatus := string(stay.PaymentPending)
		if stay.ToCents(depositAmount) >= stay.ToCents(totalAmount) {
			paymentStatus = string(stay.PaymentPaid)
		} else if stay.ToCents(depositAmount) > 0 {
			paymentStatus = string(stay.PaymentPartial)
		}

		insertStayQuery := `
			INSERT INTO stays (
				id, room_id, primary_guest_id, cash_shift_id, registered_by_user_id,
				stay_period, status, nightly_rate, total_nights, deposit_amount, total_amount, payment_status, notes
			) VALUES (
				?, ?, ?, NULL, ?,
				tstzrange(?, ?, '[)'), ?, ?, ?, ?, ?, ?, ?
			)
		`
		if err := tx.Exec(insertStayQuery,
			stayID, input.RoomID, guestID, userID,
			input.CheckInDate, input.CheckOutDate,
			status, nightlyRate, totalNights, depositAmount, totalAmount, paymentStatus, input.Notes,
		).Error; err != nil {
			if strings.Contains(err.Error(), "stays_room_period_exclusion") || strings.Contains(err.Error(), "23P01") {
				return stay.ErrRoomAlreadyBooked
			}
			return fmt.Errorf("gorm: failed to insert stay: %w", err)
		}

		// 5. Update physical room status ONLY when guest is actively checking in today
		if status == string(stay.StatusActive) {
			if err := tx.Exec("UPDATE rooms SET status = 'OCCUPIED', updated_at = CURRENT_TIMESTAMP WHERE id = ?", input.RoomID).Error; err != nil {
				return fmt.Errorf("gorm: failed to update room status: %w", err)
			}
		}

		// 6. Outbox Event (Transactional Outbox Pattern with PII minimization)
		var traceID string
		span := trace.SpanFromContext(ctx)
		if span.SpanContext().IsValid() {
			traceID = span.SpanContext().TraceID().String()
		}

		payloadBytes, _ := json.Marshal(map[string]interface{}{
			"stay_id":        stayID.String(),
			"room_id":        input.RoomID.String(),
			"guest_name":     input.GuestName,
			"guest_email":    maskEmailPII(input.GuestEmail),
			"status":         status,
			"check_in":       input.CheckInDate,
			"check_out":      input.CheckOutDate,
			"total_amount":   totalAmount,
			"payment_status": paymentStatus,
			"action":         "CREATED",
			"timestamp":      time.Now().UTC(),
		})

		if err := tx.Exec(`
			INSERT INTO stay_outbox_events (id, aggregate_type, aggregate_id, event_type, payload, trace_id, status)
			VALUES (?, 'STAY', ?, 'STAY_CREATED', ?, ?, 'PENDING')
		`, uuid.New(), stayID, string(payloadBytes), traceID).Error; err != nil {
			return fmt.Errorf("gorm: failed to insert stay outbox event: %w", err)
		}

		// 7. Fetch created Stay Details
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
			WHERE s.id = ?
		`
		var d stay.StayDetails
		if err := tx.Raw(query, stayID).Row().Scan(
			&d.ID, &d.RoomID, &d.PrimaryGuestID, &d.CashShiftID, &d.RegisteredByUserID,
			&d.CheckInDate, &d.CheckOutDate,
			&d.Status, &d.NightlyRate, &d.TotalNights, &d.DepositAmount, &d.TotalAmount,
			&d.PaymentStatus, &d.Notes, &d.CreatedAt, &d.UpdatedAt,
			&d.RoomNumber, &d.CategoryName, &d.RoomFloor,
			&d.GuestName, &d.GuestEmail, &d.GuestPhone,
			&d.DocumentType, &d.DocumentNum,
		); err != nil {
			return fmt.Errorf("gorm: failed to scan created stay details: %w", err)
		}

		createdDetails = &d
		return nil
	})

	if err != nil {
		return nil, err
	}

	return createdDetails, nil
}

func (r *GormStayRepository) Update(ctx context.Context, id uuid.UUID, input stay.UpdateStayInput) (*stay.StayDetails, error) {
	if r.db == nil {
		return nil, errors.New("database connection unavailable")
	}

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var checkIn, checkOut time.Time
		var nights int
		var rate, deposit float64
		var notes, status string
		var roomID uuid.UUID

		row := tx.Raw(`
			SELECT room_id, lower(stay_period), upper(stay_period), total_nights, nightly_rate, deposit_amount, COALESCE(notes, ''), status
			FROM stays
			WHERE id = ?
			FOR UPDATE
		`, id).Row()
		if err := row.Scan(&roomID, &checkIn, &checkOut, &nights, &rate, &deposit, &notes, &status); err != nil {
			return stay.ErrStayNotFound
		}

		if status == string(stay.StatusCheckedOut) || status == string(stay.StatusCancelled) {
			return stay.ErrStayAlreadyFinished
		}

		if input.CheckInDate != nil {
			checkIn = *input.CheckInDate
		}
		if input.CheckOutDate != nil {
			checkOut = *input.CheckOutDate
		}
		if !checkOut.After(checkIn) {
			return stay.ErrInvalidDateRange
		}

		if input.TotalNights != nil && *input.TotalNights >= 1 {
			nights = *input.TotalNights
		} else if input.CheckInDate != nil || input.CheckOutDate != nil {
			computedNights := int(checkOut.Sub(checkIn).Hours() / 24)
			if computedNights >= 1 {
				nights = computedNights
			}
		}

		if input.NightlyRate != nil && *input.NightlyRate > 0 {
			rate = stay.RoundCurrency(*input.NightlyRate)
		}
		if input.DepositAmount != nil && *input.DepositAmount >= 0 {
			deposit = stay.RoundCurrency(*input.DepositAmount)
		}
		if input.Notes != nil {
			notes = *input.Notes
		}

		// Include any incidental POS charges attached to this stay
		var chargesSum float64
		_ = tx.Raw(`
			SELECT COALESCE(SUM(total_price), 0)
			FROM stay_charges
			WHERE stay_id = ? AND description NOT LIKE 'Initial Stay Deposit%'
		`, id).Row().Scan(&chargesSum)

		total := stay.RoundCurrency(float64(nights)*rate + chargesSum)
		pStatus := stay.PaymentPending
		if stay.ToCents(deposit) >= stay.ToCents(total) {
			pStatus = stay.PaymentPaid
		} else if stay.ToCents(deposit) > 0 {
			pStatus = stay.PaymentPartial
		}

		updateQuery := `
			UPDATE stays
			SET 
				stay_period = tstzrange(?, ?, '[)'),
				total_nights = ?,
				nightly_rate = ?,
				deposit_amount = ?,
				total_amount = ?,
				payment_status = ?,
				notes = ?,
				updated_at = CURRENT_TIMESTAMP
			WHERE id = ?
		`
		if err := tx.Exec(updateQuery, checkIn, checkOut, nights, rate, deposit, total, string(pStatus), notes, id).Error; err != nil {
			if strings.Contains(err.Error(), "exclusion") || strings.Contains(err.Error(), "23P01") {
				return stay.ErrRoomAlreadyBooked
			}
			return fmt.Errorf("gorm: failed to update stay: %w", err)
		}

		var traceID string
		if span := trace.SpanFromContext(ctx); span.SpanContext().IsValid() {
			traceID = span.SpanContext().TraceID().String()
		}
		payloadBytes, _ := json.Marshal(map[string]interface{}{
			"stay_id":        id.String(),
			"room_id":        roomID.String(),
			"status":         status,
			"total_amount":   total,
			"deposit_amount": deposit,
			"payment_status": string(pStatus),
			"action":         "UPDATED",
			"timestamp":      time.Now().UTC(),
		})
		if err := tx.Exec(`
			INSERT INTO stay_outbox_events (id, aggregate_type, aggregate_id, event_type, payload, trace_id, status)
			VALUES (?, 'STAY', ?, 'STAY_UPDATED', ?, ?, 'PENDING')
		`, uuid.New(), id, string(payloadBytes), traceID).Error; err != nil {
			return fmt.Errorf("gorm: failed to insert stay update outbox event: %w", err)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return r.FindByID(ctx, id)
}

func (r *GormStayRepository) Cancel(ctx context.Context, id uuid.UUID) error {
	if r.db == nil {
		return errors.New("database connection unavailable")
	}

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var roomID uuid.UUID
		var currentStatus string
		if err := tx.Raw("SELECT room_id, status FROM stays WHERE id = ? FOR UPDATE", id).Row().Scan(&roomID, &currentStatus); err != nil || roomID == uuid.Nil {
			return stay.ErrStayNotFound
		}

		if currentStatus == string(stay.StatusCheckedOut) || currentStatus == string(stay.StatusCancelled) {
			return stay.ErrStayAlreadyFinished
		}

		if err := tx.Exec("UPDATE stays SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = ?", id).Error; err != nil {
			return fmt.Errorf("gorm: failed to cancel stay: %w", err)
		}

		// Only release physical room to AVAILABLE if the cancelled stay was ACTIVE and no other ACTIVE stay occupies that room
		if currentStatus == string(stay.StatusActive) {
			var otherActiveCount int64
			_ = tx.Raw("SELECT COUNT(*) FROM stays WHERE room_id = ? AND status = 'ACTIVE' AND id <> ?", roomID, id).Row().Scan(&otherActiveCount)
			if otherActiveCount == 0 {
				if err := tx.Exec("UPDATE rooms SET status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'OCCUPIED'", roomID).Error; err != nil {
					return fmt.Errorf("gorm: failed to release room on cancel: %w", err)
				}
			}
		}

		var traceID string
		if span := trace.SpanFromContext(ctx); span.SpanContext().IsValid() {
			traceID = span.SpanContext().TraceID().String()
		}
		payloadBytes, _ := json.Marshal(map[string]interface{}{
			"stay_id":   id.String(),
			"room_id":   roomID.String(),
			"status":    "CANCELLED",
			"action":    "CANCELLED",
			"timestamp": time.Now().UTC(),
		})
		if err := tx.Exec(`
			INSERT INTO stay_outbox_events (id, aggregate_type, aggregate_id, event_type, payload, trace_id, status)
			VALUES (?, 'STAY', ?, 'STAY_CANCELLED', ?, ?, 'PENDING')
		`, uuid.New(), id, string(payloadBytes), traceID).Error; err != nil {
			return fmt.Errorf("gorm: failed to insert stay cancel outbox event: %w", err)
		}

		return nil
	})
}

func (r *GormStayRepository) CheckOut(ctx context.Context, id uuid.UUID) error {
	if r.db == nil {
		return errors.New("database connection unavailable")
	}

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var roomID uuid.UUID
		var currentStatus, paymentStatus string
		var depositAmount, totalAmount float64

		err := tx.Raw(`
			SELECT room_id, status, deposit_amount, total_amount, payment_status
			FROM stays
			WHERE id = ?
			FOR UPDATE
		`, id).Row().Scan(&roomID, &currentStatus, &depositAmount, &totalAmount, &paymentStatus)
		if err != nil || roomID == uuid.Nil {
			return stay.ErrStayNotFound
		}

		if currentStatus == string(stay.StatusCheckedOut) || currentStatus == string(stay.StatusCancelled) {
			return stay.ErrStayAlreadyFinished
		}

		// Enforce Zero-Balance Departure Policy on the backend
		if paymentStatus != string(stay.PaymentPaid) && stay.ToCents(depositAmount) < stay.ToCents(totalAmount) {
			return stay.ErrOutstandingBalance
		}

		if err := tx.Exec("UPDATE stays SET status = 'CHECKED_OUT', payment_status = 'PAID', updated_at = CURRENT_TIMESTAMP WHERE id = ?", id).Error; err != nil {
			return fmt.Errorf("gorm: failed to checkout stay: %w", err)
		}

		if err := tx.Exec("UPDATE rooms SET status = 'DIRTY', updated_at = CURRENT_TIMESTAMP WHERE id = ?", roomID).Error; err != nil {
			return fmt.Errorf("gorm: failed to mark room dirty on checkout: %w", err)
		}

		var traceID string
		if span := trace.SpanFromContext(ctx); span.SpanContext().IsValid() {
			traceID = span.SpanContext().TraceID().String()
		}
		payloadBytes, _ := json.Marshal(map[string]interface{}{
			"stay_id":   id.String(),
			"room_id":   roomID.String(),
			"status":    "CHECKED_OUT",
			"action":    "CHECKED_OUT",
			"timestamp": time.Now().UTC(),
		})
		if err := tx.Exec(`
			INSERT INTO stay_outbox_events (id, aggregate_type, aggregate_id, event_type, payload, trace_id, status)
			VALUES (?, 'STAY', ?, 'GUEST_CHECKED_OUT', ?, ?, 'PENDING')
		`, uuid.New(), id, string(payloadBytes), traceID).Error; err != nil {
			return fmt.Errorf("gorm: failed to insert checkout outbox event: %w", err)
		}

		return nil
	})
}

func (r *GormStayRepository) Save(ctx context.Context, s *stay.Stay) error {
	if r.db == nil {
		return errors.New("database connection unavailable")
	}

	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{"status", "deposit_amount", "total_amount", "payment_status", "notes", "updated_at"}),
	}).Create(&StayModel{
		ID:                 s.ID,
		RoomID:             s.RoomID,
		PrimaryGuestID:     s.PrimaryGuestID,
		CashShiftID:        s.CashShiftID,
		RegisteredByUserID: s.RegisteredByUserID,
		StayPeriod:         fmt.Sprintf("[%s,%s)", s.CheckInDate.Format(time.RFC3339), s.CheckOutDate.Format(time.RFC3339)),
		Status:             string(s.Status),
		NightlyRate:        stay.RoundCurrency(s.NightlyRate),
		TotalNights:        s.TotalNights,
		DepositAmount:      stay.RoundCurrency(s.DepositAmount),
		TotalAmount:        stay.RoundCurrency(s.TotalAmount),
		PaymentStatus:      string(s.PaymentStatus),
		Notes:              s.Notes,
		CreatedAt:          s.CreatedAt,
		UpdatedAt:          s.UpdatedAt,
	}).Error
}

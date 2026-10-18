package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/hotelpremium/backend/internal/domain/billing"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BillingRepository struct {
	pool *pgxpool.Pool
}

func NewBillingRepository(pool *pgxpool.Pool) *BillingRepository {
	return &BillingRepository{pool: pool}
}

func (r *BillingRepository) GetActiveShift(ctx context.Context, userID uuid.UUID) (*billing.CashShift, error) {
	query := `
		SELECT id, user_id, opened_at, closed_at, opening_amount, closing_amount,
		       actual_closing_amount, difference, status, COALESCE(notes, ''), created_at
		FROM cash_shifts
		WHERE user_id = $1 AND status = 'OPEN'
		ORDER BY opened_at DESC
		LIMIT 1
	`
	var s billing.CashShift
	err := r.pool.QueryRow(ctx, query, userID).Scan(
		&s.ID, &s.UserID, &s.OpenedAt, &s.ClosedAt, &s.OpeningAmount, &s.ClosingAmount,
		&s.ActualClosingAmount, &s.Difference, &s.Status, &s.Notes, &s.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to query active cash shift: %w", err)
	}
	return &s, nil
}

func (r *BillingRepository) OpenShift(ctx context.Context, userID uuid.UUID, openingAmount float64, notes string) (*billing.CashShift, error) {
	query := `
		INSERT INTO cash_shifts (id, user_id, opened_at, opening_amount, status, notes, created_at)
		VALUES ($1, $2, $3, $4, 'OPEN', $5, $3)
		RETURNING id, user_id, opened_at, opening_amount, status, COALESCE(notes, ''), created_at
	`
	now := time.Now().UTC()
	shiftID := uuid.New()
	var s billing.CashShift
	err := r.pool.QueryRow(ctx, query, shiftID, userID, now, openingAmount, notes).Scan(
		&s.ID, &s.UserID, &s.OpenedAt, &s.OpeningAmount, &s.Status, &s.Notes, &s.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to open cash shift: %w", err)
	}
	return &s, nil
}

func (r *BillingRepository) CloseShift(ctx context.Context, shiftID uuid.UUID, actualAmount float64, notes string) (*billing.CashShift, error) {
	now := time.Now().UTC()
	query := `
		UPDATE cash_shifts
		SET status = 'CLOSED',
		    closed_at = $1,
		    closing_amount = actual_closing_amount,
		    actual_closing_amount = $2,
		    notes = COALESCE($3, notes)
		WHERE id = $4 AND status = 'OPEN'
		RETURNING id, user_id, opened_at, closed_at, opening_amount, closing_amount,
		          actual_closing_amount, difference, status, COALESCE(notes, ''), created_at
	`
	var s billing.CashShift
	err := r.pool.QueryRow(ctx, query, now, actualAmount, notes, shiftID).Scan(
		&s.ID, &s.UserID, &s.OpenedAt, &s.ClosedAt, &s.OpeningAmount, &s.ClosingAmount,
		&s.ActualClosingAmount, &s.Difference, &s.Status, &s.Notes, &s.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, billing.ErrShiftAlreadyClosed
		}
		return nil, fmt.Errorf("failed to close cash shift: %w", err)
	}
	return &s, nil
}

func (r *BillingRepository) ListProducts(ctx context.Context) ([]*billing.Product, error) {
	query := `
		SELECT id, sku, name, COALESCE(description, ''), cost_price, sale_price, current_stock, is_active, created_at
		FROM products
		WHERE is_active = true
		ORDER BY name ASC
	`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*billing.Product
	for rows.Next() {
		var p billing.Product
		if err := rows.Scan(&p.ID, &p.SKU, &p.Name, &p.Description, &p.CostPrice, &p.SalePrice, &p.CurrentStock, &p.IsActive, &p.CreatedAt); err == nil {
			list = append(list, &p)
		}
	}
	return list, nil
}

func (r *BillingRepository) FindProductByID(ctx context.Context, id uuid.UUID) (*billing.Product, error) {
	query := `
		SELECT id, sku, name, COALESCE(description, ''), cost_price, sale_price, current_stock, is_active, created_at
		FROM products
		WHERE id = $1
	`
	var p billing.Product
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&p.ID, &p.SKU, &p.Name, &p.Description, &p.CostPrice, &p.SalePrice, &p.CurrentStock, &p.IsActive, &p.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, billing.ErrProductNotFound
		}
		return nil, err
	}
	return &p, nil
}

func (r *BillingRepository) CreateProduct(ctx context.Context, p *billing.Product) error {
	query := `
		INSERT INTO products (id, sku, name, description, cost_price, sale_price, current_stock, is_active, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err := r.pool.Exec(ctx, query, p.ID, p.SKU, p.Name, p.Description, p.CostPrice, p.SalePrice, p.CurrentStock, p.IsActive, p.CreatedAt)
	return err
}

func (r *BillingRepository) ListChargesByStayID(ctx context.Context, stayID uuid.UUID) ([]*billing.StayCharge, error) {
	query := `
		SELECT id, stay_id, product_id, description, quantity, unit_price, total_price, created_at
		FROM stay_charges
		WHERE stay_id = $1
		ORDER BY created_at ASC
	`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*billing.StayCharge
	for rows.Next() {
		var c billing.StayCharge
		if err := rows.Scan(&c.ID, &c.StayID, &c.ProductID, &c.Description, &c.Quantity, &c.UnitPrice, &c.TotalPrice, &c.CreatedAt); err == nil {
			list = append(list, &c)
		}
	}
	return list, nil
}

func (r *BillingRepository) AddCharge(ctx context.Context, charge *billing.StayCharge) error {
	query := `
		INSERT INTO stay_charges (id, stay_id, product_id, description, quantity, unit_price, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	_, err := r.pool.Exec(ctx, query, charge.ID, charge.StayID, charge.ProductID, charge.Description, charge.Quantity, charge.UnitPrice, charge.CreatedAt)
	return err
}

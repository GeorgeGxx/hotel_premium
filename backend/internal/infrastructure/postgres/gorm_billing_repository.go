package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/hotelpremium/backend/internal/domain/billing"
	"gorm.io/gorm"
)

type GormBillingRepository struct {
	db *gorm.DB
}

func NewGormBillingRepository(db *gorm.DB) *GormBillingRepository {
	return &GormBillingRepository{db: db}
}

func (r *GormBillingRepository) GetActiveShift(ctx context.Context, userID uuid.UUID) (*billing.CashShift, error) {
	if r.db == nil {
		return nil, errors.New("database connection unavailable")
	}

	var m CashShiftModel
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND status = 'OPEN'", userID).
		Order("opened_at DESC").
		First(&m).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("gorm: failed to query active cash shift: %w", err)
	}

	var diff *float64
	if m.ActualClosingAmount != nil && m.ClosingAmount != nil {
		d := *m.ActualClosingAmount - *m.ClosingAmount
		diff = &d
	}

	return &billing.CashShift{
		ID:                  m.ID,
		UserID:              m.UserID,
		OpenedAt:            m.OpenedAt,
		ClosedAt:            m.ClosedAt,
		OpeningAmount:       m.OpeningAmount,
		ClosingAmount:       m.ClosingAmount,
		ActualClosingAmount: m.ActualClosingAmount,
		Difference:          diff,
		Status:              billing.ShiftStatus(m.Status),
		Notes:               m.Notes,
		CreatedAt:           m.CreatedAt,
	}, nil
}

func (r *GormBillingRepository) OpenShift(ctx context.Context, userID uuid.UUID, openingAmount float64, notes string) (*billing.CashShift, error) {
	if r.db == nil {
		return nil, errors.New("database connection unavailable")
	}

	now := time.Now().UTC()
	m := CashShiftModel{
		ID:            uuid.New(),
		UserID:        userID,
		OpenedAt:      now,
		OpeningAmount: openingAmount,
		Status:        string(billing.ShiftOpen),
		Notes:         notes,
		CreatedAt:     now,
	}

	if err := r.db.WithContext(ctx).Create(&m).Error; err != nil {
		return nil, fmt.Errorf("gorm: failed to open cash shift: %w", err)
	}

	return &billing.CashShift{
		ID:            m.ID,
		UserID:        m.UserID,
		OpenedAt:      m.OpenedAt,
		OpeningAmount: m.OpeningAmount,
		Status:        billing.ShiftOpen,
		Notes:         m.Notes,
		CreatedAt:     m.CreatedAt,
	}, nil
}

func (r *GormBillingRepository) CloseShift(ctx context.Context, shiftID uuid.UUID, actualAmount float64, notes string) (*billing.CashShift, error) {
	if r.db == nil {
		return nil, errors.New("database connection unavailable")
	}

	now := time.Now().UTC()
	var m CashShiftModel
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&m, "id = ?", shiftID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("cash shift not found")
			}
			return err
		}

		if m.Status == string(billing.ShiftClosed) {
			return errors.New("cash shift is already closed")
		}

		m.ClosedAt = &now
		m.ActualClosingAmount = &actualAmount
		m.ClosingAmount = &actualAmount
		m.Status = string(billing.ShiftClosed)
		if notes != "" {
			m.Notes = notes
		}

		return tx.Save(&m).Error
	})

	if err != nil {
		return nil, fmt.Errorf("gorm: failed to close cash shift: %w", err)
	}

	var diff float64 = 0.0
	return &billing.CashShift{
		ID:                  m.ID,
		UserID:              m.UserID,
		OpenedAt:            m.OpenedAt,
		ClosedAt:            m.ClosedAt,
		OpeningAmount:       m.OpeningAmount,
		ClosingAmount:       m.ClosingAmount,
		ActualClosingAmount: m.ActualClosingAmount,
		Difference:          &diff,
		Status:              billing.ShiftClosed,
		Notes:               m.Notes,
		CreatedAt:           m.CreatedAt,
	}, nil
}

func (r *GormBillingRepository) ListProducts(ctx context.Context) ([]*billing.Product, error) {
	if r.db == nil {
		return nil, errors.New("database connection unavailable")
	}

	var models []ProductModel
	if err := r.db.WithContext(ctx).Where("is_active = true").Order("name ASC").Find(&models).Error; err != nil {
		return nil, fmt.Errorf("gorm: failed to list products: %w", err)
	}

	products := make([]*billing.Product, len(models))
	for i, m := range models {
		products[i] = &billing.Product{
			ID:           m.ID,
			SKU:          m.SKU,
			Name:         m.Name,
			Description:  m.Description,
			CostPrice:    m.CostPrice,
			SalePrice:    m.SalePrice,
			CurrentStock: m.CurrentStock,
			IsActive:     m.IsActive,
			CreatedAt:    m.CreatedAt,
		}
	}

	return products, nil
}

func (r *GormBillingRepository) FindProductByID(ctx context.Context, id uuid.UUID) (*billing.Product, error) {
	if r.db == nil {
		return nil, errors.New("database connection unavailable")
	}

	var m ProductModel
	if err := r.db.WithContext(ctx).First(&m, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("product not found")
		}
		return nil, fmt.Errorf("gorm: failed to find product: %w", err)
	}

	return &billing.Product{
		ID:           m.ID,
		SKU:          m.SKU,
		Name:         m.Name,
		Description:  m.Description,
		CostPrice:    m.CostPrice,
		SalePrice:    m.SalePrice,
		CurrentStock: m.CurrentStock,
		IsActive:     m.IsActive,
		CreatedAt:    m.CreatedAt,
	}, nil
}

func (r *GormBillingRepository) CreateProduct(ctx context.Context, product *billing.Product) error {
	if r.db == nil {
		return errors.New("database connection unavailable")
	}

	m := ProductModel{
		ID:           product.ID,
		SKU:          product.SKU,
		Name:         product.Name,
		Description:  product.Description,
		CostPrice:    product.CostPrice,
		SalePrice:    product.SalePrice,
		CurrentStock: product.CurrentStock,
		IsActive:     product.IsActive,
		CreatedAt:    product.CreatedAt,
	}

	return r.db.WithContext(ctx).Create(&m).Error
}

func (r *GormBillingRepository) ListChargesByStayID(ctx context.Context, stayID uuid.UUID) ([]*billing.StayCharge, error) {
	if r.db == nil {
		return nil, errors.New("database connection unavailable")
	}

	var models []StayChargeModel
	err := r.db.WithContext(ctx).
		Preload("Product").
		Where("stay_id = ?", stayID).
		Order("created_at ASC").
		Find(&models).Error

	if err != nil {
		return nil, fmt.Errorf("gorm: failed to list charges: %w", err)
	}

	charges := make([]*billing.StayCharge, len(models))
	for i, m := range models {
		charges[i] = &billing.StayCharge{
			ID:          m.ID,
			StayID:      m.StayID,
			ProductID:   m.ProductID,
			Description: m.Description,
			Quantity:    m.Quantity,
			UnitPrice:   m.UnitPrice,
			TotalPrice:  m.TotalPrice,
			CreatedAt:   m.CreatedAt,
		}
	}

	return charges, nil
}

func (r *GormBillingRepository) AddCharge(ctx context.Context, charge *billing.StayCharge) error {
	if r.db == nil {
		return errors.New("database connection unavailable")
	}

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		totalPrice := float64(charge.Quantity) * charge.UnitPrice
		if charge.ID == uuid.Nil {
			charge.ID = uuid.New()
		}
		if charge.CreatedAt.IsZero() {
			charge.CreatedAt = time.Now().UTC()
		}
		charge.TotalPrice = totalPrice

		m := StayChargeModel{
			ID:          charge.ID,
			StayID:      charge.StayID,
			ProductID:   charge.ProductID,
			Description: charge.Description,
			Quantity:    charge.Quantity,
			UnitPrice:   charge.UnitPrice,
			TotalPrice:  totalPrice,
			CreatedAt:   charge.CreatedAt,
		}

		if err := tx.Create(&m).Error; err != nil {
			return fmt.Errorf("gorm: failed to insert stay charge: %w", err)
		}

		// Update total_amount on stay
		if err := tx.Exec("UPDATE stays SET total_amount = total_amount + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", totalPrice, charge.StayID).Error; err != nil {
			return fmt.Errorf("gorm: failed to update stay total amount: %w", err)
		}

		// Deduct stock if product specified
		if charge.ProductID != nil && *charge.ProductID != uuid.Nil {
			if err := tx.Exec("UPDATE products SET current_stock = GREATEST(0, current_stock - ?) WHERE id = ?", charge.Quantity, *charge.ProductID).Error; err != nil {
				return fmt.Errorf("gorm: failed to deduct product stock: %w", err)
			}
		}

		return nil
	})
}

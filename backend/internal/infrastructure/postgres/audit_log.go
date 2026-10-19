package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuditLogModel struct {
	ID            uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID        uuid.UUID `gorm:"type:uuid;index" json:"user_id"`
	UserRole      string    `gorm:"type:varchar(50);not null" json:"user_role"`
	Action        string    `gorm:"type:varchar(100);not null;index" json:"action"`
	Entity        string    `gorm:"type:varchar(50);not null;index" json:"entity"`
	EntityID      string    `gorm:"type:varchar(100);not null" json:"entity_id"`
	PayloadBefore string    `gorm:"type:jsonb" json:"payload_before,omitempty"`
	PayloadAfter  string    `gorm:"type:jsonb" json:"payload_after,omitempty"`
	ClientIP      string    `gorm:"type:varchar(50)" json:"client_ip"`
	TraceID       string    `gorm:"type:varchar(64);index" json:"trace_id"`
	CreatedAt     time.Time `gorm:"type:timestamptz;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (AuditLogModel) TableName() string {
	return "audit_logs"
}

type AuditRepository struct {
	db *gorm.DB
}

func NewAuditRepository(db *gorm.DB) *AuditRepository {
	return &AuditRepository{db: db}
}

func (r *AuditRepository) Record(ctx context.Context, log *AuditLogModel) error {
	if r.db == nil {
		return nil
	}
	if log.ID == uuid.Nil {
		log.ID = uuid.New()
	}
	if log.CreatedAt.IsZero() {
		log.CreatedAt = time.Now().UTC()
	}
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *AuditRepository) ListRecent(ctx context.Context, limit int) ([]AuditLogModel, error) {
	if r.db == nil {
		return nil, nil
	}
	if limit <= 0 {
		limit = 50
	}
	var logs []AuditLogModel
	err := r.db.WithContext(ctx).Order("created_at DESC").Limit(limit).Find(&logs).Error
	return logs, err
}

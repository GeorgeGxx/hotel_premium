package postgres

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/hotelpremium/backend/internal/infrastructure/config"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// GORM Domain Models mapping PostgreSQL schema

type RoomCategoryModel struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Code        string    `gorm:"type:varchar(30);uniqueIndex;not null" json:"code"`
	Name        string    `gorm:"type:varchar(100);not null" json:"name"`
	Description string    `gorm:"type:text" json:"description"`
	BasePrice   float64   `gorm:"type:numeric(10,2);not null;default:0.00" json:"base_price"`
	Capacity    int       `gorm:"type:int;not null;default:2" json:"capacity"`
	ImageURL    string    `gorm:"type:varchar(500)" json:"image_url"`
	CreatedAt   time.Time `gorm:"type:timestamptz;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (RoomCategoryModel) TableName() string {
	return "room_categories"
}

type RoomModel struct {
	ID           uuid.UUID          `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Number       string             `gorm:"type:varchar(20);uniqueIndex;not null" json:"number"`
	CategoryID   uuid.UUID          `gorm:"type:uuid;not null;index" json:"category_id"`
	Category     *RoomCategoryModel `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Floor        int                `gorm:"type:int;not null;default:1" json:"floor"`
	Status       string             `gorm:"type:varchar(30);not null;default:'AVAILABLE'" json:"status"`
	Notes        string             `gorm:"type:text" json:"notes"`
	CreatedAt    time.Time          `gorm:"type:timestamptz;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt    time.Time          `gorm:"type:timestamptz;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (RoomModel) TableName() string {
	return "rooms"
}

type GuestModel struct {
	ID             uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	DocumentType   string    `gorm:"type:varchar(20);not null" json:"document_type"`
	DocumentNumber string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"document_number"`
	FullName       string    `gorm:"type:varchar(200);not null" json:"full_name"`
	Email          string    `gorm:"type:varchar(255)" json:"email"`
	Phone          string    `gorm:"type:varchar(30)" json:"phone"`
	Nationality    string    `gorm:"type:varchar(100)" json:"nationality"`
	IsVIP          bool      `gorm:"type:boolean;not null;default:false" json:"is_vip"`
	StayCount      int       `gorm:"type:int;not null;default:0" json:"stay_count"`
	CreatedAt      time.Time `gorm:"type:timestamptz;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt      time.Time `gorm:"type:timestamptz;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (GuestModel) TableName() string {
	return "guests"
}

type StayModel struct {
	ID                 uuid.UUID   `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	RoomID             uuid.UUID   `gorm:"type:uuid;not null;index" json:"room_id"`
	Room               *RoomModel  `gorm:"foreignKey:RoomID" json:"room,omitempty"`
	PrimaryGuestID     uuid.UUID   `gorm:"type:uuid;not null;index" json:"primary_guest_id"`
	Guest              *GuestModel `gorm:"foreignKey:PrimaryGuestID" json:"guest,omitempty"`
	CashShiftID        *uuid.UUID  `gorm:"type:uuid;index" json:"cash_shift_id,omitempty"`
	RegisteredByUserID uuid.UUID   `gorm:"type:uuid;not null" json:"registered_by_user_id"`
	StayPeriod         string      `gorm:"type:tstzrange;not null" json:"stay_period"`
	Status             string      `gorm:"type:varchar(30);not null;default:'ACTIVE'" json:"status"`
	NightlyRate        float64     `gorm:"type:numeric(10,2);not null" json:"nightly_rate"`
	TotalNights        int         `gorm:"type:int;not null;default:1" json:"total_nights"`
	DepositAmount      float64     `gorm:"type:numeric(10,2);not null;default:0.00" json:"deposit_amount"`
	TotalAmount        float64     `gorm:"type:numeric(10,2);not null;default:0.00" json:"total_amount"`
	PaymentStatus      string      `gorm:"type:varchar(20);not null;default:'PENDING'" json:"payment_status"`
	Notes              string      `gorm:"type:text" json:"notes"`
	CreatedAt          time.Time   `gorm:"type:timestamptz;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt          time.Time   `gorm:"type:timestamptz;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (StayModel) TableName() string {
	return "stays"
}

type ProductModel struct {
	ID           uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	SKU          string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"sku"`
	Name         string    `gorm:"type:varchar(150);not null" json:"name"`
	Description  string    `gorm:"type:text" json:"description"`
	CostPrice    float64   `gorm:"type:numeric(10,2);not null;default:0.00" json:"cost_price"`
	SalePrice    float64   `gorm:"type:numeric(10,2);not null;default:0.00" json:"sale_price"`
	CurrentStock int       `gorm:"type:int;not null;default:0" json:"current_stock"`
	IsActive     bool      `gorm:"type:boolean;not null;default:true" json:"is_active"`
	CreatedAt    time.Time `gorm:"type:timestamptz;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (ProductModel) TableName() string {
	return "products"
}

type StayChargeModel struct {
	ID          uuid.UUID     `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	StayID      uuid.UUID     `gorm:"type:uuid;not null;index" json:"stay_id"`
	ProductID   *uuid.UUID    `gorm:"type:uuid;index" json:"product_id,omitempty"`
	Product     *ProductModel `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	Description string        `gorm:"type:varchar(255);not null" json:"description"`
	Quantity    int           `gorm:"type:int;not null;default:1" json:"quantity"`
	UnitPrice   float64       `gorm:"type:numeric(10,2);not null" json:"unit_price"`
	TotalPrice  float64       `gorm:"type:numeric(10,2)" json:"total_price"`
	CreatedAt   time.Time     `gorm:"type:timestamptz;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (StayChargeModel) TableName() string {
	return "stay_charges"
}

type CashShiftModel struct {
	ID                  uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID              uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	OpenedAt            time.Time  `gorm:"type:timestamptz;not null;default:CURRENT_TIMESTAMP" json:"opened_at"`
	ClosedAt            *time.Time `gorm:"type:timestamptz" json:"closed_at,omitempty"`
	OpeningAmount       float64    `gorm:"type:numeric(12,2);not null;default:0.00" json:"opening_amount"`
	ClosingAmount       *float64   `gorm:"type:numeric(12,2)" json:"closing_amount,omitempty"`
	ActualClosingAmount *float64   `gorm:"type:numeric(12,2)" json:"actual_closing_amount,omitempty"`
	Status              string     `gorm:"type:varchar(20);not null;default:'OPEN'" json:"status"`
	Notes               string     `gorm:"type:text" json:"notes"`
	CreatedAt           time.Time  `gorm:"type:timestamptz;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (CashShiftModel) TableName() string {
	return "cash_shifts"
}

type StayOutboxEventModel struct {
	ID            uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	AggregateType string     `gorm:"type:varchar(50);not null" json:"aggregate_type"`
	AggregateID   uuid.UUID  `gorm:"type:uuid;not null" json:"aggregate_id"`
	EventType     string     `gorm:"type:varchar(100);not null" json:"event_type"`
	Payload       string     `gorm:"type:jsonb;not null" json:"payload"`
	TraceID       string     `gorm:"type:varchar(64)" json:"trace_id"`
	Status        string     `gorm:"type:varchar(20);not null;default:'PENDING'" json:"status"`
	RetryCount    int        `gorm:"type:int;not null;default:0" json:"retry_count"`
	CreatedAt     time.Time  `gorm:"type:timestamptz;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	PublishedAt   *time.Time `gorm:"type:timestamptz" json:"published_at,omitempty"`
}

func (StayOutboxEventModel) TableName() string {
	return "stay_outbox_events"
}

// NewGormDB establishes a high-performance connection to PostgreSQL using GORM v1.31.2
func NewGormDB(ctx context.Context, cfg *config.Config) (*gorm.DB, error) {
	gormLogLevel := logger.Warn
	if cfg.AppEnv == "development" {
		gormLogLevel = logger.Info
	}

	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(gormLogLevel),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
		PrepareStmt:            true,
		SkipDefaultTransaction: true,
	}

	db, err := gorm.Open(postgres.Open(cfg.DSN()), gormConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to open GORM PostgreSQL database connection: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve underlying sql.DB from GORM: %w", err)
	}

	sqlDB.SetMaxOpenConns(cfg.DBMaxOpenConns)
	sqlDB.SetMaxIdleConns(cfg.DBMaxIdleConns)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)
	sqlDB.SetConnMaxIdleTime(15 * time.Minute)

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := sqlDB.PingContext(pingCtx); err != nil {
		slog.Warn("GORM PostgreSQL ping failed, operating in decoupled fallback mode", "error", err)
		return db, nil
	}

	slog.Info("Successfully established GORM v1.31.2 connection pool with PostgreSQL")
	return db, nil
}

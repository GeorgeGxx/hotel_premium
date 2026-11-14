package postgres

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/hotelpremium/backend/internal/infrastructure/config"
	"github.com/hotelpremium/backend/internal/infrastructure/telemetry"
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
	ID         uuid.UUID          `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Number     string             `gorm:"type:varchar(20);uniqueIndex;not null" json:"number"`
	CategoryID uuid.UUID          `gorm:"type:uuid;not null;index" json:"category_id"`
	Category   *RoomCategoryModel `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Floor      int                `gorm:"type:int;not null;default:1" json:"floor"`
	Status     string             `gorm:"type:varchar(30);not null;default:'AVAILABLE'" json:"status"`
	Notes      string             `gorm:"type:text" json:"notes"`
	CreatedAt  time.Time          `gorm:"type:timestamptz;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt  time.Time          `gorm:"type:timestamptz;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
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
	TotalPrice  float64       `gorm:"column:total_price;type:numeric(10,2);->;<-:false" json:"total_price"`
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
		slog.Warn("GORM PostgreSQL ping failed during startup", "error", err)
		return db, err
	}

	slog.Info("Successfully established GORM v1.31.2 connection pool with PostgreSQL")
	go startLiveBusinessMetricsSync(ctx, db)
	return db, nil
}

// startLiveBusinessMetricsSync periodically queries PostgreSQL to keep USALI Business KPIs synchronized in Prometheus.
// All metrics are computed strictly from persisted database records with zero synthetic baselines.
func startLiveBusinessMetricsSync(ctx context.Context, db *gorm.DB) {
	syncOnce := func() {
		qCtx, cancel := context.WithTimeout(ctx, 4*time.Second)
		defer cancel()

		var totalRooms float64
		var occPercent float64

		// 1. Room status inventory & Occupancy %
		type statusCount struct {
			Status string
			Count  int64
		}
		var roomCounts []statusCount
		if err := db.WithContext(qCtx).Model(&RoomModel{}).
			Select("status, count(*) as count").
			Group("status").
			Scan(&roomCounts).Error; err == nil {

			statusMap := map[string]float64{
				"AVAILABLE":   0,
				"OCCUPIED":    0,
				"DIRTY":       0,
				"MAINTENANCE": 0,
			}
			for _, rc := range roomCounts {
				key := rc.Status
				if key == "CLEANING" {
					key = "DIRTY"
				} else if key == "BLOCKED" {
					key = "MAINTENANCE"
				}
				statusMap[key] += float64(rc.Count)
				totalRooms += float64(rc.Count)
			}
			for st, cnt := range statusMap {
				telemetry.RoomsByStatus.WithLabelValues(st).Set(cnt)
			}
			if totalRooms > 0 {
				occPercent = (statusMap["OCCUPIED"] / totalRooms) * 100.0
			}
			telemetry.OccupancyRatePercent.Set(occPercent)
		}

		// 2. Ancillary POS & Incidental Revenue (excluding initial stay deposit ledger records)
		var ancillaryTotal float64
		_ = db.WithContext(qCtx).Model(&StayChargeModel{}).
			Where("description NOT LIKE 'Initial Stay Deposit%'").
			Select("COALESCE(SUM(unit_price * quantity), 0)").
			Scan(&ancillaryTotal).Error
		telemetry.AncillaryRevenueUSD.Set(ancillaryTotal)

		// 3. Stays lifecycle status, LoS, Cancellation Rate, Deposits, Pending Balance, ADR, RevPAR & TRevPAR
		var stays []StayModel
		if err := db.WithContext(qCtx).Preload("Room.Category").Find(&stays).Error; err == nil {
			stayStatusMap := map[string]float64{
				"ACTIVE":      0,
				"RESERVED":    0,
				"CHECKED_OUT": 0,
				"CANCELLED":   0,
			}
			var totalNights float64
			var validStays float64
			var totalRate float64
			var totalRoomRevenue float64
			var totalDeposits float64
			var totalPending float64
			catRev := map[string]float64{
				"Presidential Suite": 0,
				"Double Deluxe":      0,
				"Single Standard":    0,
			}

			for _, s := range stays {
				stayStatusMap[s.Status]++
				if s.Status != "CANCELLED" {
					validStays++
					totalNights += float64(s.TotalNights)
					totalRate += s.NightlyRate
					totalRoomRevenue += s.TotalAmount
					totalDeposits += s.DepositAmount
					rem := s.TotalAmount - s.DepositAmount
					if rem > 0 && s.PaymentStatus != "PAID" {
						totalPending += rem
					}
					if s.Room != nil && s.Room.Category != nil && s.Room.Category.Name != "" {
						catRev[s.Room.Category.Name] += s.TotalAmount
					}
				}
			}

			for st, cnt := range stayStatusMap {
				telemetry.StaysByStatus.WithLabelValues(st).Set(cnt)
			}
			for cat, rev := range catRev {
				telemetry.CategoryRevenueUSD.WithLabelValues(cat).Set(rev)
			}

			var adr float64
			if validStays > 0 {
				adr = totalRate / validStays
				telemetry.AvgLengthOfStay.Set(totalNights / validStays)
			} else {
				telemetry.AvgLengthOfStay.Set(0)
			}
			telemetry.ADRUSD.Set(adr)

			if len(stays) > 0 {
				cancRate := (stayStatusMap["CANCELLED"] / float64(len(stays))) * 100.0
				telemetry.CancellationRate.Set(cancRate)
			} else {
				telemetry.CancellationRate.Set(0)
			}

			telemetry.FolioDepositsUSD.Set(totalDeposits)
			telemetry.FolioPendingBalanceUSD.Set(totalPending)
			telemetry.TotalRevenueUSD.Set(totalRoomRevenue + ancillaryTotal)

			if totalRooms > 0 {
				revpar := adr * (occPercent / 100.0)
				trevpar := (totalRoomRevenue + ancillaryTotal) / totalRooms
				telemetry.RevPARUSD.Set(revpar)
				telemetry.TRevPARUSD.Set(trevpar)
			} else {
				telemetry.RevPARUSD.Set(0)
				telemetry.TRevPARUSD.Set(0)
			}
		}

		// 4. Transactional Outbox Backlog
		var pendingOutbox int64
		if err := db.WithContext(qCtx).Model(&StayOutboxEventModel{}).
			Where("status = 'PENDING'").
			Count(&pendingOutbox).Error; err == nil {
			telemetry.OutboxPendingEvents.Set(float64(pendingOutbox))
		}
	}

	syncOnce()
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			syncOnce()
		}
	}
}

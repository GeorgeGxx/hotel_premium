package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/hotelpremium/backend/internal/domain/room"
	infraRedis "github.com/hotelpremium/backend/internal/infrastructure/redis"
	"gorm.io/gorm"
)

type GormRoomRepository struct {
	db    *gorm.DB
	cache *infraRedis.CacheManager
}

func NewGormRoomRepository(db *gorm.DB) *GormRoomRepository {
	return &GormRoomRepository{db: db}
}

func (r *GormRoomRepository) WithCache(cache *infraRedis.CacheManager) *GormRoomRepository {
	r.cache = cache
	return r
}

func (r *GormRoomRepository) FindAll(ctx context.Context) ([]*room.Room, error) {
	if r.db == nil {
		return nil, errors.New("database connection unavailable")
	}

	fetch := func() (interface{}, error) {
		var models []RoomModel
		err := r.db.WithContext(ctx).
			Preload("Category").
			Order("floor ASC, number ASC").
			Find(&models).Error

		if err != nil {
			return nil, fmt.Errorf("gorm: failed to query rooms: %w", err)
		}

		rooms := make([]*room.Room, len(models))
		for i, m := range models {
			categoryName := ""
			basePrice := 0.0
			capacity := 2
			if m.Category != nil {
				categoryName = m.Category.Name
				basePrice = m.Category.BasePrice
				capacity = m.Category.Capacity
			}

			rooms[i] = &room.Room{
				ID:           m.ID,
				Number:       m.Number,
				CategoryID:   m.CategoryID,
				CategoryName: categoryName,
				Floor:        m.Floor,
				Status:       room.Status(m.Status),
				BasePrice:    basePrice,
				Capacity:     capacity,
				Notes:        m.Notes,
				CreatedAt:    m.CreatedAt,
				UpdatedAt:    m.UpdatedAt,
			}
		}
		return rooms, nil
	}

	if r.cache != nil {
		var cachedRooms []*room.Room
		if err := r.cache.GetOrFetch(ctx, "rooms:all", 30*time.Second, &cachedRooms, fetch); err == nil {
			return cachedRooms, nil
		}
	}

	res, err := fetch()
	if err != nil {
		return nil, err
	}
	return res.([]*room.Room), nil
}

func (r *GormRoomRepository) FindByID(ctx context.Context, id uuid.UUID) (*room.Room, error) {
	if r.db == nil {
		return nil, errors.New("database connection unavailable")
	}

	var m RoomModel
	err := r.db.WithContext(ctx).
		Preload("Category").
		First(&m, "id = ?", id).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("room not found")
		}
		return nil, fmt.Errorf("gorm: failed to find room by id: %w", err)
	}

	categoryName := ""
	basePrice := 0.0
	capacity := 2
	if m.Category != nil {
		categoryName = m.Category.Name
		basePrice = m.Category.BasePrice
		capacity = m.Category.Capacity
	}

	return &room.Room{
		ID:           m.ID,
		Number:       m.Number,
		CategoryID:   m.CategoryID,
		CategoryName: categoryName,
		Floor:        m.Floor,
		Status:       room.Status(m.Status),
		BasePrice:    basePrice,
		Capacity:     capacity,
		Notes:        m.Notes,
		CreatedAt:    m.CreatedAt,
		UpdatedAt:    m.UpdatedAt,
	}, nil
}

func (r *GormRoomRepository) FindByNumber(ctx context.Context, number string) (*room.Room, error) {
	if r.db == nil {
		return nil, errors.New("database connection unavailable")
	}

	var m RoomModel
	err := r.db.WithContext(ctx).
		Preload("Category").
		First(&m, "number = ?", number).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("room not found")
		}
		return nil, fmt.Errorf("gorm: failed to find room by number: %w", err)
	}

	categoryName := ""
	basePrice := 0.0
	capacity := 2
	if m.Category != nil {
		categoryName = m.Category.Name
		basePrice = m.Category.BasePrice
		capacity = m.Category.Capacity
	}

	return &room.Room{
		ID:           m.ID,
		Number:       m.Number,
		CategoryID:   m.CategoryID,
		CategoryName: categoryName,
		Floor:        m.Floor,
		Status:       room.Status(m.Status),
		BasePrice:    basePrice,
		Capacity:     capacity,
		Notes:        m.Notes,
		CreatedAt:    m.CreatedAt,
		UpdatedAt:    m.UpdatedAt,
	}, nil
}

func (r *GormRoomRepository) Save(ctx context.Context, rm *room.Room) error {
	if r.db == nil {
		return errors.New("database connection unavailable")
	}

	m := RoomModel{
		ID:         rm.ID,
		Number:     rm.Number,
		CategoryID: rm.CategoryID,
		Floor:      rm.Floor,
		Status:     string(rm.Status),
		Notes:      rm.Notes,
		CreatedAt:  rm.CreatedAt,
		UpdatedAt:  rm.UpdatedAt,
	}

	if err := r.db.WithContext(ctx).Save(&m).Error; err != nil {
		return err
	}
	if r.cache != nil {
		_ = r.cache.Invalidate(ctx, "rooms:all", "rooms:id:"+rm.ID.String())
	}
	return nil
}

func (r *GormRoomRepository) Update(ctx context.Context, rm *room.Room) error {
	if r.db == nil {
		return errors.New("database connection unavailable")
	}

	err := r.db.WithContext(ctx).
		Model(&RoomModel{}).
		Where("id = ?", rm.ID).
		Updates(map[string]interface{}{
			"number":      rm.Number,
			"category_id": rm.CategoryID,
			"floor":       rm.Floor,
			"status":      string(rm.Status),
			"notes":       rm.Notes,
			"updated_at":  time.Now().UTC(),
		}).Error
	if err == nil && r.cache != nil {
		_ = r.cache.Invalidate(ctx, "rooms:all", "rooms:id:"+rm.ID.String())
	}
	return err
}

func (r *GormRoomRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status room.Status) error {
	if r.db == nil {
		return errors.New("database connection unavailable")
	}

	res := r.db.WithContext(ctx).
		Model(&RoomModel{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":     string(status),
			"updated_at": time.Now().UTC(),
		})

	if res.Error != nil {
		return fmt.Errorf("gorm: failed to update room status: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return errors.New("room not found")
	}
	if r.cache != nil {
		_ = r.cache.Invalidate(ctx, "rooms:all", "rooms:id:"+id.String())
	}

	return nil
}

func (r *GormRoomRepository) UpdatePrice(ctx context.Context, id uuid.UUID, price float64) error {
	if r.db == nil {
		return errors.New("database connection unavailable")
	}

	// Update category base_price through room relationship
	var rm RoomModel
	if err := r.db.WithContext(ctx).Select("category_id").First(&rm, "id = ?", id).Error; err != nil {
		return fmt.Errorf("gorm: failed to fetch room for price update: %w", err)
	}

	err := r.db.WithContext(ctx).
		Model(&RoomCategoryModel{}).
		Where("id = ?", rm.CategoryID).
		Update("base_price", price).Error
	if err == nil && r.cache != nil {
		_ = r.cache.Invalidate(ctx, "rooms:all", "rooms:id:"+id.String())
	}
	return err
}

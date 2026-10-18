package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/hotelpremium/backend/internal/domain/room"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RoomRepository struct {
	pool *pgxpool.Pool
}

func NewRoomRepository(pool *pgxpool.Pool) *RoomRepository {
	return &RoomRepository{pool: pool}
}

func (r *RoomRepository) FindAll(ctx context.Context) ([]*room.Room, error) {
	query := `
		SELECT 
			r.id, r.number, r.category_id, c.name as category_name,
			r.floor, r.status, c.base_price, c.capacity, COALESCE(r.notes, ''),
			r.created_at, r.updated_at
		FROM rooms r
		JOIN room_categories c ON r.category_id = c.id
		ORDER BY r.floor ASC, r.number ASC
	`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query rooms: %w", err)
	}
	defer rows.Close()

	var rooms []*room.Room
	for rows.Next() {
		var rm room.Room
		var catName string
		err := rows.Scan(
			&rm.ID, &rm.Number, &rm.CategoryID, &catName,
			&rm.Floor, &rm.Status, &rm.BasePrice, &rm.Capacity, &rm.Notes,
			&rm.CreatedAt, &rm.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan room row: %w", err)
		}
		rm.CategoryName = catName
		rooms = append(rooms, &rm)
	}

	return rooms, nil
}

func (r *RoomRepository) FindByID(ctx context.Context, id uuid.UUID) (*room.Room, error) {
	query := `
		SELECT 
			r.id, r.number, r.category_id, c.name as category_name,
			r.floor, r.status, c.base_price, c.capacity, COALESCE(r.notes, ''),
			r.created_at, r.updated_at
		FROM rooms r
		JOIN room_categories c ON r.category_id = c.id
		WHERE r.id = $1
	`
	var rm room.Room
	var catName string
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&rm.ID, &rm.Number, &rm.CategoryID, &catName,
		&rm.Floor, &rm.Status, &rm.BasePrice, &rm.Capacity, &rm.Notes,
		&rm.CreatedAt, &rm.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	rm.CategoryName = catName
	return &rm, nil
}

func (r *RoomRepository) FindByNumber(ctx context.Context, number string) (*room.Room, error) {
	query := `
		SELECT 
			r.id, r.number, r.category_id, c.name as category_name,
			r.floor, r.status, c.base_price, c.capacity, COALESCE(r.notes, ''),
			r.created_at, r.updated_at
		FROM rooms r
		JOIN room_categories c ON r.category_id = c.id
		WHERE r.number = $1
	`
	var rm room.Room
	var catName string
	err := r.pool.QueryRow(ctx, query, number).Scan(
		&rm.ID, &rm.Number, &rm.CategoryID, &catName,
		&rm.Floor, &rm.Status, &rm.BasePrice, &rm.Capacity, &rm.Notes,
		&rm.CreatedAt, &rm.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	rm.CategoryName = catName
	return &rm, nil
}

func (r *RoomRepository) Save(ctx context.Context, rm *room.Room) error {
	query := `
		INSERT INTO rooms (id, number, category_id, floor, status, notes, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := r.pool.Exec(ctx, query,
		rm.ID, rm.Number, rm.CategoryID, rm.Floor, rm.Status, rm.Notes, rm.CreatedAt, rm.UpdatedAt,
	)
	return err
}

func (r *RoomRepository) Update(ctx context.Context, rm *room.Room) error {
	query := `
		UPDATE rooms
		SET status = $1, notes = $2, updated_at = $3
		WHERE id = $4
	`
	_, err := r.pool.Exec(ctx, query, rm.Status, rm.Notes, rm.UpdatedAt, rm.ID)
	return err
}

func (r *RoomRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status room.Status) error {
	query := `
		UPDATE rooms
		SET status = $1, updated_at = $2
		WHERE id = $3
	`
	_, err := r.pool.Exec(ctx, query, status, time.Now().UTC(), id)
	return err
}

func (r *RoomRepository) UpdatePrice(ctx context.Context, id uuid.UUID, price float64) error {
	query := `
		UPDATE room_categories c
		SET base_price = $1
		FROM rooms r
		WHERE r.category_id = c.id AND r.id = $2
	`
	_, err := r.pool.Exec(ctx, query, price, id)
	return err
}

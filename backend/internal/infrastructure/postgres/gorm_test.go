package postgres

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestGORMModels_TableNames(t *testing.T) {
	tests := []struct {
		name     string
		model    interface{ TableName() string }
		expected string
	}{
		{"RoomCategoryModel", RoomCategoryModel{}, "room_categories"},
		{"RoomModel", RoomModel{}, "rooms"},
		{"GuestModel", GuestModel{}, "guests"},
		{"StayModel", StayModel{}, "stays"},
		{"ProductModel", ProductModel{}, "products"},
		{"StayChargeModel", StayChargeModel{}, "stay_charges"},
		{"CashShiftModel", CashShiftModel{}, "cash_shifts"},
		{"StayOutboxEventModel", StayOutboxEventModel{}, "stay_outbox_events"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.model.TableName() != tt.expected {
				t.Fatalf("expected table name %s, got %s", tt.expected, tt.model.TableName())
			}
		})
	}
}

func TestGORMModels_Instantiation(t *testing.T) {
	catID := uuid.New()
	cat := RoomCategoryModel{
		ID:        catID,
		Code:      "DLX",
		Name:      "Deluxe Ocean View",
		BasePrice: 200.0,
		Capacity:  2,
		CreatedAt: time.Now().UTC(),
	}

	if cat.Code != "DLX" || cat.BasePrice != 200.0 {
		t.Fatalf("unexpected category fields: %+v", cat)
	}

	room := RoomModel{
		ID:         uuid.New(),
		Number:     "505",
		CategoryID: catID,
		Category:   &cat,
		Floor:      5,
		Status:     "AVAILABLE",
		CreatedAt:  time.Now().UTC(),
		UpdatedAt:  time.Now().UTC(),
	}

	if room.Number != "505" || room.Category.Name != "Deluxe Ocean View" {
		t.Fatalf("unexpected room association: %+v", room)
	}
}

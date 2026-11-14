package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/hotelpremium/backend/internal/domain/room"
	"github.com/hotelpremium/backend/internal/domain/stay"
)

type RoomHandler struct {
	roomRepo    room.Repository
	broadcaster func(event string, data interface{})
}

func NewRoomHandler(roomRepo room.Repository) *RoomHandler {
	return &RoomHandler{roomRepo: roomRepo}
}

func (h *RoomHandler) WithBroadcaster(fn func(event string, data interface{})) *RoomHandler {
	h.broadcaster = fn
	return h
}

func (h *RoomHandler) ListRooms(w http.ResponseWriter, r *http.Request) {
	rooms, err := h.roomRepo.FindAll(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to fetch rooms"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(rooms)
}

func (h *RoomHandler) GetRoomByID(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid room id format"}`, http.StatusBadRequest)
		return
	}

	rm, err := h.roomRepo.FindByID(r.Context(), id)
	if err != nil || rm == nil {
		http.Error(w, `{"error":"room not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(rm)
}

func isValidRoomStatus(st room.Status) bool {
	switch st {
	case room.StatusAvailable, room.StatusOccupied, room.StatusDirty, room.StatusCleaning, room.StatusMaintenance, room.StatusBlocked:
		return true
	default:
		return false
	}
}

func (h *RoomHandler) UpdateRoomStatus(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid room id format"}`, http.StatusBadRequest)
		return
	}

	var payload struct {
		Status room.Status `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || !isValidRoomStatus(payload.Status) {
		http.Error(w, `{"error":"invalid room status value"}`, http.StatusBadRequest)
		return
	}

	if err := h.roomRepo.UpdateStatus(r.Context(), id, payload.Status); err != nil {
		http.Error(w, `{"error":"failed to update room status"}`, http.StatusInternalServerError)
		return
	}

	if h.broadcaster != nil {
		h.broadcaster("room_updated", map[string]interface{}{
			"room_id": id.String(),
			"status":  payload.Status,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "room status updated successfully"})
}

func (h *RoomHandler) UpdateRoomPrice(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid room id format"}`, http.StatusBadRequest)
		return
	}

	var payload struct {
		Price float64 `json:"price"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.Price <= 0 {
		http.Error(w, `{"error":"invalid price value"}`, http.StatusBadRequest)
		return
	}

	roundedPrice := stay.RoundCurrency(payload.Price)
	if err := h.roomRepo.UpdatePrice(r.Context(), id, roundedPrice); err != nil {
		http.Error(w, `{"error":"failed to update room price"}`, http.StatusInternalServerError)
		return
	}

	if h.broadcaster != nil {
		h.broadcaster("room_price_updated", map[string]interface{}{
			"room_id":    id.String(),
			"base_price": roundedPrice,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "room price updated successfully"})
}

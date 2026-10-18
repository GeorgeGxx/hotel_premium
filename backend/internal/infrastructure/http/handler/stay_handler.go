package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/hotelpremium/backend/internal/domain/stay"
)

type StayHandler struct {
	stayRepo stay.Repository
}

func NewStayHandler(stayRepo stay.Repository) *StayHandler {
	return &StayHandler{stayRepo: stayRepo}
}

func (h *StayHandler) ListStays(w http.ResponseWriter, r *http.Request) {
	statusQuery := r.URL.Query().Get("status")
	var statusPtr *stay.Status
	if statusQuery != "" {
		st := stay.Status(statusQuery)
		statusPtr = &st
	}

	stays, err := h.stayRepo.FindAll(r.Context(), statusPtr)
	if err != nil {
		http.Error(w, `{"error":"failed to fetch reservations"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(stays)
}

func (h *StayHandler) GetStayByID(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid stay id format"}`, http.StatusBadRequest)
		return
	}

	stayDetails, err := h.stayRepo.FindByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, stay.ErrStayNotFound) {
			http.Error(w, `{"error":"reservation not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"failed to fetch reservation details"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(stayDetails)
}

type CreateStayRequest struct {
	RoomID         string  `json:"room_id"`
	GuestName      string  `json:"guest_name"`
	GuestEmail     string  `json:"guest_email"`
	GuestPhone     string  `json:"guest_phone"`
	DocumentType   string  `json:"document_type"`
	DocumentNumber string  `json:"document_number"`
	CheckInDate    string  `json:"check_in_date"`
	CheckOutDate   string  `json:"check_out_date"`
	TotalNights    int     `json:"total_nights"`
	NightlyRate    float64 `json:"nightly_rate"`
	DepositAmount  float64 `json:"deposit_amount"`
	Notes          string  `json:"notes"`
	Status         string  `json:"status"` // 'RESERVED' or 'ACTIVE'
}

func (h *StayHandler) CreateStay(w http.ResponseWriter, r *http.Request) {
	var req CreateStayRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid json request payload"}`, http.StatusBadRequest)
		return
	}

	roomUUID, err := uuid.Parse(req.RoomID)
	if err != nil {
		http.Error(w, `{"error":"invalid room_id uuid"}`, http.StatusBadRequest)
		return
	}

	// Parse Dates (supports YYYY-MM-DD or RFC3339)
	var checkIn, checkOut time.Time
	if len(req.CheckInDate) == 10 {
		checkIn, err = time.Parse("2006-01-02", req.CheckInDate)
	} else {
		checkIn, err = time.Parse(time.RFC3339, req.CheckInDate)
	}
	if err != nil {
		checkIn = time.Now().UTC()
	}

	if len(req.CheckOutDate) == 10 {
		checkOut, err = time.Parse("2006-01-02", req.CheckOutDate)
	} else {
		checkOut, err = time.Parse(time.RFC3339, req.CheckOutDate)
	}
	if err != nil {
		nights := req.TotalNights
		if nights < 1 {
			nights = 1
		}
		checkOut = checkIn.AddDate(0, 0, nights)
	}

	if req.TotalNights < 1 {
		req.TotalNights = int(checkOut.Sub(checkIn).Hours() / 24)
		if req.TotalNights < 1 {
			req.TotalNights = 1
		}
	}

	stStatus := stay.Status(req.Status)
	if stStatus == "" {
		stStatus = stay.StatusReserved
	}

	input := stay.CreateStayInput{
		RoomID:         roomUUID,
		GuestName:      req.GuestName,
		GuestEmail:     req.GuestEmail,
		GuestPhone:     req.GuestPhone,
		DocumentType:   req.DocumentType,
		DocumentNumber: req.DocumentNumber,
		CheckInDate:    checkIn,
		CheckOutDate:   checkOut,
		TotalNights:    req.TotalNights,
		NightlyRate:    req.NightlyRate,
		DepositAmount:  req.DepositAmount,
		Notes:          req.Notes,
		Status:         stStatus,
	}

	createdStay, err := h.stayRepo.Create(r.Context(), input)
	if err != nil {
		if errors.Is(err, stay.ErrRoomAlreadyBooked) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusConflict)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "Room is already booked for the specified dates.",
			})
			return
		}
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(createdStay)
}

type UpdateStayRequest struct {
	CheckInDate   *string  `json:"check_in_date,omitempty"`
	CheckOutDate  *string  `json:"check_out_date,omitempty"`
	TotalNights   *int     `json:"total_nights,omitempty"`
	NightlyRate   *float64 `json:"nightly_rate,omitempty"`
	DepositAmount *float64 `json:"deposit_amount,omitempty"`
	Notes         *string  `json:"notes,omitempty"`
}

func (h *StayHandler) UpdateStay(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid stay id format"}`, http.StatusBadRequest)
		return
	}

	var req UpdateStayRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid json request payload"}`, http.StatusBadRequest)
		return
	}

	var input stay.UpdateStayInput
	if req.CheckInDate != nil {
		var t time.Time
		if len(*req.CheckInDate) == 10 {
			t, err = time.Parse("2006-01-02", *req.CheckInDate)
		} else {
			t, err = time.Parse(time.RFC3339, *req.CheckInDate)
		}
		if err == nil {
			input.CheckInDate = &t
		}
	}
	if req.CheckOutDate != nil {
		var t time.Time
		if len(*req.CheckOutDate) == 10 {
			t, err = time.Parse("2006-01-02", *req.CheckOutDate)
		} else {
			t, err = time.Parse(time.RFC3339, *req.CheckOutDate)
		}
		if err == nil {
			input.CheckOutDate = &t
		}
	}
	input.TotalNights = req.TotalNights
	input.NightlyRate = req.NightlyRate
	input.DepositAmount = req.DepositAmount
	input.Notes = req.Notes

	updatedStay, err := h.stayRepo.Update(r.Context(), id, input)
	if err != nil {
		if errors.Is(err, stay.ErrRoomAlreadyBooked) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusConflict)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "Room is already booked for the updated date range.",
			})
			return
		}
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(updatedStay)
}

func (h *StayHandler) CancelStay(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid stay id format"}`, http.StatusBadRequest)
		return
	}

	if err := h.stayRepo.Cancel(r.Context(), id); err != nil {
		if errors.Is(err, stay.ErrStayNotFound) {
			http.Error(w, `{"error":"reservation not found"}`, http.StatusNotFound)
			return
		}
		if errors.Is(err, stay.ErrStayAlreadyFinished) {
			http.Error(w, `{"error":"reservation is already completed or cancelled"}`, http.StatusConflict)
			return
		}
		http.Error(w, `{"error":"failed to cancel reservation"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "reservation cancelled successfully"})
}

func (h *StayHandler) CheckOutStay(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid stay id format"}`, http.StatusBadRequest)
		return
	}

	if err := h.stayRepo.CheckOut(r.Context(), id); err != nil {
		if errors.Is(err, stay.ErrStayNotFound) {
			http.Error(w, `{"error":"reservation not found"}`, http.StatusNotFound)
			return
		}
		if errors.Is(err, stay.ErrStayAlreadyFinished) {
			http.Error(w, `{"error":"stay is not active or already checked out"}`, http.StatusConflict)
			return
		}
		http.Error(w, `{"error":"failed to process check-out"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "check-out completed successfully, room marked for cleaning"})
}

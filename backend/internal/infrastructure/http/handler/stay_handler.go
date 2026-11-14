package handler

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/hotelpremium/backend/internal/domain/stay"
)

type StayHandler struct {
	stayRepo    stay.Repository
	broadcaster func(event string, data interface{})
}

func NewStayHandler(stayRepo stay.Repository) *StayHandler {
	return &StayHandler{stayRepo: stayRepo}
}

func (h *StayHandler) WithBroadcaster(fn func(event string, data interface{})) *StayHandler {
	h.broadcaster = fn
	return h
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

func parseFlexibleDate(raw string) (time.Time, error) {
	trimmed := strings.TrimSpace(raw)
	if len(trimmed) == 10 {
		return time.Parse("2006-01-02", trimmed)
	}
	return time.Parse(time.RFC3339, trimmed)
}

func ParseCreateStayInput(req CreateStayRequest) (stay.CreateStayInput, error) {
	roomUUID, err := uuid.Parse(req.RoomID)
	if err != nil {
		return stay.CreateStayInput{}, errors.New("invalid room_id uuid")
	}

	if strings.TrimSpace(req.GuestName) == "" {
		return stay.CreateStayInput{}, errors.New("guest_name is required")
	}
	if req.DepositAmount < 0 {
		return stay.CreateStayInput{}, errors.New("deposit_amount cannot be negative")
	}

	var checkIn, checkOut time.Time
	if strings.TrimSpace(req.CheckInDate) == "" {
		checkIn = time.Now().UTC()
	} else {
		checkIn, err = parseFlexibleDate(req.CheckInDate)
		if err != nil {
			return stay.CreateStayInput{}, errors.New("invalid check_in_date format: must be YYYY-MM-DD or RFC3339")
		}
	}

	if strings.TrimSpace(req.CheckOutDate) == "" {
		nights := req.TotalNights
		if nights < 1 {
			nights = 1
		}
		checkOut = checkIn.AddDate(0, 0, nights)
	} else {
		checkOut, err = parseFlexibleDate(req.CheckOutDate)
		if err != nil {
			return stay.CreateStayInput{}, errors.New("invalid check_out_date format: must be YYYY-MM-DD or RFC3339")
		}
	}

	if !checkOut.After(checkIn) {
		return stay.CreateStayInput{}, stay.ErrInvalidDateRange
	}

	if req.TotalNights < 1 {
		req.TotalNights = int(checkOut.Sub(checkIn).Hours() / 24)
		if req.TotalNights < 1 {
			req.TotalNights = 1
		}
	}

	stStatus := stay.Status(strings.ToUpper(strings.TrimSpace(req.Status)))
	if stStatus != stay.StatusReserved && stStatus != stay.StatusActive {
		if checkIn.After(time.Now().UTC().Add(2 * time.Hour)) {
			stStatus = stay.StatusReserved
		} else {
			stStatus = stay.StatusActive
		}
	}

	return stay.CreateStayInput{
		RoomID:         roomUUID,
		GuestName:      strings.TrimSpace(req.GuestName),
		GuestEmail:     strings.TrimSpace(req.GuestEmail),
		GuestPhone:     strings.TrimSpace(req.GuestPhone),
		DocumentType:   strings.TrimSpace(req.DocumentType),
		DocumentNumber: strings.TrimSpace(req.DocumentNumber),
		CheckInDate:    checkIn,
		CheckOutDate:   checkOut,
		TotalNights:    req.TotalNights,
		NightlyRate:    stay.RoundCurrency(req.NightlyRate),
		DepositAmount:  stay.RoundCurrency(req.DepositAmount),
		Notes:          req.Notes,
		Status:         stStatus,
	}, nil
}

func (h *StayHandler) CreateStay(w http.ResponseWriter, r *http.Request) {
	var req CreateStayRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid json request payload"}`, http.StatusBadRequest)
		return
	}

	if strings.HasSuffix(r.URL.Path, "/check-in") && req.Status == "" {
		req.Status = string(stay.StatusActive)
	}

	input, err := ParseCreateStayInput(req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
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
		if errors.Is(err, stay.ErrRoomNotReadyForCheckIn) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusConflict)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": err.Error(),
			})
			return
		}
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	if h.broadcaster != nil {
		h.broadcaster("stay_created", createdStay)
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
		t, err := parseFlexibleDate(*req.CheckInDate)
		if err != nil {
			http.Error(w, `{"error":"invalid check_in_date format"}`, http.StatusBadRequest)
			return
		}
		input.CheckInDate = &t
	}
	if req.CheckOutDate != nil {
		t, err := parseFlexibleDate(*req.CheckOutDate)
		if err != nil {
			http.Error(w, `{"error":"invalid check_out_date format"}`, http.StatusBadRequest)
			return
		}
		input.CheckOutDate = &t
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
		if errors.Is(err, stay.ErrStayNotFound) {
			http.Error(w, `{"error":"reservation not found"}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	if h.broadcaster != nil {
		h.broadcaster("stay_updated", updatedStay)
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

	if h.broadcaster != nil {
		h.broadcaster("stay_cancelled", map[string]string{"stay_id": id.String()})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "reservation cancelled successfully"})
}

type CheckOutSettlementRequest struct {
	DepositAmount *float64 `json:"deposit_amount,omitempty"`
	PaymentStatus *string  `json:"payment_status,omitempty"`
	Notes         *string  `json:"notes,omitempty"`
}

func (h *StayHandler) CheckOutStay(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid stay id format"}`, http.StatusBadRequest)
		return
	}

	// Optional folio settlement body before completing check-out
	if r.Body != nil {
		var settlement CheckOutSettlementRequest
		if err := json.NewDecoder(r.Body).Decode(&settlement); err != nil && !errors.Is(err, io.EOF) {
			http.Error(w, `{"error":"invalid check-out settlement payload"}`, http.StatusBadRequest)
			return
		}
		if settlement.DepositAmount != nil || settlement.Notes != nil {
			_, err := h.stayRepo.Update(r.Context(), id, stay.UpdateStayInput{
				DepositAmount: settlement.DepositAmount,
				Notes:         settlement.Notes,
			})
			if err != nil && !errors.Is(err, stay.ErrStayNotFound) {
				http.Error(w, `{"error":"failed to settle folio balance prior to check-out"}`, http.StatusBadRequest)
				return
			}
		}
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
		if errors.Is(err, stay.ErrOutstandingBalance) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusConflict)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": err.Error(),
			})
			return
		}
		http.Error(w, `{"error":"failed to process check-out"}`, http.StatusInternalServerError)
		return
	}

	if h.broadcaster != nil {
		h.broadcaster("stay_checked_out", map[string]string{"stay_id": id.String()})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "check-out completed successfully, room marked for cleaning"})
}

package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/hotelpremium/backend/internal/domain/billing"
)

type BillingHandler struct {
	billingRepo billing.Repository
}

func NewBillingHandler(billingRepo billing.Repository) *BillingHandler {
	return &BillingHandler{billingRepo: billingRepo}
}

func (h *BillingHandler) ListProducts(w http.ResponseWriter, r *http.Request) {
	products, err := h.billingRepo.ListProducts(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to fetch products"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(products)
}

func (h *BillingHandler) AddStayCharge(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		StayID      string  `json:"stay_id"`
		ProductID   *string `json:"product_id,omitempty"`
		Description string  `json:"description"`
		Quantity    int     `json:"quantity"`
		UnitPrice   float64 `json:"unit_price"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}

	stayUUID, err := uuid.Parse(payload.StayID)
	if err != nil {
		http.Error(w, `{"error":"invalid stay_id"}`, http.StatusBadRequest)
		return
	}

	var productUUID *uuid.UUID
	if payload.ProductID != nil && *payload.ProductID != "" {
		if pid, err := uuid.Parse(*payload.ProductID); err == nil {
			productUUID = &pid
		}
	}

	if payload.Quantity < 1 {
		payload.Quantity = 1
	}

	charge := &billing.StayCharge{
		ID:          uuid.New(),
		StayID:      stayUUID,
		ProductID:   productUUID,
		Description: payload.Description,
		Quantity:    payload.Quantity,
		UnitPrice:   payload.UnitPrice,
		TotalPrice:  float64(payload.Quantity) * payload.UnitPrice,
		CreatedAt:   time.Now().UTC(),
	}

	if err := h.billingRepo.AddCharge(r.Context(), charge); err != nil {
		http.Error(w, `{"error":"failed to record charge"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(charge)
}

func (h *BillingHandler) ListStayCharges(w http.ResponseWriter, r *http.Request) {
	stayIDStr := r.PathValue("id")
	stayUUID, err := uuid.Parse(stayIDStr)
	if err != nil {
		http.Error(w, `{"error":"invalid stay_id format"}`, http.StatusBadRequest)
		return
	}

	charges, err := h.billingRepo.ListChargesByStayID(r.Context(), stayUUID)
	if err != nil {
		http.Error(w, `{"error":"failed to fetch charges"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(charges)
}

func (h *BillingHandler) OpenCashShift(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		UserID        string  `json:"user_id"`
		OpeningAmount float64 `json:"opening_amount"`
		Notes         string  `json:"notes"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"invalid payload"}`, http.StatusBadRequest)
		return
	}

	userUUID, err := uuid.Parse(payload.UserID)
	if err != nil {
		userUUID = uuid.New() // Fallback user
	}

	shift, err := h.billingRepo.OpenShift(r.Context(), userUUID, payload.OpeningAmount, payload.Notes)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(shift)
}

func (h *BillingHandler) CloseCashShift(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	shiftID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"invalid shift id"}`, http.StatusBadRequest)
		return
	}

	var payload struct {
		ActualAmount float64 `json:"actual_amount"`
		Notes        string  `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"invalid payload"}`, http.StatusBadRequest)
		return
	}

	shift, err := h.billingRepo.CloseShift(r.Context(), shiftID, payload.ActualAmount, payload.Notes)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(shift)
}

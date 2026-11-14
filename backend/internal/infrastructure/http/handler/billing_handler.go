package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/hotelpremium/backend/internal/domain/billing"
	"github.com/hotelpremium/backend/internal/domain/stay"
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
		pid, err := uuid.Parse(*payload.ProductID)
		if err != nil {
			http.Error(w, `{"error":"invalid product_id"}`, http.StatusBadRequest)
			return
		}
		productUUID = &pid
	}

	if payload.Quantity < 1 {
		payload.Quantity = 1
	}

	if productUUID == nil {
		if payload.UnitPrice <= 0 {
			http.Error(w, `{"error":"unit_price must be greater than zero"}`, http.StatusBadRequest)
			return
		}
		if strings.TrimSpace(payload.Description) == "" {
			http.Error(w, `{"error":"description is required for custom folio charges"}`, http.StatusBadRequest)
			return
		}
	}

	unitPrice := stay.RoundCurrency(payload.UnitPrice)
	charge := &billing.StayCharge{
		ID:          uuid.New(),
		StayID:      stayUUID,
		ProductID:   productUUID,
		Description: strings.TrimSpace(payload.Description),
		Quantity:    payload.Quantity,
		UnitPrice:   unitPrice,
		TotalPrice:  stay.RoundCurrency(float64(payload.Quantity) * unitPrice),
		CreatedAt:   time.Now().UTC(),
	}

	if err := h.billingRepo.AddCharge(r.Context(), charge); err != nil {
		if errors.Is(err, billing.ErrProductNotFound) {
			http.Error(w, `{"error":"product not found"}`, http.StatusNotFound)
			return
		}
		if errors.Is(err, billing.ErrInsufficientStock) {
			http.Error(w, `{"error":"insufficient product stock"}`, http.StatusConflict)
			return
		}
		if errors.Is(err, billing.ErrInvalidAmount) {
			http.Error(w, `{"error":"invalid charge amount"}`, http.StatusBadRequest)
			return
		}
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
	if payload.OpeningAmount < 0 {
		http.Error(w, `{"error":"opening_amount must be non-negative"}`, http.StatusBadRequest)
		return
	}

	userUUID, err := uuid.Parse(payload.UserID)
	if err != nil {
		userUUID = uuid.New()
	}

	shift, err := h.billingRepo.OpenShift(r.Context(), userUUID, stay.RoundCurrency(payload.OpeningAmount), payload.Notes)
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
	if payload.ActualAmount < 0 {
		http.Error(w, `{"error":"actual_amount must be non-negative"}`, http.StatusBadRequest)
		return
	}

	shift, err := h.billingRepo.CloseShift(r.Context(), shiftID, stay.RoundCurrency(payload.ActualAmount), payload.Notes)
	if err != nil {
		if errors.Is(err, billing.ErrShiftAlreadyClosed) {
			http.Error(w, `{"error":"cash shift is already closed"}`, http.StatusConflict)
			return
		}
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(shift)
}

package telemetry

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// Category Revenue Gauge Vector in USD
	CategoryRevenueUSD = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace: "hotel",
			Subsystem: "revenue",
			Name:      "by_category_usd",
			Help:      "Total generated revenue broken down by room category in USD.",
		},
		[]string{"category"},
	)

	// ADR: Average Daily Rate in USD
	ADRUSD = promauto.NewGauge(
		prometheus.GaugeOpts{
			Namespace: "hotel",
			Subsystem: "revenue",
			Name:      "adr_usd",
			Help:      "Average Daily Rate (ADR) across occupied rooms in USD.",
		},
	)

	// RevPAR: Revenue Per Available Room in USD
	RevPARUSD = promauto.NewGauge(
		prometheus.GaugeOpts{
			Namespace: "hotel",
			Subsystem: "revenue",
			Name:      "revpar_usd",
			Help:      "Revenue Per Available Room (RevPAR) in USD.",
		},
	)

	// TRevPAR: Total Revenue Per Available Room (including POS/Concierge ancillary revenue) in USD
	TRevPARUSD = promauto.NewGauge(
		prometheus.GaugeOpts{
			Namespace: "hotel",
			Subsystem: "revenue",
			Name:      "trevpar_usd",
			Help:      "Total Revenue Per Available Room (TRevPAR) including ancillary services in USD.",
		},
	)

	// Ancillary POS & Concierge Revenue in USD
	AncillaryRevenueUSD = promauto.NewGauge(
		prometheus.GaugeOpts{
			Namespace: "hotel",
			Subsystem: "revenue",
			Name:      "ancillary_usd",
			Help:      "Ancillary revenue from Spa, Bar, Gourmet Breakfast and Limousine transfers in USD.",
		},
	)

	// Gross Total Revenue Counter in USD
	TotalRevenueUSD = promauto.NewCounter(
		prometheus.CounterOpts{
			Namespace: "hotel",
			Subsystem: "revenue",
			Name:      "total_usd",
			Help:      "Cumulative gross room revenue in USD.",
		},
	)

	// Folio Deposits Collected in USD
	FolioDepositsUSD = promauto.NewGauge(
		prometheus.GaugeOpts{
			Namespace: "hotel",
			Subsystem: "folio",
			Name:      "deposits_collected_usd",
			Help:      "Total guest deposits collected across active and reserved stays in USD.",
		},
	)

	// Folio Pending Balance in USD
	FolioPendingBalanceUSD = promauto.NewGauge(
		prometheus.GaugeOpts{
			Namespace: "hotel",
			Subsystem: "folio",
			Name:      "balance_pending_usd",
			Help:      "Total outstanding guest folio balance pending settlement at checkout in USD.",
		},
	)

	// Real-time Physical Occupancy Rate in Percentage
	OccupancyRatePercent = promauto.NewGauge(
		prometheus.GaugeOpts{
			Namespace: "hotel",
			Subsystem: "occupancy",
			Name:      "rate_percent",
			Help:      "Current physical room occupancy rate percentage (0-100).",
		},
	)

	// Physical Rooms Inventory by Status
	RoomsByStatus = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace: "hotel",
			Subsystem: "rooms",
			Name:      "status_total",
			Help:      "Current number of physical rooms grouped by operational status.",
		},
		[]string{"status"},
	)

	// Reservations & Stays by Lifecycle Status
	StaysByStatus = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace: "hotel",
			Subsystem: "stays",
			Name:      "status_total",
			Help:      "Current number of guest stays grouped by lifecycle status.",
		},
		[]string{"status"},
	)

	// LoS: Length of Stay in Nights
	AvgLengthOfStay = promauto.NewGauge(
		prometheus.GaugeOpts{
			Namespace: "hotel",
			Subsystem: "kpi",
			Name:      "los_nights",
			Help:      "Average length of stay in nights.",
		},
	)

	// Monthly Cancellation Rate in Percentage
	CancellationRate = promauto.NewGauge(
		prometheus.GaugeOpts{
			Namespace: "hotel",
			Subsystem: "kpi",
			Name:      "cancellation_rate",
			Help:      "Monthly reservation cancellation percentage.",
		},
	)

	// RED Method: Microservice HTTP Request Counter
	HTTPRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "hotel",
			Subsystem: "http",
			Name:      "requests_total",
			Help:      "Total number of HTTP requests processed by microservice, method, route and status code.",
		},
		[]string{"service", "method", "route", "status"},
	)

	// RED Method: Microservice HTTP Request Duration Histogram
	HTTPRequestDurationSeconds = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "hotel",
			Subsystem: "http",
			Name:      "request_duration_seconds",
			Help:      "HTTP request latency distribution in seconds by microservice, method and route.",
			Buckets:   []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5},
		},
		[]string{"service", "method", "route"},
	)

	// Active SSE Clients Connected
	SSEActiveClients = promauto.NewGauge(
		prometheus.GaugeOpts{
			Namespace: "hotel",
			Subsystem: "sse",
			Name:      "active_clients",
			Help:      "Number of currently connected real-time Server-Sent Events (SSE) clients.",
		},
	)

	// Total SSE Events Broadcasted
	SSEBroadcastsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "hotel",
			Subsystem: "sse",
			Name:      "events_broadcast_total",
			Help:      "Total number of real-time SSE events broadcasted to front desk and guest portals.",
		},
		[]string{"event"},
	)
)

func InitBusinessMetrics() {
	// Initialize default realistic business values (overridden dynamically by live PostgreSQL collector)
	CategoryRevenueUSD.WithLabelValues("Presidential Suite").Set(12500)
	CategoryRevenueUSD.WithLabelValues("Double Deluxe").Set(8200)
	CategoryRevenueUSD.WithLabelValues("Single Standard").Set(3100)

	ADRUSD.Set(145.50)
	RevPARUSD.Set(112.75)
	TRevPARUSD.Set(138.40)
	AncillaryRevenueUSD.Set(4280.00)
	TotalRevenueUSD.Add(23800)
	FolioDepositsUSD.Set(16450.00)
	FolioPendingBalanceUSD.Set(7350.00)
	OccupancyRatePercent.Set(66.7)

	RoomsByStatus.WithLabelValues("AVAILABLE").Set(4)
	RoomsByStatus.WithLabelValues("OCCUPIED").Set(1)
	RoomsByStatus.WithLabelValues("DIRTY").Set(1)
	RoomsByStatus.WithLabelValues("MAINTENANCE").Set(0)

	StaysByStatus.WithLabelValues("ACTIVE").Set(1)
	StaysByStatus.WithLabelValues("RESERVED").Set(2)
	StaysByStatus.WithLabelValues("CHECKED_OUT").Set(4)
	StaysByStatus.WithLabelValues("CANCELLED").Set(0)

	AvgLengthOfStay.Set(2.8)
	CancellationRate.Set(4.2)
}

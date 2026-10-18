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

	// Gross Total Revenue Counter in USD
	TotalRevenueUSD = promauto.NewCounter(
		prometheus.CounterOpts{
			Namespace: "hotel",
			Subsystem: "revenue",
			Name:      "total_usd",
			Help:      "Cumulative gross room revenue in USD.",
		},
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
)

func InitBusinessMetrics() {
	// Initialize default realistic business values
	CategoryRevenueUSD.WithLabelValues("Presidential Suite").Set(12500)
	CategoryRevenueUSD.WithLabelValues("Double Deluxe").Set(8200)
	CategoryRevenueUSD.WithLabelValues("Single Standard").Set(3100)

	ADRUSD.Set(145.50)
	RevPARUSD.Set(112.75)
	TotalRevenueUSD.Add(23800)
	AvgLengthOfStay.Set(2.8)
	CancellationRate.Set(4.2)
}

package http

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hotelpremium/backend/internal/application/saga"
	"github.com/hotelpremium/backend/internal/domain/stay"
	"github.com/hotelpremium/backend/internal/infrastructure/http/handler"
	"github.com/hotelpremium/backend/internal/infrastructure/telemetry"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	"go.opentelemetry.io/otel/trace"
)

// GinAdapter bridges Go 1.26 http.HandlerFunc to Gin v1.12.0 gin.HandlerFunc
// synchronizing Gin path parameters into r.SetPathValue for seamless handler execution
func GinAdapter(fn http.HandlerFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		for _, p := range c.Params {
			c.Request.SetPathValue(p.Key, p.Value)
		}
		fn(c.Writer, c.Request)
	}
}

// GinStructuredLogger outputs structured slog JSON records with latency and OpenTelemetry trace IDs
func GinStructuredLogger(serviceName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		c.Next()

		var traceID string
		span := trace.SpanFromContext(c.Request.Context())
		if span.SpanContext().IsValid() {
			traceID = span.SpanContext().TraceID().String()
		}

		if raw != "" {
			path = path + "?" + raw
		}

		slog.Info("Gin HTTP Request",
			"service", serviceName,
			"status", c.Writer.Status(),
			"method", c.Request.Method,
			"path", path,
			"client_ip", c.ClientIP(),
			"latency_ms", time.Since(start).Milliseconds(),
			"trace_id", traceID,
		)
	}
}

// GinTelemetryMiddleware extracts distributed tracing context and starts server spans in Tempo
func GinTelemetryMiddleware(serviceName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if telemetry.Tracer == nil {
			c.Next()
			return
		}

		spanName := serviceName + ": " + c.Request.Method + " " + c.FullPath()
		if c.FullPath() == "" {
			spanName = serviceName + ": " + c.Request.Method + " " + c.Request.URL.Path
		}

		ctx, span := telemetry.Tracer.Start(c.Request.Context(), spanName,
			trace.WithSpanKind(trace.SpanKindServer),
		)
		defer span.End()

		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}

// GinCORSMiddleware ensures unified CORS headers across all microservices
func GinCORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, traceparent, X-User-Role")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// NewGinBaseEngine creates a standardized Gin v1.12.0 engine with production middlewares and SSE live feed
func NewGinBaseEngine(serviceName string) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	engine := gin.New()

	engine.Use(gin.Recovery())
	engine.Use(GinCORSMiddleware())
	engine.Use(GinTelemetryMiddleware(serviceName))
	engine.Use(GinStructuredLogger(serviceName))

	// System & Observability endpoints
	engine.GET("/api/v1/health", GinAdapter(handler.HealthCheck))
	engine.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Server-Sent Events (SSE) Live Feed for real-time front desk updates
	engine.GET("/api/v1/events/live", GlobalSSEHub.Handler())

	return engine
}

// NewGinRoomEngine builds the Gin v1.12.0 router for room-service
func NewGinRoomEngine(roomHandler *handler.RoomHandler) *gin.Engine {
	engine := NewGinBaseEngine("room-service")

	if roomHandler != nil {
		rooms := engine.Group("/api/v1/rooms")
		{
			rooms.GET("", GinAdapter(roomHandler.ListRooms))
			rooms.GET("/:id", GinAdapter(roomHandler.GetRoomByID))
			rooms.PATCH("/:id/status", GinAdapter(roomHandler.UpdateRoomStatus))
			// Admin-only price update protected by Zero-Trust RBAC
			rooms.PATCH("/:id/price", GinRBACMiddleware(RoleAdmin), GinAdapter(roomHandler.UpdateRoomPrice))
		}
	}

	return engine
}

// NewGinStayEngine builds the Gin v1.12.0 router for stay-service with Saga Orchestrator and Idempotency support
func NewGinStayEngine(stayHandler *handler.StayHandler, sagaOrchestrator *saga.BookingSagaOrchestrator, redisClients ...*redis.Client) *gin.Engine {
	engine := NewGinBaseEngine("stay-service")

	var rc *redis.Client
	if len(redisClients) > 0 {
		rc = redisClients[0]
	}

	if stayHandler != nil {
		stays := engine.Group("/api/v1/stays")
		if rc != nil {
			stays.Use(GinIdempotencyMiddleware(rc, 24*time.Hour))
		}
		{
			stays.GET("", GinAdapter(stayHandler.ListStays))
			stays.GET("/:id", GinAdapter(stayHandler.GetStayByID))
			stays.POST("", GinAdapter(stayHandler.CreateStay))
			stays.POST("/check-in", GinAdapter(stayHandler.CreateStay))
			stays.PUT("/:id", GinAdapter(stayHandler.UpdateStay))
			stays.PATCH("/:id", GinAdapter(stayHandler.UpdateStay))
			stays.PATCH("/:id/cancel", GinAdapter(stayHandler.CancelStay))
			stays.DELETE("/:id", GinAdapter(stayHandler.CancelStay))
			stays.POST("/:id/check-out", GinAdapter(stayHandler.CheckOutStay))

			// Distributed Saga Booking endpoint with automated compensating rollbacks
			if sagaOrchestrator != nil {
				stays.POST("/saga-booking", func(c *gin.Context) {
					var input stay.CreateStayInput
					if err := c.ShouldBindJSON(&input); err != nil {
						c.JSON(http.StatusBadRequest, gin.H{"error": "invalid saga booking payload"})
						return
					}

					userRole := c.GetString("user_role")
					if userRole == "" {
						userRole = RoleUser
					}

					result, err := sagaOrchestrator.Execute(c.Request.Context(), input, userRole)
					if err != nil {
						c.JSON(http.StatusConflict, result)
						return
					}

					c.JSON(http.StatusCreated, result)
				})
			}
		}
	}

	return engine
}

// NewGinBillingEngine builds the Gin v1.12.0 router for billing-service with Idempotency support
func NewGinBillingEngine(billingHandler *handler.BillingHandler, redisClients ...*redis.Client) *gin.Engine {
	engine := NewGinBaseEngine("billing-service")

	var rc *redis.Client
	if len(redisClients) > 0 {
		rc = redisClients[0]
	}

	if billingHandler != nil {
		billingGroup := engine.Group("/api/v1/billing")
		if rc != nil {
			billingGroup.Use(GinIdempotencyMiddleware(rc, 24*time.Hour))
		}
		{
			billingGroup.GET("/products", GinAdapter(billingHandler.ListProducts))
			billingGroup.POST("/charges", GinAdapter(billingHandler.AddStayCharge))
			billingGroup.GET("/stays/:id/charges", GinAdapter(billingHandler.ListStayCharges))
			// Shift sensitive operations protected by Zero-Trust RBAC
			billingGroup.POST("/shifts/open", GinRBACMiddleware(RoleAdmin), GinAdapter(billingHandler.OpenCashShift))
			billingGroup.POST("/shifts/:id/close", GinRBACMiddleware(RoleAdmin), GinAdapter(billingHandler.CloseCashShift))
		}
	}

	return engine
}

// NewGinUnifiedEngine builds an all-in-one Gin engine for testing or monolithic fallback
func NewGinUnifiedEngine(deps RouterDependencies, sagaOrchestrator *saga.BookingSagaOrchestrator) *gin.Engine {
	engine := NewGinBaseEngine("hotel-unified")

	if deps.RoomHandler != nil {
		rooms := engine.Group("/api/v1/rooms")
		{
			rooms.GET("", GinAdapter(deps.RoomHandler.ListRooms))
			rooms.GET("/:id", GinAdapter(deps.RoomHandler.GetRoomByID))
			rooms.PATCH("/:id/status", GinAdapter(deps.RoomHandler.UpdateRoomStatus))
			rooms.PATCH("/:id/price", GinRBACMiddleware(RoleAdmin), GinAdapter(deps.RoomHandler.UpdateRoomPrice))
		}
	}

	if deps.StayHandler != nil {
		stays := engine.Group("/api/v1/stays")
		{
			stays.GET("", GinAdapter(deps.StayHandler.ListStays))
			stays.GET("/:id", GinAdapter(deps.StayHandler.GetStayByID))
			stays.POST("", GinAdapter(deps.StayHandler.CreateStay))
			stays.POST("/check-in", GinAdapter(deps.StayHandler.CreateStay))
			stays.PUT("/:id", GinAdapter(deps.StayHandler.UpdateStay))
			stays.PATCH("/:id", GinAdapter(deps.StayHandler.UpdateStay))
			stays.PATCH("/:id/cancel", GinAdapter(deps.StayHandler.CancelStay))
			stays.DELETE("/:id", GinAdapter(deps.StayHandler.CancelStay))
			stays.POST("/:id/check-out", GinAdapter(deps.StayHandler.CheckOutStay))
		}
	}

	return engine
}

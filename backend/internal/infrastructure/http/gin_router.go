package http

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hotelpremium/backend/internal/application/saga"
	"github.com/hotelpremium/backend/internal/infrastructure/http/handler"
	"github.com/hotelpremium/backend/internal/infrastructure/http/swagger"
	"github.com/hotelpremium/backend/internal/infrastructure/telemetry"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
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
		if telemetry.Tracer == nil || c.Request.URL.Path == "/metrics" || c.Request.URL.Path == "/api/v1/health" || c.Request.URL.Path == "/health" {
			c.Next()
			return
		}

		spanName := serviceName + ": " + c.Request.Method + " " + c.FullPath()
		if c.FullPath() == "" {
			spanName = serviceName + ": " + c.Request.Method + " " + c.Request.URL.Path
		}

		ctx := otel.GetTextMapPropagator().Extract(c.Request.Context(), propagation.HeaderCarrier(c.Request.Header))
		ctx, span := telemetry.Tracer.Start(ctx, spanName,
			trace.WithSpanKind(trace.SpanKindServer),
		)
		defer span.End()

		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}

// GinCORSMiddleware ensures unified CORS and defensive HTTP security headers across all microservices
func GinCORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, traceparent, X-User-Role, Idempotency-Key, X-Idempotency-Key, X-Correlation-ID")
		c.Writer.Header().Set("X-Content-Type-Options", "nosniff")
		c.Writer.Header().Set("X-Frame-Options", "DENY")
		c.Writer.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

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

	// Interactive OpenAPI / Swagger Documentation UI
	swagger.RegisterSwaggerUI(engine, serviceName)

	// Server-Sent Events (SSE) Live Feed for real-time front desk updates
	engine.GET("/api/v1/events/live", GlobalSSEHub.Handler())

	return engine
}

// ==============================================================================
// MODULAR ROUTE REGISTRATION (DRY - Single Source of Truth)
// ==============================================================================

func RegisterRoomRoutes(group *gin.RouterGroup, roomHandler *handler.RoomHandler) {
	if roomHandler == nil {
		return
	}
	group.GET("", GinAdapter(roomHandler.ListRooms))
	group.GET("/:id", GinAdapter(roomHandler.GetRoomByID))
	group.PATCH("/:id/status", GinAdapter(roomHandler.UpdateRoomStatus))
	group.PATCH("/:id/price", GinRBACMiddleware(RoleAdmin), GinAdapter(roomHandler.UpdateRoomPrice))
}

func RegisterStayRoutes(group *gin.RouterGroup, stayHandler *handler.StayHandler, sagaOrchestrator *saga.BookingSagaOrchestrator) {
	if stayHandler == nil {
		return
	}
	group.GET("", GinAdapter(stayHandler.ListStays))
	group.GET("/:id", GinAdapter(stayHandler.GetStayByID))
	group.POST("", GinAdapter(stayHandler.CreateStay))
	group.POST("/check-in", GinAdapter(stayHandler.CreateStay))
	group.PUT("/:id", GinAdapter(stayHandler.UpdateStay))
	group.PATCH("/:id", GinAdapter(stayHandler.UpdateStay))
	group.PATCH("/:id/cancel", GinAdapter(stayHandler.CancelStay))
	group.DELETE("/:id", GinAdapter(stayHandler.CancelStay))
	group.POST("/:id/check-out", GinAdapter(stayHandler.CheckOutStay))

	if sagaOrchestrator != nil {
		group.POST("/saga-booking", func(c *gin.Context) {
			var req handler.CreateStayRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid saga booking payload"})
				return
			}

			input, err := handler.ParseCreateStayInput(req)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			userRole := c.GetString("user_role")
			if userRole == "" {
				if hdrRole := c.GetHeader("X-User-Role"); hdrRole != "" {
					userRole = normalizeRole(hdrRole)
				} else {
					userRole = RoleUser
				}
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

func RegisterBillingRoutes(group *gin.RouterGroup, billingHandler *handler.BillingHandler) {
	if billingHandler == nil {
		return
	}
	group.GET("", GinAdapter(billingHandler.ListProducts))
	group.GET("/", GinAdapter(billingHandler.ListProducts))
	group.GET("/products", GinAdapter(billingHandler.ListProducts))
	group.POST("/charges", GinAdapter(billingHandler.AddStayCharge))
	group.GET("/stays/:id/charges", GinAdapter(billingHandler.ListStayCharges))
	group.POST("/shifts/open", GinRBACMiddleware(RoleAdmin), GinAdapter(billingHandler.OpenCashShift))
	group.POST("/shifts/:id/close", GinRBACMiddleware(RoleAdmin), GinAdapter(billingHandler.CloseCashShift))
}

// ==============================================================================
// ENGINE CONSTRUCTORS
// ==============================================================================

// NewGinRoomEngine builds the Gin v1.12.0 router for room-service
func NewGinRoomEngine(roomHandler *handler.RoomHandler) *gin.Engine {
	engine := NewGinBaseEngine("room-service")
	RegisterRoomRoutes(engine.Group("/api/v1/rooms"), roomHandler)
	return engine
}

// NewGinStayEngine builds the Gin v1.12.0 router for stay-service with Saga and Idempotency
func NewGinStayEngine(stayHandler *handler.StayHandler, sagaOrchestrator *saga.BookingSagaOrchestrator, redisClients ...*redis.Client) *gin.Engine {
	engine := NewGinBaseEngine("stay-service")
	stays := engine.Group("/api/v1/stays")

	if len(redisClients) > 0 && redisClients[0] != nil {
		stays.Use(GinIdempotencyMiddleware(NewRedisIdempotencyBackend(redisClients[0]), 24*time.Hour))
	}

	RegisterStayRoutes(stays, stayHandler, sagaOrchestrator)
	return engine
}

// NewGinBillingEngine builds the Gin v1.12.0 router for billing-service with Idempotency
func NewGinBillingEngine(billingHandler *handler.BillingHandler, redisClients ...*redis.Client) *gin.Engine {
	engine := NewGinBaseEngine("billing-service")
	billingGroup := engine.Group("/api/v1/billing")

	if len(redisClients) > 0 && redisClients[0] != nil {
		billingGroup.Use(GinIdempotencyMiddleware(NewRedisIdempotencyBackend(redisClients[0]), 24*time.Hour))
	}

	RegisterBillingRoutes(billingGroup, billingHandler)
	return engine
}

type RouterDependencies struct {
	RoomHandler    *handler.RoomHandler
	StayHandler    *handler.StayHandler
	BillingHandler *handler.BillingHandler
}

// NewGinUnifiedEngine builds an all-in-one Gin engine using the exact same DRY route definitions
func NewGinUnifiedEngine(deps RouterDependencies, sagaOrchestrator *saga.BookingSagaOrchestrator) *gin.Engine {
	engine := NewGinBaseEngine("hotel-unified")
	RegisterRoomRoutes(engine.Group("/api/v1/rooms"), deps.RoomHandler)
	RegisterStayRoutes(engine.Group("/api/v1/stays"), deps.StayHandler, sagaOrchestrator)
	RegisterBillingRoutes(engine.Group("/api/v1/billing"), deps.BillingHandler)
	return engine
}

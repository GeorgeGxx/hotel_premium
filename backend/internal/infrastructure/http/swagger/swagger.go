package swagger

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// OpenAPISpec returns the complete OpenAPI 3.0 specification for Hotel Premium microservices
func GetOpenAPISpec(serviceName string) map[string]interface{} {
	return map[string]interface{}{
		"openapi": "3.0.3",
		"info": map[string]interface{}{
			"title":       "Hotel Premium DevSecOps Platform - " + serviceName,
			"version":     "1.0.0",
			"description": "Enterprise Microservices API for Hotel Premium. Integrates Go 1.26, Gin v1.12.0, OpenTelemetry, Redis 8.8.1 Idempotency, and Keycloak JWT RBAC.",
			"contact": map[string]interface{}{
				"name": "Hotel Premium Platform Engineering",
			},
		},
		"servers": []map[string]interface{}{
			{
				"url":         "/",
				"description": "Local Cluster / Gateway Endpoint",
			},
		},
		"components": map[string]interface{}{
			"securitySchemes": map[string]interface{}{
				"BearerAuth": map[string]interface{}{
					"type":         "http",
					"scheme":       "bearer",
					"bearerFormat": "JWT",
					"description":  "Keycloak 26.8.1 JWT token. Use 'admin_user' or 'basic_user' bearer token.",
				},
				"IdempotencyKey": map[string]interface{}{
					"type":        "apiKey",
					"in":          "header",
					"name":        "Idempotency-Key",
					"description": "UUID v4 or unique transaction key for distributed lock idempotency via Redis 8.8.1.",
				},
				"UserRole": map[string]interface{}{
					"type":        "apiKey",
					"in":          "header",
					"name":        "X-User-Role",
					"description": "Role override: 'admin' or 'user'.",
				},
			},
			"schemas": map[string]interface{}{
				"Room": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"id":          map[string]interface{}{"type": "string", "example": "101"},
						"number":      map[string]interface{}{"type": "string", "example": "Room 101"},
						"type":        map[string]interface{}{"type": "string", "example": "Deluxe Suite"},
						"price":       map[string]interface{}{"type": "number", "example": 150.0},
						"status":      map[string]interface{}{"type": "string", "example": "AVAILABLE"},
						"cleanliness": map[string]interface{}{"type": "string", "example": "CLEAN"},
					},
				},
				"Stay": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"id":            map[string]interface{}{"type": "string", "example": "stay-abc-123"},
						"room_id":       map[string]interface{}{"type": "string", "example": "101"},
						"guest_name":    map[string]interface{}{"type": "string", "example": "John Doe"},
						"guest_email":   map[string]interface{}{"type": "string", "example": "john.doe@example.com"},
						"check_in_date": map[string]interface{}{"type": "string", "format": "date-time"},
						"status":        map[string]interface{}{"type": "string", "example": "CHECKED_IN"},
						"total_amount":  map[string]interface{}{"type": "number", "example": 300.0},
					},
				},
				"Charge": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"id":          map[string]interface{}{"type": "string", "example": "chg-001"},
						"stay_id":     map[string]interface{}{"type": "string", "example": "stay-abc-123"},
						"description": map[string]interface{}{"type": "string", "example": "Minibar Drinks"},
						"amount":      map[string]interface{}{"type": "number", "example": 25.50},
						"created_at":  map[string]interface{}{"type": "string", "format": "date-time"},
					},
				},
				"HealthResponse": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"status":  map[string]interface{}{"type": "string", "example": "UP"},
						"service": map[string]interface{}{"type": "string", "example": serviceName},
						"time":    map[string]interface{}{"type": "string", "format": "date-time"},
					},
				},
			},
		},
		"paths": map[string]interface{}{
			"/api/v1/health": map[string]interface{}{
				"get": map[string]interface{}{
					"summary":     "Liveness and Readiness Probe",
					"tags":        []string{"Observability"},
					"description": "Kubernetes health check endpoint returning HTTP 200 UP.",
					"responses": map[string]interface{}{
						"200": map[string]interface{}{
							"description": "Service is healthy",
							"content": map[string]interface{}{
								"application/json": map[string]interface{}{
									"schema": map[string]interface{}{"$ref": "#/components/schemas/HealthResponse"},
								},
							},
						},
					},
				},
			},
			"/metrics": map[string]interface{}{
				"get": map[string]interface{}{
					"summary":     "Prometheus Metrics",
					"tags":        []string{"Observability"},
					"description": "Standard Prometheus scrape metrics endpoint (HTTP latency, Go runtime, memory).",
					"responses": map[string]interface{}{
						"200": map[string]interface{}{"description": "Prometheus text format metrics"},
					},
				},
			},
			"/api/v1/events/live": map[string]interface{}{
				"get": map[string]interface{}{
					"summary":     "Server-Sent Events (SSE) Live Feed",
					"tags":        []string{"Realtime"},
					"description": "Real-time front desk event stream for room status updates and guest arrivals.",
					"responses": map[string]interface{}{
						"200": map[string]interface{}{"description": "text/event-stream connection opened"},
					},
				},
			},
			"/api/v1/rooms": map[string]interface{}{
				"get": map[string]interface{}{
					"summary": "List all hotel rooms",
					"tags":    []string{"Rooms"},
					"responses": map[string]interface{}{
						"200": map[string]interface{}{
							"description": "List of hotel rooms",
							"content": map[string]interface{}{
								"application/json": map[string]interface{}{
									"schema": map[string]interface{}{
										"type":  "array",
										"items": map[string]interface{}{"$ref": "#/components/schemas/Room"},
									},
								},
							},
						},
					},
				},
			},
			"/api/v1/rooms/{id}": map[string]interface{}{
				"get": map[string]interface{}{
					"summary": "Get room details by ID",
					"tags":    []string{"Rooms"},
					"parameters": []map[string]interface{}{
						{"name": "id", "in": "path", "required": true, "schema": map[string]interface{}{"type": "string"}},
					},
					"responses": map[string]interface{}{
						"200": map[string]interface{}{"description": "Room details"},
						"404": map[string]interface{}{"description": "Room not found"},
					},
				},
			},
			"/api/v1/rooms/{id}/status": map[string]interface{}{
				"patch": map[string]interface{}{
					"summary": "Update room housekeeping / occupancy status",
					"tags":    []string{"Rooms"},
					"parameters": []map[string]interface{}{
						{"name": "id", "in": "path", "required": true, "schema": map[string]interface{}{"type": "string"}},
					},
					"requestBody": map[string]interface{}{
						"required": true,
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{
									"type": "object",
									"properties": map[string]interface{}{
										"status":      map[string]interface{}{"type": "string", "example": "CLEAN"},
										"cleanliness": map[string]interface{}{"type": "string", "example": "CLEAN"},
									},
								},
							},
						},
					},
					"responses": map[string]interface{}{
						"200": map[string]interface{}{"description": "Status updated successfully"},
					},
				},
			},
			"/api/v1/rooms/{id}/price": map[string]interface{}{
				"patch": map[string]interface{}{
					"summary": "Update room rate price (Admin Only)",
					"tags":    []string{"Rooms"},
					"security": []map[string]interface{}{
						{"BearerAuth": []string{}},
						{"UserRole": []string{}},
					},
					"parameters": []map[string]interface{}{
						{"name": "id", "in": "path", "required": true, "schema": map[string]interface{}{"type": "string"}},
					},
					"requestBody": map[string]interface{}{
						"required": true,
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{
									"type": "object",
									"properties": map[string]interface{}{
										"price": map[string]interface{}{"type": "number", "example": 175.50},
									},
								},
							},
						},
					},
					"responses": map[string]interface{}{
						"200": map[string]interface{}{"description": "Room rate updated"},
						"403": map[string]interface{}{"description": "Forbidden: Requires Admin role"},
					},
				},
			},
			"/api/v1/stays": map[string]interface{}{
				"get": map[string]interface{}{
					"summary": "List all active and past guest stays",
					"tags":    []string{"Stays"},
					"responses": map[string]interface{}{
						"200": map[string]interface{}{
							"description": "List of stays",
							"content": map[string]interface{}{
								"application/json": map[string]interface{}{
									"schema": map[string]interface{}{
										"type":  "array",
										"items": map[string]interface{}{"$ref": "#/components/schemas/Stay"},
									},
								},
							},
						},
					},
				},
				"post": map[string]interface{}{
					"summary": "Create guest stay reservation (with Idempotency)",
					"tags":    []string{"Stays"},
					"security": []map[string]interface{}{
						{"IdempotencyKey": []string{}},
					},
					"requestBody": map[string]interface{}{
						"required": true,
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{
									"type": "object",
									"required": []string{"room_id", "guest_name"},
									"properties": map[string]interface{}{
										"room_id":       map[string]interface{}{"type": "string", "example": "101"},
										"guest_name":    map[string]interface{}{"type": "string", "example": "Alice Wonderland"},
										"guest_email":   map[string]interface{}{"type": "string", "example": "alice@example.com"},
										"check_in_date": map[string]interface{}{"type": "string", "format": "date-time"},
									},
								},
							},
						},
					},
					"responses": map[string]interface{}{
						"201": map[string]interface{}{"description": "Stay created"},
						"409": map[string]interface{}{"description": "Room already booked or conflicting lock"},
					},
				},
			},
			"/api/v1/stays/saga-booking": map[string]interface{}{
				"post": map[string]interface{}{
					"summary": "Distributed Saga Booking Orchestrator",
					"tags":    []string{"Stays"},
					"description": "Executes multi-step Saga across Room Inventory, Guest Reservation, Kafka Notification and Billing Invoice.",
					"responses": map[string]interface{}{
						"201": map[string]interface{}{"description": "Saga completed successfully"},
						"409": map[string]interface{}{"description": "Saga compensating transactions executed due to failure"},
					},
				},
			},
			"/api/v1/stays/{id}/check-out": map[string]interface{}{
				"post": map[string]interface{}{
					"summary": "Process guest check-out and finalize folio",
					"tags":    []string{"Stays"},
					"parameters": []map[string]interface{}{
						{"name": "id", "in": "path", "required": true, "schema": map[string]interface{}{"type": "string"}},
					},
					"responses": map[string]interface{}{
						"200": map[string]interface{}{"description": "Check-out completed"},
					},
				},
			},
			"/api/v1/billing/products": map[string]interface{}{
				"get": map[string]interface{}{
					"summary": "List billable products and hotel services",
					"tags":    []string{"Billing"},
					"responses": map[string]interface{}{
						"200": map[string]interface{}{"description": "List of catalog products"},
					},
				},
			},
			"/api/v1/billing/charges": map[string]interface{}{
				"post": map[string]interface{}{
					"summary": "Add charge to guest stay folio (with Idempotency)",
					"tags":    []string{"Billing"},
					"security": []map[string]interface{}{
						{"IdempotencyKey": []string{}},
					},
					"requestBody": map[string]interface{}{
						"required": true,
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{
									"type": "object",
									"required": []string{"stay_id", "amount", "description"},
									"properties": map[string]interface{}{
										"stay_id":     map[string]interface{}{"type": "string", "example": "stay-abc-123"},
										"description": map[string]interface{}{"type": "string", "example": "Spa Treatment"},
										"amount":      map[string]interface{}{"type": "number", "example": 85.0},
									},
								},
							},
						},
					},
					"responses": map[string]interface{}{
						"201": map[string]interface{}{"description": "Charge added to folio"},
					},
				},
			},
			"/api/v1/notifications": map[string]interface{}{
				"get": map[string]interface{}{
					"summary": "Notification Worker status & Kafka consumer telemetry",
					"tags":    []string{"Notifications"},
					"responses": map[string]interface{}{
						"200": map[string]interface{}{"description": "Worker operational status"},
					},
				},
			},
		},
	}
}

// SwaggerUIHTML embeds a responsive, zero-dependency Swagger UI HTML page
const SwaggerUIHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Hotel Premium - Swagger UI</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css" />
  <style>
    body { margin: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .topbar { display: none; }
    .swagger-ui .info .title { color: #38bdf8; }
    .swagger-ui .scheme-container { background: #0f172a; box-shadow: none; border-bottom: 1px solid #1e293b; }
    .swagger-ui { filter: invert(88%) hue-rotate(180deg); }
    .swagger-ui img { filter: invert(100%) hue-rotate(180deg); }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.min.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "/swagger/doc.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`

// RegisterSwaggerUI mounts /swagger, /swagger/index.html, and /swagger/doc.json onto any Gin engine
func RegisterSwaggerUI(engine *gin.Engine, serviceName string) {
	spec := GetOpenAPISpec(serviceName)

	engine.GET("/swagger/doc.json", func(c *gin.Context) {
		c.Header("Content-Type", "application/json")
		c.JSON(http.StatusOK, spec)
	})

	handler := func(c *gin.Context) {
		c.Header("Content-Type", "text/html; charset=utf-8")
		c.String(http.StatusOK, SwaggerUIHTML)
	}

	engine.GET("/swagger", handler)
	engine.GET("/swagger/", handler)
	engine.GET("/swagger/index.html", handler)
}

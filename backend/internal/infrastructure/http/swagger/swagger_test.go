package swagger_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/hotelpremium/backend/internal/infrastructure/http/swagger"
)

func TestSwaggerRegistration(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	swagger.RegisterSwaggerUI(engine, "test-service")

	// 1. Test Swagger HTML endpoint
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/swagger/index.html", nil)
	engine.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "SwaggerUIBundle") {
		t.Fatalf("expected SwaggerUIBundle in response body")
	}

	// 2. Test OpenAPI doc.json endpoint
	wDoc := httptest.NewRecorder()
	reqDoc, _ := http.NewRequest(http.MethodGet, "/swagger/doc.json", nil)
	engine.ServeHTTP(wDoc, reqDoc)
	if wDoc.Code != http.StatusOK {
		t.Fatalf("expected status 200 for doc.json, got %d", wDoc.Code)
	}
	if !strings.Contains(wDoc.Body.String(), "Hotel Premium DevSecOps Platform - test-service") {
		t.Fatalf("expected title in OpenAPI doc.json")
	}
	if !strings.Contains(wDoc.Body.String(), "openapi") {
		t.Fatalf("expected openapi keyword in doc.json")
	}
}

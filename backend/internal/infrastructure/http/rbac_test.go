package http

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestGinRBAC_AdminAccess(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	r.PATCH("/api/v1/rooms/:id/price", GinRBACMiddleware(RoleAdmin), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "price_updated"})
	})

	// 1. ADMIN user should be allowed in dev/test mode
	reqAdmin := httptest.NewRequest(http.MethodPatch, "/api/v1/rooms/123/price", nil)
	reqAdmin.Header.Set("X-User-Role", "ADMIN")
	recAdmin := httptest.NewRecorder()
	r.ServeHTTP(recAdmin, reqAdmin)

	if recAdmin.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for ADMIN, got %d", recAdmin.Code)
	}

	// 2. admin_user alias should be normalized and allowed
	reqAdminAlias := httptest.NewRequest(http.MethodPatch, "/api/v1/rooms/123/price", nil)
	reqAdminAlias.Header.Set("X-User-Role", "admin_user")
	recAdminAlias := httptest.NewRecorder()
	r.ServeHTTP(recAdminAlias, reqAdminAlias)

	if recAdminAlias.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for admin_user alias, got %d", recAdminAlias.Code)
	}

	// 3. USER should be forbidden (403)
	reqUser := httptest.NewRequest(http.MethodPatch, "/api/v1/rooms/123/price", nil)
	reqUser.Header.Set("X-User-Role", "USER")
	recUser := httptest.NewRecorder()
	r.ServeHTTP(recUser, reqUser)

	if recUser.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for USER, got %d", recUser.Code)
	}
}

func TestGinRBAC_CryptographicJWTAndSecurityHardening(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	r.PATCH("/api/v1/rooms/:id/price", GinRBACMiddleware(RoleAdmin), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "price_updated"})
	})

	// 1. Fake bearer token containing "admin" substring MUST be rejected (401)
	reqFakeBearer := httptest.NewRequest(http.MethodPatch, "/api/v1/rooms/123/price", nil)
	reqFakeBearer.Header.Set("Authorization", "Bearer fake_admin_token_bypass")
	recFakeBearer := httptest.NewRecorder()
	r.ServeHTTP(recFakeBearer, reqFakeBearer)

	if recFakeBearer.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for forged bearer token, got %d", recFakeBearer.Code)
	}

	// 2. Cryptographically signed HS256 JWT with ADMIN role succeeds (200)
	validToken, err := GenerateHMACJWT("user-1", RoleAdmin, "", 15*time.Minute)
	if err != nil {
		t.Fatalf("failed to generate valid JWT: %v", err)
	}
	reqValidJWT := httptest.NewRequest(http.MethodPatch, "/api/v1/rooms/123/price", nil)
	reqValidJWT.Header.Set("Authorization", "Bearer "+validToken)
	recValidJWT := httptest.NewRecorder()
	r.ServeHTTP(recValidJWT, reqValidJWT)

	if recValidJWT.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for valid ADMIN JWT, got %d", recValidJWT.Code)
	}

	// 3. Spoofed X-User-Role in production mode without gateway secret MUST be rejected (401)
	_ = os.Setenv("APP_ENV", "production")
	defer func() { _ = os.Unsetenv("APP_ENV") }()

	reqSpoofProd := httptest.NewRequest(http.MethodPatch, "/api/v1/rooms/123/price", nil)
	reqSpoofProd.Header.Set("X-User-Role", "ADMIN")
	recSpoofProd := httptest.NewRecorder()
	r.ServeHTTP(recSpoofProd, reqSpoofProd)

	if recSpoofProd.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for spoofed X-User-Role in production, got %d", recSpoofProd.Code)
	}
}

package http

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestGinRBAC_AdminAccess(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	r.PATCH("/api/v1/rooms/:id/price", GinRBACMiddleware(RoleAdmin), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "price_updated"})
	})

	// 1. ADMIN user should be allowed
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

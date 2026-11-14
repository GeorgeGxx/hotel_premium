package http

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hotelpremium/backend/internal/infrastructure/http/handler"
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

func TestVerifyBearerJWT_RS256AndAlgorithmAllowlist(t *testing.T) {
	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA keypair: %v", err)
	}
	RegisterRSAPublicKey("keycloak-kid-2026", &privKey.PublicKey)

	enc := base64.RawURLEncoding
	hdrBytes, _ := json.Marshal(map[string]string{
		"alg": "RS256",
		"typ": "JWT",
		"kid": "keycloak-kid-2026",
	})
	claimsBytes, _ := json.Marshal(map[string]interface{}{
		"sub": "keycloak-admin-uuid",
		"exp": time.Now().Add(10 * time.Minute).Unix(),
		"nbf": time.Now().Add(-1 * time.Minute).Unix(),
		"realm_access": map[string]interface{}{
			"roles": []string{"USER", "ADMIN"},
		},
	})

	unsigned := enc.EncodeToString(hdrBytes) + "." + enc.EncodeToString(claimsBytes)
	digest := sha256.Sum256([]byte(unsigned))
	sig, err := rsa.SignPKCS1v15(rand.Reader, privKey, crypto.SHA256, digest[:])
	if err != nil {
		t.Fatalf("failed to sign RS256 token: %v", err)
	}
	rs256Token := unsigned + "." + enc.EncodeToString(sig)

	role, sub, err := VerifyBearerJWTWithSubject(context.Background(), rs256Token, "")
	if err != nil {
		t.Fatalf("expected valid RS256 token verification, got error: %v", err)
	}
	if role != RoleAdmin || sub != "keycloak-admin-uuid" {
		t.Fatalf("expected role ADMIN and sub keycloak-admin-uuid, got role=%s sub=%s", role, sub)
	}

	// Test alg: "none" attack is strictly rejected
	noneHdr, _ := json.Marshal(map[string]string{"alg": "none", "typ": "JWT"})
	noneToken := enc.EncodeToString(noneHdr) + "." + enc.EncodeToString(claimsBytes) + "."
	if _, err := VerifyBearerJWT(noneToken, ""); err == nil {
		t.Fatalf("expected alg:none token to be rejected, got nil")
	}
}

func TestReadinessProbe_HealthyAndUnhealthy(t *testing.T) {
	handler.ResetReadinessChecks()
	defer handler.ResetReadinessChecks()

	engine := NewGinBaseEngine("test-readiness")

	handler.RegisterReadinessCheck("postgres", func(ctx context.Context) error {
		return nil
	})

	reqReady := httptest.NewRequest(http.MethodGet, "/api/v1/ready", nil)
	recReady := httptest.NewRecorder()
	engine.ServeHTTP(recReady, reqReady)
	if recReady.Code != http.StatusOK {
		t.Fatalf("expected 200 OK when dependencies are healthy, got %d", recReady.Code)
	}

	handler.RegisterReadinessCheck("redis", func(ctx context.Context) error {
		return errors.New("connection refused")
	})

	reqUnready := httptest.NewRequest(http.MethodGet, "/api/v1/ready", nil)
	recUnready := httptest.NewRecorder()
	engine.ServeHTTP(recUnready, reqUnready)
	if recUnready.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 Service Unavailable when redis check fails, got %d", recUnready.Code)
	}
}

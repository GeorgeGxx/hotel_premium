package http

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	RoleAdmin        = "ADMIN"
	RoleManager      = "MANAGER"
	RoleReceptionist = "RECEPTIONIST"
	RoleHousekeeping = "HOUSEKEEPING"
	RoleUser         = "USER"
)

const defaultDevSigningKey = "hotel-premium-enterprise-secure-jwt-token-key-2026"

// normalizeRole standardizes role variants such as "admin_user" or "ADMIN"
func normalizeRole(role string) string {
	cleaned := strings.ToUpper(strings.TrimSpace(role))
	switch cleaned {
	case "ADMIN", "ADMIN_USER", "ROLE_ADMIN":
		return RoleAdmin
	case "MANAGER", "HOTEL_MANAGER":
		return RoleManager
	case "RECEPTIONIST", "FRONT_DESK":
		return RoleReceptionist
	case "HOUSEKEEPING", "CLEANING":
		return RoleHousekeeping
	case "USER", "BASIC_USER", "GUEST":
		return RoleUser
	default:
		return RoleUser
	}
}

type jwtClaims struct {
	Sub         string   `json:"sub"`
	Role        string   `json:"role"`
	Roles       []string `json:"roles"`
	Exp         int64    `json:"exp"`
	RealmAccess struct {
		Roles []string `json:"roles"`
	} `json:"realm_access"`
}

// GenerateHMACJWT creates a signed HS256 JWT token for internal/testing and service authentication
func GenerateHMACJWT(sub, role, secret string, ttl time.Duration) (string, error) {
	if secret == "" {
		secret = getJWTSecret()
	}
	headerJSON := `{"alg":"HS256","typ":"JWT"}`
	claims := map[string]interface{}{
		"sub":  sub,
		"role": normalizeRole(role),
		"iat":  time.Now().Unix(),
		"exp":  time.Now().Add(ttl).Unix(),
	}
	claimsBytes, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	enc := base64.RawURLEncoding
	unsigned := enc.EncodeToString([]byte(headerJSON)) + "." + enc.EncodeToString(claimsBytes)
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(unsigned))
	sig := enc.EncodeToString(mac.Sum(nil))
	return unsigned + "." + sig, nil
}

func getJWTSecret() string {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return s
	}
	return defaultDevSigningKey
}

// VerifyBearerJWT cryptographically verifies an HS256 JWT and extracts its normalized role
func VerifyBearerJWT(tokenStr, secret string) (string, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return "", errors.New("malformed jwt token")
	}
	if secret == "" {
		secret = getJWTSecret()
	}

	unsigned := parts[0] + "." + parts[1]
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(unsigned))
	expectedSig := mac.Sum(nil)

	actualSig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || !hmac.Equal(actualSig, expectedSig) {
		return "", errors.New("invalid jwt signature")
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", errors.New("invalid jwt payload encoding")
	}

	var claims jwtClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return "", errors.New("invalid jwt claims json")
	}

	if claims.Exp > 0 && time.Now().Unix() > claims.Exp {
		return "", errors.New("jwt token expired")
	}

	if claims.Role != "" {
		return normalizeRole(claims.Role), nil
	}
	for _, r := range claims.Roles {
		if norm := normalizeRole(r); norm != RoleUser {
			return norm, nil
		}
	}
	for _, r := range claims.RealmAccess.Roles {
		if norm := normalizeRole(r); norm != RoleUser {
			return norm, nil
		}
	}

	return RoleUser, nil
}

// GinRBACMiddleware enforces cryptographic JWT validation and role-based access control.
// In production (APP_ENV=production), raw X-User-Role headers are rejected unless accompanied
// by a verified internal gateway secret or valid Bearer JWT.
func GinRBACMiddleware(allowedRoles ...string) gin.HandlerFunc {
	allowedMap := make(map[string]bool, len(allowedRoles))
	for _, r := range allowedRoles {
		allowedMap[normalizeRole(r)] = true
	}

	return func(c *gin.Context) {
		var resolvedRole string
		appEnv := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
		isProd := appEnv == "production" || appEnv == "prod"

		// 1. Prefer cryptographic Bearer JWT verification when Authorization header is present
		authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
		if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
			tokenStr := strings.TrimSpace(authHeader[7:])
			roleFromJWT, err := VerifyBearerJWT(tokenStr, getJWTSecret())
			if err != nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error": "unauthorized: invalid or expired bearer token",
				})
				return
			}
			resolvedRole = roleFromJWT
		}

		// 2. Fallback to X-User-Role only if verified via gateway secret or non-production environment
		if resolvedRole == "" {
			roleHeader := strings.TrimSpace(c.GetHeader("X-User-Role"))
			if roleHeader != "" {
				gatewaySecret := os.Getenv("INTERNAL_GATEWAY_SECRET")
				providedGatewaySecret := c.GetHeader("X-Gateway-Secret")
				if isProd && (gatewaySecret == "" || !hmac.Equal([]byte(gatewaySecret), []byte(providedGatewaySecret))) {
					c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
						"error": "unauthorized: unverified role header rejected in production",
					})
					return
				}
				resolvedRole = normalizeRole(roleHeader)
			} else if isProd {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error": "unauthorized: authentication credentials required",
				})
				return
			} else {
				resolvedRole = RoleUser
			}
		}

		c.Set("user_role", resolvedRole)

		if !allowedMap[resolvedRole] {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":     "forbidden: insufficient role privileges",
				"user_role": resolvedRole,
				"required":  allowedRoles,
			})
			return
		}

		c.Next()
	}
}

package http

import (
	"context"
	"crypto"
	"crypto/hmac"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
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

// rolePriority maps normalized roles to privilege hierarchy levels
var rolePriority = map[string]int{
	RoleAdmin:        50,
	RoleManager:      40,
	RoleReceptionist: 30,
	RoleHousekeeping: 20,
	RoleUser:         10,
}

// normalizeRole standardizes role variants such as "admin_user" or "ADMIN"
func normalizeRole(role string) string {
	cleaned := strings.ToUpper(strings.TrimSpace(role))
	switch cleaned {
	case "ADMIN", "ADMIN_USER", "ROLE_ADMIN", "REALM-ADMIN":
		return RoleAdmin
	case "MANAGER", "HOTEL_MANAGER", "ROLE_MANAGER":
		return RoleManager
	case "RECEPTIONIST", "FRONT_DESK", "ROLE_RECEPTIONIST":
		return RoleReceptionist
	case "HOUSEKEEPING", "CLEANING", "ROLE_HOUSEKEEPING":
		return RoleHousekeeping
	case "USER", "BASIC_USER", "GUEST", "ROLE_USER":
		return RoleUser
	default:
		return ""
	}
}

func NormalizeRole(role string) string {
	if norm := normalizeRole(role); norm != "" {
		return norm
	}
	return RoleUser
}

type jwtHeader struct {
	Alg string `json:"alg"`
	Typ string `json:"typ"`
	Kid string `json:"kid"`
}

type jwtClaims struct {
	Sub            string          `json:"sub"`
	Iss            string          `json:"iss"`
	Aud            json.RawMessage `json:"aud"`
	Role           string          `json:"role"`
	Roles          []string        `json:"roles"`
	Exp            int64           `json:"exp"`
	Nbf            int64           `json:"nbf"`
	Iat            int64           `json:"iat"`
	RealmAccess    struct {
		Roles []string `json:"roles"`
	} `json:"realm_access"`
	ResourceAccess map[string]struct {
		Roles []string `json:"roles"`
	} `json:"resource_access"`
}

func (c *jwtClaims) matchesAudience(expected string) bool {
	if expected == "" {
		return true
	}
	if len(c.Aud) == 0 {
		return false
	}
	var single string
	if err := json.Unmarshal(c.Aud, &single); err == nil {
		return single == expected
	}
	var multi []string
	if err := json.Unmarshal(c.Aud, &multi); err == nil {
		for _, a := range multi {
			if a == expected {
				return true
			}
		}
	}
	return false
}

func (c *jwtClaims) highestNormalizedRole() string {
	bestRole := RoleUser
	bestPriority := 0

	consider := func(raw string) {
		norm := normalizeRole(raw)
		if norm == "" {
			return
		}
		if p := rolePriority[norm]; p > bestPriority {
			bestPriority = p
			bestRole = norm
		}
	}

	if c.Role != "" {
		consider(c.Role)
	}
	for _, r := range c.Roles {
		consider(r)
	}
	for _, r := range c.RealmAccess.Roles {
		consider(r)
	}
	for _, res := range c.ResourceAccess {
		for _, r := range res.Roles {
			consider(r)
		}
	}

	return bestRole
}

// JWKSCache stores RSA public keys retrieved from Keycloak OIDC JWKS endpoint with key-rotation support
type JWKSCache struct {
	mu         sync.RWMutex
	keys       map[string]*rsa.PublicKey
	fetchedAt  time.Time
	ttl        time.Duration
	httpClient *http.Client
}

var globalJWKSCache = &JWKSCache{
	keys:       make(map[string]*rsa.PublicKey),
	ttl:        10 * time.Minute,
	httpClient: &http.Client{Timeout: 4 * time.Second},
}

// RegisterRSAPublicKey registers an RSA public key in the JWKS cache (used for testing and static key pinning)
func RegisterRSAPublicKey(kid string, pub *rsa.PublicKey) {
	globalJWKSCache.mu.Lock()
	defer globalJWKSCache.mu.Unlock()
	globalJWKSCache.keys[kid] = pub
	globalJWKSCache.fetchedAt = time.Now()
}

type jwksResponse struct {
	Keys []struct {
		Kid string `json:"kid"`
		Kty string `json:"kty"`
		Alg string `json:"alg"`
		Use string `json:"use"`
		N   string `json:"n"`
		E   string `json:"e"`
	} `json:"keys"`
}

func (jc *JWKSCache) getPublicKey(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	jc.mu.RLock()
	pub, exists := jc.keys[kid]
	expired := time.Since(jc.fetchedAt) > jc.ttl
	jc.mu.RUnlock()

	if exists && !expired {
		return pub, nil
	}

	jwksURL := os.Getenv("KEYCLOAK_JWKS_URL")
	if jwksURL == "" {
		keycloakURL := strings.TrimRight(os.Getenv("KEYCLOAK_URL"), "/")
		realm := os.Getenv("KEYCLOAK_REALM")
		if realm == "" {
			realm = "hotel-realm"
		}
		if keycloakURL != "" {
			jwksURL = fmt.Sprintf("%s/realms/%s/protocol/openid-connect/certs", keycloakURL, realm)
		}
	}

	if jwksURL == "" {
		if exists {
			return pub, nil
		}
		return nil, errors.New("jwks url not configured and key not found in cache")
	}

	if err := jc.refresh(ctx, jwksURL); err != nil {
		if exists {
			return pub, nil
		}
		return nil, err
	}

	jc.mu.RLock()
	defer jc.mu.RUnlock()
	if key, ok := jc.keys[kid]; ok {
		return key, nil
	}
	if kid == "" && len(jc.keys) == 1 {
		for _, k := range jc.keys {
			return k, nil
		}
	}
	return nil, fmt.Errorf("signing key kid %q not found in JWKS", kid)
}

func (jc *JWKSCache) refresh(ctx context.Context, jwksURL string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, jwksURL, nil)
	if err != nil {
		return err
	}
	resp, err := jc.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to fetch JWKS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected JWKS HTTP status %d", resp.StatusCode)
	}

	var parsed jwksResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return fmt.Errorf("failed to decode JWKS JSON: %w", err)
	}

	newKeys := make(map[string]*rsa.PublicKey, len(parsed.Keys))
	for _, k := range parsed.Keys {
		if k.Kty != "RSA" || k.N == "" || k.E == "" {
			continue
		}
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil {
			continue
		}
		eInt := new(big.Int).SetBytes(eBytes).Int64()
		if eInt <= 0 {
			continue
		}
		newKeys[k.Kid] = &rsa.PublicKey{
			N: new(big.Int).SetBytes(nBytes),
			E: int(eInt),
		}
	}

	jc.mu.Lock()
	for id, pk := range newKeys {
		jc.keys[id] = pk
	}
	jc.fetchedAt = time.Now()
	jc.mu.Unlock()
	return nil
}

// GenerateHMACJWT creates a signed HS256 JWT token for internal/testing and service authentication
func GenerateHMACJWT(sub, role, secret string, ttl time.Duration) (string, error) {
	if secret == "" {
		secret = getJWTSecret()
	}
	headerJSON := `{"alg":"HS256","typ":"JWT"}`
	now := time.Now().Unix()
	claims := map[string]interface{}{
		"sub":  sub,
		"role": NormalizeRole(role),
		"iat":  now,
		"nbf":  now,
		"exp":  time.Now().Add(ttl).Unix(),
	}
	if iss := os.Getenv("JWT_ISSUER"); iss != "" {
		claims["iss"] = iss
	}
	if aud := os.Getenv("JWT_AUDIENCE"); aud != "" {
		claims["aud"] = aud
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

// VerifyBearerJWT cryptographically verifies an RS256 (Keycloak JWKS) or HS256 JWT,
// enforces algorithm allowlists and claim constraints (exp, nbf, iss, aud), and extracts its normalized role.
func VerifyBearerJWT(tokenStr, secret string) (string, error) {
	role, _, err := VerifyBearerJWTWithSubject(context.Background(), tokenStr, secret)
	return role, err
}

// VerifyBearerJWTWithSubject verifies the JWT and returns (normalizedRole, subject, error)
func VerifyBearerJWTWithSubject(ctx context.Context, tokenStr, secret string) (string, string, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return "", "", errors.New("malformed jwt token")
	}

	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", "", errors.New("invalid jwt header encoding")
	}

	var hdr jwtHeader
	if err := json.Unmarshal(headerBytes, &hdr); err != nil {
		return "", "", errors.New("invalid jwt header json")
	}

	unsigned := parts[0] + "." + parts[1]
	actualSig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return "", "", errors.New("invalid jwt signature encoding")
	}

	// Explicit Algorithm Allowlist: only RS256 and HS256 are permitted
	switch hdr.Alg {
	case "HS256":
		if secret == "" {
			secret = getJWTSecret()
		}
		mac := hmac.New(sha256.New, []byte(secret))
		_, _ = mac.Write([]byte(unsigned))
		expectedSig := mac.Sum(nil)
		if !hmac.Equal(actualSig, expectedSig) {
			return "", "", errors.New("invalid hs256 jwt signature")
		}
	case "RS256":
		pubKey, err := globalJWKSCache.getPublicKey(ctx, hdr.Kid)
		if err != nil {
			return "", "", fmt.Errorf("rs256 public key resolution failed: %w", err)
		}
		digest := sha256.Sum256([]byte(unsigned))
		if err := rsa.VerifyPKCS1v15(pubKey, crypto.SHA256, digest[:], actualSig); err != nil {
			return "", "", errors.New("invalid rs256 jwt signature")
		}
	default:
		return "", "", fmt.Errorf("unsupported or disallowed jwt algorithm: %q", hdr.Alg)
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", "", errors.New("invalid jwt payload encoding")
	}

	var claims jwtClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return "", "", errors.New("invalid jwt claims json")
	}

	now := time.Now().Unix()
	if claims.Exp <= 0 {
		return "", "", errors.New("jwt missing required expiration (exp) claim")
	}
	if now > claims.Exp {
		return "", "", errors.New("jwt token expired")
	}
	if claims.Nbf > 0 && now+30 < claims.Nbf {
		return "", "", errors.New("jwt token not yet valid (nbf)")
	}

	if expectedIss := strings.TrimSpace(os.Getenv("JWT_ISSUER")); expectedIss != "" {
		if claims.Iss != expectedIss {
			return "", "", fmt.Errorf("jwt issuer mismatch: got %q, expected %q", claims.Iss, expectedIss)
		}
	}
	if expectedAud := strings.TrimSpace(os.Getenv("JWT_AUDIENCE")); expectedAud != "" {
		if !claims.matchesAudience(expectedAud) {
			return "", "", fmt.Errorf("jwt audience mismatch: expected %q", expectedAud)
		}
	}

	return claims.highestNormalizedRole(), claims.Sub, nil
}

// resolveRequestIdentity extracts and validates the caller's role and subject from an HTTP request.
// In production/staging, client-supplied X-User-Role headers are rejected unless accompanied by a verified internal gateway secret.
func resolveRequestIdentity(r *http.Request) (string, string, error) {
	appEnv := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	isProdOrStaging := appEnv == "production" || appEnv == "prod" || appEnv == "staging"

	// 1. Check Authorization: Bearer <token>
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	tokenStr := ""
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		tokenStr = strings.TrimSpace(authHeader[7:])
	} else if r.URL != nil && strings.HasSuffix(r.URL.Path, "/events/live") {
		// Allow query token strictly on SSE live stream where browser EventSource cannot set headers
		tokenStr = strings.TrimSpace(r.URL.Query().Get("access_token"))
	}

	if tokenStr != "" {
		role, sub, err := VerifyBearerJWTWithSubject(r.Context(), tokenStr, getJWTSecret())
		if err != nil {
			return "", "", errors.New("unauthorized: invalid or expired bearer token")
		}
		return role, sub, nil
	}

	// 2. Check X-User-Role header (only accepted in production if accompanied by verified INTERNAL_GATEWAY_SECRET)
	roleHeader := strings.TrimSpace(r.Header.Get("X-User-Role"))
	if roleHeader != "" {
		gatewaySecret := os.Getenv("INTERNAL_GATEWAY_SECRET")
		providedGatewaySecret := r.Header.Get("X-Gateway-Secret")
		if isProdOrStaging {
			if gatewaySecret == "" || !hmac.Equal([]byte(gatewaySecret), []byte(providedGatewaySecret)) {
				return "", "", errors.New("unauthorized: unverified role header rejected in production")
			}
		}
		return NormalizeRole(roleHeader), "gateway-user", nil
	}

	if isProdOrStaging {
		return "", "", errors.New("unauthorized: authentication credentials required")
	}

	// Non-production default role for local dev/test convenience when no header is sent
	return RoleUser, "dev-user", nil
}

// GinRBACMiddleware enforces cryptographic JWT validation and role-based access control.
func GinRBACMiddleware(allowedRoles ...string) gin.HandlerFunc {
	allowedMap := make(map[string]bool, len(allowedRoles))
	for _, r := range allowedRoles {
		allowedMap[NormalizeRole(r)] = true
	}

	return func(c *gin.Context) {
		resolvedRole, sub, err := resolveRequestIdentity(c.Request)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.Set("user_role", resolvedRole)
		c.Set("user_sub", sub)
		c.Request.Header.Set("X-Verified-User-Role", resolvedRole)

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

// RequireRoleHTTP wraps standard net/http handlers (e.g., notification-worker DLQ admin routes) with JWT & RBAC enforcement
func RequireRoleHTTP(allowedRoles []string, next http.HandlerFunc) http.HandlerFunc {
	allowedMap := make(map[string]bool, len(allowedRoles))
	for _, r := range allowedRoles {
		allowedMap[NormalizeRole(r)] = true
	}

	return func(w http.ResponseWriter, r *http.Request) {
		resolvedRole, _, err := resolveRequestIdentity(r)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		if !allowedMap[resolvedRole] {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"error":     "forbidden: insufficient role privileges",
				"user_role": resolvedRole,
				"required":  allowedRoles,
			})
			return
		}
		next(w, r)
	}
}

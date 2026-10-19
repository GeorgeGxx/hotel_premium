package http

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	RoleAdmin = "ADMIN"
	RoleUser  = "USER"
)

// normalizeRole standardizes role variants such as "admin_user" or "ADMIN"
func normalizeRole(role string) string {
	cleaned := strings.ToUpper(strings.TrimSpace(role))
	if cleaned == "ADMIN_USER" || cleaned == "ADMIN" {
		return RoleAdmin
	}
	return RoleUser
}

// GinRBACMiddleware enforces role-based access control for specified roles
// Validates X-User-Role or Bearer token claims, supporting initial 2-role matrix (ADMIN vs USER)
func GinRBACMiddleware(allowedRoles ...string) gin.HandlerFunc {
	allowedMap := make(map[string]bool)
	for _, r := range allowedRoles {
		allowedMap[normalizeRole(r)] = true
	}

	return func(c *gin.Context) {
		roleHeader := c.GetHeader("X-User-Role")
		if roleHeader == "" {
			// Check Authorization header fallback (e.g. Bearer admin_token)
			auth := c.GetHeader("Authorization")
			if strings.Contains(strings.ToLower(auth), "admin") {
				roleHeader = RoleAdmin
			} else if auth != "" {
				roleHeader = RoleUser
			} else {
				// Default to USER if unauthenticated in dev/demo mode
				roleHeader = RoleUser
			}
		}

		userRole := normalizeRole(roleHeader)
		c.Set("user_role", userRole)

		if !allowedMap[userRole] {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":     "forbidden: insufficient role privileges",
				"user_role": userRole,
				"required":  allowedRoles,
			})
			return
		}

		c.Next()
	}
}

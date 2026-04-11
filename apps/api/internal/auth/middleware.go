package auth

import (
	"strings"

	"neoflex-lms/internal/apierr"

	"github.com/gin-gonic/gin"
)

const (
	CtxUserID = "userID"
	CtxRole   = "role"
)

func Middleware(secret []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			apierr.Abort(c, 401, apierr.CodeUnauthorized, "unauthorized", nil)
			return
		}
		raw := strings.TrimSpace(strings.TrimPrefix(h, "Bearer "))
		claims, err := ParseToken(secret, raw)
		if err != nil {
			apierr.Abort(c, 401, apierr.CodeUnauthorized, "invalid or expired token", nil)
			return
		}
		c.Set(CtxUserID, claims.UserID)
		c.Set(CtxRole, claims.Role)
		c.Next()
	}
}

func RequireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		r, _ := c.Get(CtxRole)
		rs, _ := r.(string)
		if rs != role {
			apierr.Abort(c, 403, apierr.CodeForbidden, "forbidden", nil)
			return
		}
		c.Next()
	}
}

package apierr

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Body — единый формат ошибок API (shared/plan/backend.md).
type Body struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

func Write(c *gin.Context, status int, code, message string, details any) {
	c.JSON(status, Body{Code: code, Message: message, Details: details})
}

func Abort(c *gin.Context, status int, code, message string, details any) {
	c.AbortWithStatusJSON(status, Body{Code: code, Message: message, Details: details})
}

const (
	CodeUnauthorized       = "unauthorized"
	CodeForbidden          = "forbidden"
	CodeInvalidRequest     = "invalid_request"
	CodeNotFound           = "not_found"
	CodeConflict           = "conflict"
	CodeUpstream           = "upstream_error"
	CodeInternal           = "internal_error"
	CodeInvalidCredentials = "invalid_credentials"
)

func Unauthorized(c *gin.Context, message string) {
	if message == "" {
		message = "unauthorized"
	}
	Abort(c, http.StatusUnauthorized, CodeUnauthorized, message, nil)
}

func Forbidden(c *gin.Context, message string) {
	if message == "" {
		message = "forbidden"
	}
	Abort(c, http.StatusForbidden, CodeForbidden, message, nil)
}

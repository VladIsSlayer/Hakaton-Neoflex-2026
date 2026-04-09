package handlers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"neoflex-lms/internal/apierr"
	"neoflex-lms/internal/auth"
	"neoflex-lms/internal/store"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type Auth struct {
	Store     store.UserStore
	JWTSecret []byte
	TokenTTL  time.Duration
}

type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type registerRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	FullName string `json:"full_name" binding:"required"`
}

func (h *Auth) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierr.Write(c, http.StatusBadRequest, apierr.CodeInvalidRequest, "invalid request body", nil)
		return
	}
	user, err := h.Store.FindByEmail(c.Request.Context(), strings.TrimSpace(req.Email))
	if err != nil {
		if err == store.ErrNotFound {
			apierr.Write(c, http.StatusUnauthorized, apierr.CodeInvalidCredentials, "invalid email or password", nil)
			return
		}
		apierr.Write(c, http.StatusInternalServerError, apierr.CodeInternal, "internal error", nil)
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)) != nil {
		apierr.Write(c, http.StatusUnauthorized, apierr.CodeInvalidCredentials, "invalid email or password", nil)
		return
	}
	token, err := auth.SignToken(h.JWTSecret, user.ID, user.Role, h.TokenTTL)
	if err != nil {
		apierr.Write(c, http.StatusInternalServerError, apierr.CodeInternal, "could not issue token", nil)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"access_token": token,
		"token_type":   "Bearer",
		"expires_in":   int(h.TokenTTL.Seconds()),
		"user": gin.H{
			"id":        user.ID,
			"email":     user.Email,
			"full_name": user.FullName,
			"role":      user.Role,
		},
	})
}

func (h *Auth) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierr.Write(c, http.StatusBadRequest, apierr.CodeInvalidRequest, "invalid request body", nil)
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		apierr.Write(c, http.StatusInternalServerError, apierr.CodeInternal, "could not hash password", nil)
		return
	}
	user, err := h.Store.CreateStudent(c.Request.Context(), strings.TrimSpace(req.Email), strings.TrimSpace(req.FullName), string(hash))
	if err != nil {
		if errors.Is(err, store.ErrEmailTaken) {
			apierr.Write(c, http.StatusConflict, apierr.CodeConflict, "email already registered", nil)
			return
		}
		apierr.Write(c, http.StatusInternalServerError, apierr.CodeInternal, "internal error", nil)
		return
	}
	token, err := auth.SignToken(h.JWTSecret, user.ID, user.Role, h.TokenTTL)
	if err != nil {
		apierr.Write(c, http.StatusInternalServerError, apierr.CodeInternal, "could not issue token", nil)
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"access_token": token,
		"token_type":   "Bearer",
		"expires_in":   int(h.TokenTTL.Seconds()),
		"user": gin.H{
			"id":        user.ID,
			"email":     user.Email,
			"full_name": user.FullName,
			"role":      user.Role,
		},
	})
}

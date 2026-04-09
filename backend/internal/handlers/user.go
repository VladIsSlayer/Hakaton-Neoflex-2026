package handlers

import (
	"net/http"

	"neoflex-lms/internal/auth"
	"neoflex-lms/internal/store"

	"github.com/gin-gonic/gin"
)

type User struct {
	Store store.UserStore
}

func (h *User) MeProfile(c *gin.Context) {
	uidVal, ok := c.Get(auth.CtxUserID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	userID, _ := uidVal.(string)
	user, err := h.Store.GetByID(c.Request.Context(), userID)
	if err != nil {
		if err == store.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	comps, err := h.Store.ListCompetencies(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	resp := gin.H{
		"id":           user.ID,
		"email":        user.Email,
		"full_name":    user.FullName,
		"role":         user.Role,
		"competencies": comps,
	}
	if user.TgChatID != nil {
		resp["tg_chat_id"] = *user.TgChatID
	}
	c.JSON(http.StatusOK, resp)
}

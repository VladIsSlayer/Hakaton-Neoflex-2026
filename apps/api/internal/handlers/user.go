package handlers

import (
	"errors"
	"net/http"

	"neoflex-lms/internal/apierr"
	"neoflex-lms/internal/auth"
	"neoflex-lms/internal/store"

	"github.com/gin-gonic/gin"
)

type User struct {
	Store    store.UserStore
	Snapshot store.MeSnapshotStore
}

func (h *User) MeProfile(c *gin.Context) {
	uidVal, ok := c.Get(auth.CtxUserID)
	if !ok {
		apierr.Write(c, http.StatusUnauthorized, apierr.CodeUnauthorized, "unauthorized", nil)
		return
	}
	userID, _ := uidVal.(string)
	user, err := h.Store.GetByID(c.Request.Context(), userID)
	if err != nil {
		if err == store.ErrNotFound {
			apierr.Write(c, http.StatusNotFound, apierr.CodeNotFound, "user not found", nil)
			return
		}
		apierr.Write(c, http.StatusInternalServerError, apierr.CodeInternal, "internal error", nil)
		return
	}
	comps, err := h.Store.ListCompetencies(c.Request.Context(), userID)
	if err != nil {
		apierr.Write(c, http.StatusInternalServerError, apierr.CodeInternal, "internal error", nil)
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

func (h *User) MeSnapshot(c *gin.Context) {
	uidVal, ok := c.Get(auth.CtxUserID)
	if !ok {
		apierr.Write(c, http.StatusUnauthorized, apierr.CodeUnauthorized, "unauthorized", nil)
		return
	}
	userID, _ := uidVal.(string)
	if h.Snapshot == nil {
		apierr.Write(c, http.StatusInternalServerError, apierr.CodeInternal, "snapshot not configured", nil)
		return
	}
	snap, err := h.Snapshot.BuildMeSnapshot(c.Request.Context(), userID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			apierr.Write(c, http.StatusNotFound, apierr.CodeNotFound, "user not found", nil)
			return
		}
		apierr.Write(c, http.StatusInternalServerError, apierr.CodeInternal, "internal error", nil)
		return
	}
	c.JSON(http.StatusOK, snap)
}

package handlers

import (
	"errors"
	"net/http"
	"strings"

	"neoflex-lms/internal/apierr"
	"neoflex-lms/internal/store"

	"github.com/gin-gonic/gin"
)

type Admin struct {
	Store           store.AdminStatsStore
	DefaultCourseID string
}

func (h *Admin) UserStats(c *gin.Context) {
	courseID := strings.TrimSpace(c.Query("course_id"))
	if courseID == "" {
		courseID = h.DefaultCourseID
	}
	list, err := h.Store.ListStudentStatsByCourse(c.Request.Context(), courseID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			apierr.Write(c, http.StatusNotFound, apierr.CodeNotFound, "course not found", nil)
			return
		}
		apierr.Write(c, http.StatusInternalServerError, apierr.CodeInternal, "internal error", nil)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"course_id": courseID,
		"students":  list,
	})
}

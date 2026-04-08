package handlers

import (
	"errors"
	"net/http"
	"strings"

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
			c.JSON(http.StatusNotFound, gin.H{"error": "course not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"course_id": courseID,
		"students":  list,
	})
}

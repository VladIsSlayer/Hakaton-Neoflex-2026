package handlers

import (
	"net/http"

	"neoflex-lms/internal/apierr"
	"neoflex-lms/internal/store"

	"github.com/gin-gonic/gin"
)

type Stats struct {
	Store store.EnrollmentStatsStore
}

func (h *Stats) CourseEnrollments(c *gin.Context) {
	list, err := h.Store.ListEnrollmentCountsByCourse(c.Request.Context())
	if err != nil {
		apierr.Write(c, http.StatusInternalServerError, apierr.CodeInternal, "internal error", nil)
		return
	}
	c.JSON(http.StatusOK, list)
}

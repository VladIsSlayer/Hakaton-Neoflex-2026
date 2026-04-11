package handlers

import (
	"errors"
	"net/http"
	"strings"

	"neoflex-lms/internal/apierr"
	"neoflex-lms/internal/auth"
	"neoflex-lms/internal/store"

	"github.com/gin-gonic/gin"
)

type Enrollment struct {
	Writer store.EnrollmentWriter
}

type enrollBody struct {
	CourseID string `json:"course_id" binding:"required"`
}

func (h *Enrollment) Enroll(c *gin.Context) {
	uidVal, ok := c.Get(auth.CtxUserID)
	if !ok {
		apierr.Write(c, http.StatusUnauthorized, apierr.CodeUnauthorized, "unauthorized", nil)
		return
	}
	userID, _ := uidVal.(string)

	var req enrollBody
	if err := c.ShouldBindJSON(&req); err != nil {
		apierr.Write(c, http.StatusBadRequest, apierr.CodeInvalidRequest, "invalid request body", nil)
		return
	}
	courseID := strings.TrimSpace(req.CourseID)
	if courseID == "" {
		apierr.Write(c, http.StatusBadRequest, apierr.CodeInvalidRequest, "course_id is required", nil)
		return
	}

	err := h.Writer.EnrollStudentInPublishedCourse(c.Request.Context(), userID, courseID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			apierr.Write(c, http.StatusNotFound, apierr.CodeNotFound, "course not found or not published", nil)
			return
		}
		apierr.Write(c, http.StatusInternalServerError, apierr.CodeInternal, "internal error", nil)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"course_id": courseID})
}

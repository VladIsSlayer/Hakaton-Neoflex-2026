package handlers

import (
	"errors"
	"net/http"

	"neoflex-lms/internal/store"

	"github.com/gin-gonic/gin"
)

type Course struct {
	Store store.CourseStore
}

func (h *Course) ListPublished(c *gin.Context) {
	list, err := h.Store.ListPublishedCourses(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *Course) LessonsForCourse(c *gin.Context) {
	courseID := c.Param("id")
	lessons, err := h.Store.ListLessonsForPublishedCourse(c.Request.Context(), courseID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "course not found or not published"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(http.StatusOK, lessons)
}

type createCourseRequest struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
	IsPublished bool   `json:"is_published"`
}

func (h *Course) Create(c *gin.Context) {
	var req createCourseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	course, err := h.Store.CreateCourse(c.Request.Context(), req.Title, req.Description, req.IsPublished)
	if err != nil {
		if errors.Is(err, store.ErrEmptyTitle) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "title is required"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(http.StatusCreated, course)
}

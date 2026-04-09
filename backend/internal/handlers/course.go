package handlers

import (
	"encoding/json"
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
	Title             string          `json:"title" binding:"required"`
	Description       string          `json:"description"`
	IsPublished       bool            `json:"is_published"`
	ContentBlocksJSON json.RawMessage `json:"content_blocks_json"`
}

func (h *Course) Create(c *gin.Context) {
	var req createCourseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	var blocks []byte
	if len(req.ContentBlocksJSON) > 0 {
		if !json.Valid(req.ContentBlocksJSON) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "content_blocks_json must be valid JSON"})
			return
		}
		blocks = req.ContentBlocksJSON
	}
	course, err := h.Store.CreateCourse(c.Request.Context(), req.Title, req.Description, req.IsPublished, blocks)
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

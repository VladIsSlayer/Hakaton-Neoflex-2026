package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"neoflex-lms/internal/apierr"
	"neoflex-lms/internal/contentblocks"
	"neoflex-lms/internal/store"

	"github.com/gin-gonic/gin"
)

type Course struct {
	Store store.CourseStore
}

func (h *Course) ListPublished(c *gin.Context) {
	list, err := h.Store.ListPublishedCourses(c.Request.Context())
	if err != nil {
		apierr.Write(c, http.StatusInternalServerError, apierr.CodeInternal, "internal error", nil)
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *Course) ListCatalogLessons(c *gin.Context) {
	list, err := h.Store.ListAllLessonsForPublishedCatalog(c.Request.Context())
	if err != nil {
		apierr.Write(c, http.StatusInternalServerError, apierr.CodeInternal, "internal error", nil)
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *Course) LessonsForCourse(c *gin.Context) {
	courseID := c.Param("id")
	lessons, err := h.Store.ListLessonsForPublishedCourse(c.Request.Context(), courseID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			apierr.Write(c, http.StatusNotFound, apierr.CodeNotFound, "course not found or not published", nil)
			return
		}
		apierr.Write(c, http.StatusInternalServerError, apierr.CodeInternal, "internal error", nil)
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
		apierr.Write(c, http.StatusBadRequest, apierr.CodeInvalidRequest, "invalid request body", nil)
		return
	}
	var blocks []byte
	if len(req.ContentBlocksJSON) > 0 {
		if !json.Valid(req.ContentBlocksJSON) {
			apierr.Write(c, http.StatusBadRequest, apierr.CodeInvalidRequest, "content_blocks_json must be valid JSON", nil)
			return
		}
		if err := contentblocks.ValidateArray(req.ContentBlocksJSON); err != nil {
			apierr.Write(c, http.StatusBadRequest, apierr.CodeInvalidRequest, err.Error(), nil)
			return
		}
		blocks = req.ContentBlocksJSON
	}
	course, err := h.Store.CreateCourse(c.Request.Context(), req.Title, req.Description, req.IsPublished, blocks)
	if err != nil {
		if errors.Is(err, store.ErrEmptyTitle) {
			apierr.Write(c, http.StatusBadRequest, apierr.CodeInvalidRequest, "title is required", nil)
			return
		}
		apierr.Write(c, http.StatusInternalServerError, apierr.CodeInternal, "internal error", nil)
		return
	}
	c.JSON(http.StatusCreated, course)
}

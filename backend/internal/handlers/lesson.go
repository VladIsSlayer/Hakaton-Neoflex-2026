package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"neoflex-lms/internal/apierr"
	"neoflex-lms/internal/store"

	"github.com/gin-gonic/gin"
)

func judge0LanguageLabel(languageID int) string {
	switch languageID {
	case 60:
		return "Go"
	case 63:
		return "JavaScript (Node.js)"
	case 71:
		return "Python 3"
	case 72:
		return "Ruby"
	case 82:
		return "PostgreSQL (SQL)"
	default:
		return ""
	}
}

type LessonTask struct {
	Tasks store.TaskCheckStore
}

// TaskMeta — публично: task_id и language_id для урока опубликованного курса (без эталона).
func (h *LessonTask) TaskMeta(c *gin.Context) {
	lessonID := c.Param("lesson_id")
	t, err := h.Tasks.GetTaskForPublishedLesson(c.Request.Context(), lessonID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			apierr.Write(c, http.StatusNotFound, apierr.CodeNotFound, "task not found for lesson", nil)
			return
		}
		apierr.Write(c, http.StatusInternalServerError, apierr.CodeInternal, "internal error", nil)
		return
	}
	label := judge0LanguageLabel(t.LanguageID)
	if label == "" {
		label = fmt.Sprintf("Judge0 #%d", t.LanguageID)
	}
	c.JSON(http.StatusOK, gin.H{
		"task_id":        t.ID,
		"language_id":    t.LanguageID,
		"language_label": label,
	})
}

type createTaskRequest struct {
	LanguageID      int     `json:"language_id" binding:"required"`
	ReferenceAnswer string  `json:"reference_answer" binding:"required"`
	CompetencyID    string  `json:"competency_id" binding:"required"`
	TaskType        *string `json:"task_type"`
	PromptText      *string `json:"prompt_text"`
	TestsJSON       *string `json:"tests_json"`
}

func (h *LessonTask) CreateTask(c *gin.Context) {
	lessonID := strings.TrimSpace(c.Param("lesson_id"))
	if lessonID == "" {
		apierr.Write(c, http.StatusBadRequest, apierr.CodeInvalidRequest, "lesson id is required", nil)
		return
	}

	var req createTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierr.Write(c, http.StatusBadRequest, apierr.CodeInvalidRequest, "invalid request body", nil)
		return
	}
	compID := strings.TrimSpace(req.CompetencyID)
	if compID == "" {
		apierr.Write(c, http.StatusBadRequest, apierr.CodeInvalidRequest, "competency_id is required", nil)
		return
	}

	task, err := h.Tasks.CreateTask(c.Request.Context(), store.CreateTaskParams{
		LessonID:        lessonID,
		LanguageID:      req.LanguageID,
		ReferenceAnswer: strings.TrimSpace(req.ReferenceAnswer),
		CompetencyID:    compID,
		TaskType:        req.TaskType,
		PromptText:      req.PromptText,
		TestsJSON:       req.TestsJSON,
	})
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			apierr.Write(c, http.StatusNotFound, apierr.CodeNotFound, "lesson or competency not found", nil)
			return
		}
		if errors.Is(err, store.ErrEmptyReferenceAnswer) {
			apierr.Write(c, http.StatusBadRequest, apierr.CodeInvalidRequest, "reference_answer is required", nil)
			return
		}
		apierr.Write(c, http.StatusInternalServerError, apierr.CodeInternal, "internal error", nil)
		return
	}
	c.JSON(http.StatusCreated, task)
}

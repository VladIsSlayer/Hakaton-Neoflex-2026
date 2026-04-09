package handlers

import (
	"errors"
	"net/http"

	"neoflex-lms/internal/apierr"
	"neoflex-lms/internal/store"

	"github.com/gin-gonic/gin"
)

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
	c.JSON(http.StatusOK, gin.H{
		"task_id":     t.ID,
		"language_id": t.LanguageID,
	})
}

package handlers

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"neoflex-lms/internal/auth"
	"neoflex-lms/internal/store"

	"github.com/gin-gonic/gin"
)

type CodeRunner interface {
	Run(ctx context.Context, languageID int, sourceCode string) (stdout, stderr, compileOut string, executedOK bool, statusDesc string, err error)
}

type TaskCheck struct {
	Store  store.TaskCheckStore
	Runner CodeRunner
}

type checkBody struct {
	UserCode   string `json:"user_code" binding:"required"`
	LanguageID int    `json:"language_id" binding:"required"`
}

func firstNonEmpty(parts ...string) string {
	for _, p := range parts {
		if strings.TrimSpace(p) != "" {
			return strings.TrimSpace(p)
		}
	}
	return "execution failed"
}

func (h *TaskCheck) Check(c *gin.Context) {
	taskID := c.Param("task_id")
	uidVal, ok := c.Get(auth.CtxUserID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	userID, _ := uidVal.(string)

	var req checkBody
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	task, err := h.Store.GetTask(c.Request.Context(), taskID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if req.LanguageID != task.LanguageID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "language_id does not match task"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 40*time.Second)
	defer cancel()

	stdout, stderr, compileOut, executedOK, statusDesc, err := h.Runner.Run(ctx, task.LanguageID, req.UserCode)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{
			"status": "failed",
			"error":  "judge0 unavailable",
			"detail": err.Error(),
		})
		return
	}
	if !executedOK {
		msg := firstNonEmpty(compileOut, stderr, statusDesc, stdout)
		c.JSON(http.StatusOK, gin.H{
			"status":  "failed",
			"error":   msg,
			"console": strings.TrimSpace(stdout),
		})
		return
	}

	got := strings.TrimSpace(stdout)
	want := strings.TrimSpace(task.ReferenceAnswer)
	if got != want {
		c.JSON(http.StatusOK, gin.H{
			"status":  "failed",
			"error":   "output does not match expected answer",
			"console": got,
		})
		return
	}

	already, comps, pct, err := h.Store.RecordSuccessIfFirst(c.Request.Context(), userID, taskID, req.UserCode)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":                  "success",
		"console":                 strings.TrimSpace(stdout),
		"competencies":            comps,
		"course_progress_percent": pct,
		"already_solved":          already,
	})
}

package handlers

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"neoflex-lms/internal/apierr"
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

// executionPhaseCompleted — синхронный Judge0; queued/running зарезервированы под async.
const executionPhaseCompleted = "completed"

func (h *TaskCheck) Check(c *gin.Context) {
	taskID := c.Param("task_id")
	uidVal, ok := c.Get(auth.CtxUserID)
	if !ok {
		apierr.Write(c, http.StatusUnauthorized, apierr.CodeUnauthorized, "unauthorized", nil)
		return
	}
	userID, _ := uidVal.(string)

	var req checkBody
	if err := c.ShouldBindJSON(&req); err != nil {
		apierr.Write(c, http.StatusBadRequest, apierr.CodeInvalidRequest, "invalid request body", nil)
		return
	}

	task, err := h.Store.GetTask(c.Request.Context(), taskID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			apierr.Write(c, http.StatusNotFound, apierr.CodeNotFound, "task not found", nil)
			return
		}
		apierr.Write(c, http.StatusInternalServerError, apierr.CodeInternal, "internal error", nil)
		return
	}
	if req.LanguageID != task.LanguageID {
		apierr.Write(c, http.StatusBadRequest, apierr.CodeInvalidRequest, "language_id does not match task", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 40*time.Second)
	defer cancel()

	stdout, stderr, compileOut, executedOK, statusDesc, err := h.Runner.Run(ctx, task.LanguageID, req.UserCode)
	if err != nil {
		apierr.Write(c, http.StatusBadGateway, apierr.CodeUpstream, "judge0 unavailable", gin.H{"detail": err.Error()})
		return
	}
	if !executedOK {
		msg := firstNonEmpty(compileOut, stderr, statusDesc, stdout)
		c.JSON(http.StatusOK, gin.H{
			"status":                     "failed",
			"phase":                      executionPhaseCompleted,
			"execution_status":           "failed",
			"error":                      msg,
			"console":                    strings.TrimSpace(stdout),
			"score":                      0,
			"updated_progress_percent":   0,
			"course_progress_percent":    0,
			"competencies":               nil,
			"already_solved":             false,
		})
		return
	}

	got := strings.TrimSpace(stdout)
	want := strings.TrimSpace(task.ReferenceAnswer)
	if got != want {
		c.JSON(http.StatusOK, gin.H{
			"status":                     "failed",
			"phase":                      executionPhaseCompleted,
			"execution_status":           "failed",
			"error":                      "output does not match expected answer",
			"console":                    got,
			"score":                      0,
			"updated_progress_percent":   0,
			"course_progress_percent":    0,
			"competencies":               nil,
			"already_solved":             false,
		})
		return
	}

	already, comps, pct, err := h.Store.RecordSuccessIfFirst(c.Request.Context(), userID, taskID, req.UserCode)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			apierr.Write(c, http.StatusNotFound, apierr.CodeNotFound, "task not found", nil)
			return
		}
		apierr.Write(c, http.StatusInternalServerError, apierr.CodeInternal, "internal error", nil)
		return
	}

	score := 0
	if !already {
		score = 10
	}

	c.JSON(http.StatusOK, gin.H{
		"status":                     "success",
		"phase":                      executionPhaseCompleted,
		"execution_status":           "success",
		"console":                    strings.TrimSpace(stdout),
		"error":                      "",
		"score":                      score,
		"updated_progress_percent":   pct,
		"course_progress_percent":    pct,
		"competencies":               comps,
		"already_solved":             already,
	})
}

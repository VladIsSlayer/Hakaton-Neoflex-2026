package handlers

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"neoflex-lms/internal/apierr"
	"neoflex-lms/internal/auth"
	"neoflex-lms/internal/store"

	"github.com/gin-gonic/gin"
)

const maxUserCodeRunes = 120_000

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
	if strings.TrimSpace(req.UserCode) == "" {
		apierr.Write(c, http.StatusBadRequest, apierr.CodeInvalidRequest, "user_code is empty", nil)
		return
	}
	if utf8.RuneCountInString(req.UserCode) > maxUserCodeRunes {
		apierr.Write(c, http.StatusBadRequest, apierr.CodeInvalidRequest, "user_code too large", nil)
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
		_ = h.Store.InsertFailedSubmission(c.Request.Context(), userID, taskID, req.UserCode)
		msg := firstNonEmpty(compileOut, stderr, statusDesc, stdout)
		c.JSON(http.StatusOK, gin.H{
			"status":                   "failed",
			"phase":                    executionPhaseCompleted,
			"execution_status":         "failed",
			"failure_kind":             judgeFailureKind(compileOut, stderr, statusDesc, msg),
			"error":                    msg,
			"console":                  NormalizeJudgeOutput(stdout),
			"stderr":                   strings.TrimSpace(stderr),
			"compile_output":           strings.TrimSpace(compileOut),
			"judge_status":             strings.TrimSpace(statusDesc),
			"score":                    0,
			"updated_progress_percent": 0,
			"course_progress_percent":  0,
			"competencies":             nil,
			"already_solved":           false,
		})
		return
	}

	got := NormalizeJudgeOutput(stdout)
	want := NormalizeJudgeOutput(task.ReferenceAnswer)
	if got != want {
		_ = h.Store.InsertFailedSubmission(c.Request.Context(), userID, taskID, req.UserCode)
		c.JSON(http.StatusOK, gin.H{
			"status":                   "failed",
			"phase":                    executionPhaseCompleted,
			"execution_status":         "failed",
			"failure_kind":             "wrong_answer",
			"error":                    "output does not match expected answer",
			"console":                  got,
			"stderr":                   "",
			"compile_output":           "",
			"judge_status":             "",
			"score":                    0,
			"updated_progress_percent": 0,
			"course_progress_percent":  0,
			"competencies":             nil,
			"already_solved":           false,
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
		"status":                   "success",
		"phase":                    executionPhaseCompleted,
		"execution_status":         "success",
		"failure_kind":             "",
		"console":                  got,
		"error":                    "",
		"stderr":                   "",
		"compile_output":           "",
		"judge_status":             "",
		"score":                    score,
		"updated_progress_percent": pct,
		"course_progress_percent":  pct,
		"competencies":             comps,
		"already_solved":           already,
	})
}

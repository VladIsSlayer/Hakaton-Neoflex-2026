package handlers

import (
	"errors"
	"net/http"
	"regexp"
	"strings"

	"neoflex-lms/internal/apierr"
	"neoflex-lms/internal/store"

	"github.com/gin-gonic/gin"
)

var devIssueRe = regexp.MustCompile(`(?i)DEV-\d+`)

type GitWebhook struct {
	Store  store.GitWebhookStore
	Secret string
}

type gitlabMergeRequestPayload struct {
	ObjectKind       string `json:"object_kind"`
	ObjectAttributes struct {
		Action string `json:"action"`
		State  string `json:"state"`
		Title  string `json:"title"`
	} `json:"object_attributes"`
}

func isMergeCompleted(p *gitlabMergeRequestPayload) bool {
	if p.ObjectKind != "merge_request" {
		return false
	}
	s := strings.ToLower(strings.TrimSpace(p.ObjectAttributes.State))
	a := strings.ToLower(strings.TrimSpace(p.ObjectAttributes.Action))
	if s == "merged" {
		return true
	}
	return a == "merge"
}

func (h *GitWebhook) HandleGitLab(c *gin.Context) {
	if h.Secret != "" {
		tok := strings.TrimSpace(c.GetHeader("X-Gitlab-Token"))
		if tok == "" {
			tok = strings.TrimSpace(c.GetHeader("X-Webhook-Token"))
		}
		if tok != h.Secret {
			apierr.Write(c, http.StatusUnauthorized, apierr.CodeUnauthorized, "invalid webhook token", nil)
			return
		}
	}

	var payload gitlabMergeRequestPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		apierr.Write(c, http.StatusBadRequest, apierr.CodeInvalidRequest, "invalid JSON body", nil)
		return
	}

	if !isMergeCompleted(&payload) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ignored",
			"reason": "not_merge_event",
		})
		return
	}

	title := payload.ObjectAttributes.Title
	match := devIssueRe.FindString(title)
	if match == "" {
		c.JSON(http.StatusOK, gin.H{
			"status": "ignored",
			"reason": "no_dev_tag_in_title",
		})
		return
	}

	issueKey := strings.ToUpper(match)
	uid, tid, already, comps, pct, err := h.Store.ApplyGitIssueSuccess(c.Request.Context(), issueKey)
	if err != nil {
		if errors.Is(err, store.ErrGitBindingNotFound) {
			apierr.Write(c, http.StatusNotFound, apierr.CodeNotFound, "git issue not mapped", gin.H{"issue": issueKey})
			return
		}
		if errors.Is(err, store.ErrNotFound) {
			apierr.Write(c, http.StatusNotFound, apierr.CodeNotFound, "task not found", nil)
			return
		}
		apierr.Write(c, http.StatusInternalServerError, apierr.CodeInternal, "internal error", nil)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":                  "ok",
		"issue":                   issueKey,
		"user_id":                 uid,
		"task_id":                 tid,
		"already_solved":          already,
		"competencies":            comps,
		"course_progress_percent": pct,
	})
}

package handlers

import (
	"errors"
	"net/http"
	"regexp"
	"strings"

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
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid webhook token"})
			return
		}
	}

	var payload gitlabMergeRequestPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON body"})
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
			c.JSON(http.StatusNotFound, gin.H{"error": "git issue not mapped", "issue": issueKey})
			return
		}
		if errors.Is(err, store.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
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

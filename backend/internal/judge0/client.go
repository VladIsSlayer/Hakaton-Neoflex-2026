package judge0

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	BaseURL       string
	AuthToken     string
	RapidAPIKey   string
	RapidAPIHost  string
	HTTP          *http.Client
}

type submissionRequest struct {
	SourceCode string `json:"source_code"`
	LanguageID int    `json:"language_id"`
}

type submissionResponse struct {
	Stdout        *string `json:"stdout"`
	Stderr        *string `json:"stderr"`
	CompileOutput *string `json:"compile_output"`
	Message       *string `json:"message"`
	Status        *struct {
		ID          *int    `json:"id"`
		Description *string `json:"description"`
	} `json:"status"`
}

func strPtr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

const statusAccepted = 3

func (c *Client) Run(ctx context.Context, languageID int, sourceCode string) (stdout, stderr, compileOut string, executedOK bool, statusDesc string, err error) {
	base := strings.TrimRight(strings.TrimSpace(c.BaseURL), "/")
	if base == "" {
		base = "https://ce.judge0.com"
	}
	u := base + "/submissions?base64_encoded=false&wait=true"

	body, err := json.Marshal(submissionRequest{
		SourceCode: sourceCode,
		LanguageID: languageID,
	})
	if err != nil {
		return "", "", "", false, "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u, bytes.NewReader(body))
	if err != nil {
		return "", "", "", false, "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if c.RapidAPIKey != "" {
		req.Header.Set("X-RapidAPI-Key", c.RapidAPIKey)
		host := strings.TrimSpace(c.RapidAPIHost)
		if host == "" {
			host = "judge0-ce.p.rapidapi.com"
		}
		req.Header.Set("X-RapidAPI-Host", host)
	} else if c.AuthToken != "" {
		req.Header.Set("X-Auth-Token", c.AuthToken)
	}

	client := c.HTTP
	if client == nil {
		client = &http.Client{Timeout: 45 * time.Second}
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", "", "", false, "", err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", "", false, "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", "", false, "", fmt.Errorf("judge0: HTTP %s: %s", resp.Status, truncate(string(raw), 500))
	}

	var out submissionResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", "", "", false, "", fmt.Errorf("judge0: decode response: %w", err)
	}

	stdout = strPtr(out.Stdout)
	stderr = strPtr(out.Stderr)
	compileOut = strPtr(out.CompileOutput)
	if out.Status != nil && out.Status.Description != nil {
		statusDesc = *out.Status.Description
	}
	if out.Status != nil && out.Status.ID != nil && *out.Status.ID == statusAccepted {
		executedOK = true
	}
	return stdout, stderr, compileOut, executedOK, statusDesc, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

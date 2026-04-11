package handlers

import "strings"

// judgeFailureKind — грубая классификация для UI (Judge0 + типичные сообщения).
func judgeFailureKind(compileOut, stderr, statusDesc, summary string) string {
	compileOut = strings.ToLower(compileOut)
	stderr = strings.ToLower(stderr)
	status := strings.ToLower(statusDesc)
	sum := strings.ToLower(summary)

	if strings.TrimSpace(compileOut) != "" {
		return "compile_error"
	}
	switch {
	case strings.Contains(status, "time limit") || strings.Contains(sum, "time limit"):
		return "time_limit"
	case strings.Contains(status, "memory limit") || strings.Contains(sum, "memory limit"):
		return "memory_limit"
	case strings.Contains(stderr, "syntaxerror") || strings.Contains(stderr, "syntax error"):
		return "syntax_error"
	case strings.Contains(stderr, "traceback") || strings.Contains(stderr, "error:"):
		return "runtime_error"
	case strings.Contains(status, "compilation") || strings.Contains(sum, "compilation"):
		return "compile_error"
	case strings.Contains(status, "runtime") || strings.Contains(sum, "runtime"):
		return "runtime_error"
	default:
		return "execution_failed"
	}
}

package handlers

import "strings"

// NormalizeJudgeOutput приводит stdout Judge0 и эталон из БД к одному виду для сравнения:
// CRLF→LF, trim, снятие хвостовых пробелов в строках.
func NormalizeJudgeOutput(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\r", "\n")
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	lines := strings.Split(s, "\n")
	for i, line := range lines {
		lines[i] = strings.TrimSpace(line)
	}
	return strings.TrimSpace(strings.Join(lines, "\n"))
}

package handlers

import "testing"

func TestNormalizeJudgeOutput(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"  hello  ", "hello"},
		{"a\r\nb", "a\nb"},
		{"line1  \n  line2\t  ", "line1\nline2"},
		{"", ""},
		{"\n\nx\n\n", "x"},
	}
	for _, c := range cases {
		got := NormalizeJudgeOutput(c.in)
		if got != c.want {
			t.Errorf("NormalizeJudgeOutput(%q) = %q; want %q", c.in, got, c.want)
		}
	}
}

package store

import (
	"encoding/json"
	"os"
)

type seedFile struct {
	Users            []seedUser                  `json:"users"`
	UserCompetencies map[string][]UserCompetency `json:"user_competencies"`
	Courses          []Course                    `json:"courses"`
	Lessons          []Lesson                    `json:"lessons"`
	Tasks            []Task                      `json:"tasks"`
}

type seedUser struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
	FullName string `json:"full_name"`
}

func NewMemoryFromJSON(path string) (*Memory, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var raw seedFile
	if err := json.Unmarshal(b, &raw); err != nil {
		return nil, err
	}
	return buildMemory(&raw)
}

package store

import (
	"context"
	"errors"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

var ErrNotFound = errors.New("not found")

const (
	studentID   = "a0000000-0000-4000-8000-000000000001"
	moderatorID = "a0000000-0000-4000-8000-000000000002"
)

type Memory struct {
	byID    map[string]*User
	byEmail map[string]*User
	comps   map[string][]UserCompetency
}

func NewMemory() (*Memory, error) {
	m := &Memory{
		byID:    make(map[string]*User),
		byEmail: make(map[string]*User),
		comps:   make(map[string][]UserCompetency),
	}
	seed := []struct {
		id, email, password, role, fullName string
	}{
		{studentID, "student@demo.local", "student123", "student", "Демо Студент"},
		{moderatorID, "moderator@demo.local", "mod123", "moderator", "Демо Модератор"},
	}
	for _, s := range seed {
		hash, err := bcrypt.GenerateFromPassword([]byte(s.password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		u := &User{
			ID:           s.id,
			Email:        s.email,
			PasswordHash: string(hash),
			Role:         s.role,
			FullName:     s.fullName,
		}
		m.byID[u.ID] = u
		m.byEmail[strings.ToLower(u.Email)] = u
	}
	m.comps[studentID] = []UserCompetency{
		{CompetencyID: "c1111111-1111-4111-8111-111111111111", CompetencyName: "Python", Level: 20},
		{CompetencyID: "c2222222-2222-4222-8222-222222222222", CompetencyName: "SQL", Level: 35},
	}
	m.comps[moderatorID] = []UserCompetency{
		{CompetencyID: "c3333333-3333-4333-8333-333333333333", CompetencyName: "Go", Level: 80},
	}
	return m, nil
}

func (m *Memory) FindByEmail(_ context.Context, email string) (*User, error) {
	u, ok := m.byEmail[strings.ToLower(strings.TrimSpace(email))]
	if !ok {
		return nil, ErrNotFound
	}
	return u, nil
}

func (m *Memory) GetByID(_ context.Context, id string) (*User, error) {
	u, ok := m.byID[id]
	if !ok {
		return nil, ErrNotFound
	}
	return u, nil
}

func (m *Memory) ListCompetencies(_ context.Context, userID string) ([]UserCompetency, error) {
	if c, ok := m.comps[userID]; ok {
		out := make([]UserCompetency, len(c))
		copy(out, c)
		return out, nil
	}
	return []UserCompetency{}, nil
}

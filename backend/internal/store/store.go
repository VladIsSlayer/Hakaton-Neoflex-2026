package store

import "context"

type User struct {
	ID           string
	Email        string
	PasswordHash string
	Role         string
	FullName     string
}

type UserCompetency struct {
	CompetencyID   string `json:"id"`
	CompetencyName string `json:"name"`
	Level          int    `json:"level"`
}

type UserStore interface {
	FindByEmail(ctx context.Context, email string) (*User, error)
	GetByID(ctx context.Context, id string) (*User, error)
	ListCompetencies(ctx context.Context, userID string) ([]UserCompetency, error)
}

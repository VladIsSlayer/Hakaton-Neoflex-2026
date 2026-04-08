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

type Course struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	IsPublished bool   `json:"is_published"`
}

type Lesson struct {
	ID          string `json:"id"`
	CourseID    string `json:"course_id"`
	Title       string `json:"title"`
	OrderIndex  int    `json:"order_index"`
	ContentBody string `json:"content_body"`
}

type CourseStore interface {
	ListPublishedCourses(ctx context.Context) ([]Course, error)
	ListLessonsForPublishedCourse(ctx context.Context, courseID string) ([]Lesson, error)
	CreateCourse(ctx context.Context, title, description string, isPublished bool) (Course, error)
}

type Task struct {
	ID              string `json:"id"`
	LessonID        string `json:"lesson_id"`
	LanguageID      int    `json:"language_id"`
	ReferenceAnswer string `json:"reference_answer"`
	CompetencyID    string `json:"competency_id"`
	CompetencyName  string `json:"competency_name"`
}

type TaskCheckStore interface {
	GetTask(ctx context.Context, taskID string) (*Task, error)
	RecordSuccessIfFirst(ctx context.Context, userID, taskID, userCode string) (alreadySolved bool, competencies []UserCompetency, courseProgressPercent int, err error)
}

const competencyPointsPerTask = 10
const competencyLevelMax = 100

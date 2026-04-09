package store

import (
	"context"
	"encoding/json"
)

type User struct {
	ID           string  `json:"id"`
	Email        string  `json:"email"`
	PasswordHash string  `json:"-"`
	Role         string  `json:"role"`
	FullName     string  `json:"full_name"`
	TgChatID     *string `json:"tg_chat_id,omitempty"`
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
	ID                string          `json:"id"`
	Title             string          `json:"title"`
	Description       string          `json:"description"`
	IsPublished       bool            `json:"is_published"`
	ContentBlocksJSON json.RawMessage `json:"content_blocks_json,omitempty"`
}

type Lesson struct {
	ID                  string          `json:"id"`
	CourseID            string          `json:"course_id"`
	Title               string          `json:"title"`
	OrderIndex          int             `json:"order_index"`
	ContentBody         string          `json:"content_body"`
	ContentBlocksJSON   json.RawMessage `json:"content_blocks_json,omitempty"`
	VideoEmbedURL       *string         `json:"video_embed_url,omitempty"`
	PracticeKind        *string         `json:"practice_kind,omitempty"`
	PracticeTitle       *string         `json:"practice_title,omitempty"`
	QuizQuestion        *string         `json:"quiz_question,omitempty"`
	QuizOptionsJSON     *string         `json:"quiz_options_json,omitempty"`
	QuizCorrectOption   *string         `json:"quiz_correct_option,omitempty"`
	IDETemplate         *string         `json:"ide_template,omitempty"`
	LessonTestsJSON     *string         `json:"tests_json,omitempty"`
	TaskID              *string         `json:"task_id,omitempty"`
}

type CourseStore interface {
	ListPublishedCourses(ctx context.Context) ([]Course, error)
	ListLessonsForPublishedCourse(ctx context.Context, courseID string) ([]Lesson, error)
	ListAllLessonsForPublishedCatalog(ctx context.Context) ([]Lesson, error)
	CreateCourse(ctx context.Context, title, description string, isPublished bool, contentBlocksJSON []byte) (Course, error)
}

type Task struct {
	ID              string `json:"id"`
	LessonID        string `json:"lesson_id"`
	LanguageID      int    `json:"language_id"`
	ReferenceAnswer string `json:"reference_answer"`
	CompetencyID    string `json:"competency_id"`
	CompetencyName  string `json:"competency_name"`
	TaskType        string `json:"task_type,omitempty"`
	PromptText      string `json:"prompt_text,omitempty"`
	TestsJSON       string `json:"tests_json,omitempty"`
}

type TaskCheckStore interface {
	GetTask(ctx context.Context, taskID string) (*Task, error)
	GetTaskForPublishedLesson(ctx context.Context, lessonID string) (*Task, error)
	RecordSuccessIfFirst(ctx context.Context, userID, taskID, userCode string) (alreadySolved bool, competencies []UserCompetency, courseProgressPercent int, err error)
}

const competencyPointsPerTask = 10
const competencyLevelMax = 100

type GitIssueBinding struct {
	UserID string `json:"user_id"`
	TaskID string `json:"task_id"`
}

type StudentCourseStat struct {
	UserID          string           `json:"user_id"`
	Email           string           `json:"email"`
	FullName        string           `json:"full_name"`
	ProgressPercent int              `json:"progress_percent"`
	Competencies    []UserCompetency `json:"competencies"`
}

type GitWebhookStore interface {
	ApplyGitIssueSuccess(ctx context.Context, issueKey string) (userID, taskID string, alreadySolved bool, competencies []UserCompetency, courseProgressPercent int, err error)
}

type AdminStatsStore interface {
	ListStudentStatsByCourse(ctx context.Context, courseID string) ([]StudentCourseStat, error)
}

// CourseEnrollmentCount — число записей на курс (для витрины / дашборда).
type CourseEnrollmentCount struct {
	CourseID    string `json:"course_id"`
	Enrollments int    `json:"enrollments"`
}

type EnrollmentStatsStore interface {
	ListEnrollmentCountsByCourse(ctx context.Context) ([]CourseEnrollmentCount, error)
}

// MeSnapshot — агрегат для личного кабинета (thin client).
type MeSnapshot struct {
	User              User                 `json:"user"`
	Competencies      []UserCompetency     `json:"competencies"`
	EnrolledCourses   []EnrolledCourseRow  `json:"enrolled_courses"`
	Submissions       []SubmissionSummary  `json:"submissions"`
	RecentSubmissions []SubmissionSummary  `json:"recent_submissions"`
	TaskStatuses      []ProfileTaskStatus  `json:"task_statuses"`
	AverageLevel      int                  `json:"average_competency_level"`
	TotalCompetencies int                  `json:"total_competencies_catalog"`
}

type EnrolledCourseRow struct {
	EnrollmentID     string `json:"enrollment_id"`
	UserID           string `json:"user_id"`
	CourseID         string `json:"course_id"`
	CourseTitle      string `json:"course_title"`
	ProgressPercent  int    `json:"progress_percent"`
	LessonsTotal     int    `json:"lessons_total"`
	LessonsCompleted int    `json:"lessons_completed"`
}

type SubmissionSummary struct {
	ID          string `json:"id"`
	TaskID      string `json:"task_id"`
	Status      string `json:"status"`
	LessonID    string `json:"lesson_id"`
	CourseID    string `json:"course_id"`
	LessonTitle string `json:"lesson_title"`
	CourseTitle string `json:"course_title"`
}

type ProfileTaskStatus struct {
	Course string `json:"course"`
	Task   string `json:"task"`
	Status string `json:"status"`
	Score  string `json:"score"`
}

type MeSnapshotStore interface {
	BuildMeSnapshot(ctx context.Context, userID string) (*MeSnapshot, error)
}

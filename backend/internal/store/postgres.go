package store

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Postgres struct {
	pool           *pgxpool.Pool
	hasGitBindings bool
}

func NewPostgres(ctx context.Context, databaseURL string) (*Postgres, error) {
	pool, err := pgxpool.New(ctx, strings.TrimSpace(databaseURL))
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	var has bool
	if err := pool.QueryRow(ctx, "SELECT to_regclass('public.git_issue_bindings') IS NOT NULL").Scan(&has); err != nil {
		pool.Close()
		return nil, err
	}

	return &Postgres{
		pool:           pool,
		hasGitBindings: has,
	}, nil
}

func (p *Postgres) Close() {
	if p.pool != nil {
		p.pool.Close()
	}
}

func (p *Postgres) FindByEmail(ctx context.Context, email string) (*User, error) {
	const q = `
SELECT id::text, email, password_hash, role, full_name
FROM public.users
WHERE lower(email) = lower($1)
LIMIT 1`
	var u User
	err := p.pool.QueryRow(ctx, q, strings.TrimSpace(email)).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Role, &u.FullName)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

func (p *Postgres) GetByID(ctx context.Context, id string) (*User, error) {
	const q = `
SELECT id::text, email, password_hash, role, full_name
FROM public.users
WHERE id = $1::uuid`
	var u User
	err := p.pool.QueryRow(ctx, q, strings.TrimSpace(id)).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Role, &u.FullName)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

func (p *Postgres) ListCompetencies(ctx context.Context, userID string) ([]UserCompetency, error) {
	const q = `
SELECT uc.competency_id::text, coalesce(c.name, ''), uc.level
FROM public.user_competencies uc
LEFT JOIN public.competencies c ON c.id = uc.competency_id
WHERE uc.user_id = $1::uuid`
	rows, err := p.pool.Query(ctx, q, strings.TrimSpace(userID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]UserCompetency, 0, 8)
	for rows.Next() {
		var c UserCompetency
		if err := rows.Scan(&c.CompetencyID, &c.CompetencyName, &c.Level); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CompetencyName < out[j].CompetencyName })
	return out, nil
}

func (p *Postgres) ListPublishedCourses(ctx context.Context) ([]Course, error) {
	const q = `
SELECT id::text, title, description, is_published
FROM public.courses
WHERE is_published = true
ORDER BY title ASC`
	rows, err := p.pool.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Course
	for rows.Next() {
		var c Course
		if err := rows.Scan(&c.ID, &c.Title, &c.Description, &c.IsPublished); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (p *Postgres) ListLessonsForPublishedCourse(ctx context.Context, courseID string) ([]Lesson, error) {
	const q = `
SELECT l.id::text, l.course_id::text, l.title, l.order_index, l.content_body
FROM public.lessons l
JOIN public.courses c ON c.id = l.course_id
WHERE l.course_id = $1::uuid
  AND c.is_published = true
ORDER BY l.order_index ASC`
	rows, err := p.pool.Query(ctx, q, strings.TrimSpace(courseID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Lesson
	for rows.Next() {
		var l Lesson
		if err := rows.Scan(&l.ID, &l.CourseID, &l.Title, &l.OrderIndex, &l.ContentBody); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(out) == 0 {
		return nil, ErrNotFound
	}
	return out, nil
}

func (p *Postgres) CreateCourse(ctx context.Context, title, description string, isPublished bool) (Course, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return Course{}, ErrEmptyTitle
	}
	const q = `
INSERT INTO public.courses (title, description, is_published)
VALUES ($1, $2, $3)
RETURNING id::text, title, description, is_published`
	var c Course
	err := p.pool.QueryRow(ctx, q, title, strings.TrimSpace(description), isPublished).
		Scan(&c.ID, &c.Title, &c.Description, &c.IsPublished)
	if err != nil {
		return Course{}, err
	}
	return c, nil
}

func (p *Postgres) GetTask(ctx context.Context, taskID string) (*Task, error) {
	const q = `
SELECT t.id::text, t.lesson_id::text, t.language_id, t.reference_answer, t.competency_id::text, coalesce(c.name, '')
FROM public.tasks t
LEFT JOIN public.competencies c ON c.id = t.competency_id
WHERE t.id = $1::uuid`
	var t Task
	err := p.pool.QueryRow(ctx, q, strings.TrimSpace(taskID)).
		Scan(&t.ID, &t.LessonID, &t.LanguageID, &t.ReferenceAnswer, &t.CompetencyID, &t.CompetencyName)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &t, nil
}

func (p *Postgres) RecordSuccessIfFirst(ctx context.Context, userID, taskID, userCode string) (bool, []UserCompetency, int, error) {
	tx, err := p.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return false, nil, 0, err
	}
	defer tx.Rollback(ctx)

	var courseID string
	var competencyID string
	const taskQ = `
SELECT l.course_id::text, t.competency_id::text
FROM public.tasks t
JOIN public.lessons l ON l.id = t.lesson_id
WHERE t.id = $1::uuid`
	if err := tx.QueryRow(ctx, taskQ, strings.TrimSpace(taskID)).Scan(&courseID, &competencyID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil, 0, ErrNotFound
		}
		return false, nil, 0, err
	}

	var exists bool
	const existsQ = `
SELECT EXISTS (
  SELECT 1
  FROM public.submissions
  WHERE user_id = $1::uuid
    AND task_id = $2::uuid
    AND status = 'success'
)`
	if err := tx.QueryRow(ctx, existsQ, strings.TrimSpace(userID), strings.TrimSpace(taskID)).Scan(&exists); err != nil {
		return false, nil, 0, err
	}
	if exists {
		comps, err := p.listCompetenciesTx(ctx, tx, userID)
		if err != nil {
			return false, nil, 0, err
		}
		pct, err := p.courseProgressPercentTx(ctx, tx, userID, courseID)
		if err != nil {
			return false, nil, 0, err
		}
		if err := tx.Commit(ctx); err != nil {
			return false, nil, 0, err
		}
		return true, comps, pct, nil
	}

	const insSubmissionQ = `
INSERT INTO public.submissions (user_id, task_id, status, user_code)
VALUES ($1::uuid, $2::uuid, 'success', $3)`
	if _, err := tx.Exec(ctx, insSubmissionQ, strings.TrimSpace(userID), strings.TrimSpace(taskID), userCode); err != nil {
		if isForeignKeyViolation(err) {
			return false, nil, 0, ErrNotFound
		}
		return false, nil, 0, err
	}

	const upsertCompQ = `
INSERT INTO public.user_competencies (user_id, competency_id, level)
VALUES ($1::uuid, $2::uuid, $3)
ON CONFLICT (user_id, competency_id)
DO UPDATE SET level = LEAST($4, public.user_competencies.level + $5)`
	if _, err := tx.Exec(ctx, upsertCompQ, strings.TrimSpace(userID), competencyID, competencyPointsPerTask, competencyLevelMax, competencyPointsPerTask); err != nil {
		return false, nil, 0, err
	}

	pct, err := p.courseProgressPercentTx(ctx, tx, userID, courseID)
	if err != nil {
		return false, nil, 0, err
	}
	const updEnrollmentQ = `
UPDATE public.enrollments
SET progress_percent = $3
WHERE user_id = $1::uuid AND course_id = $2::uuid`
	if _, err := tx.Exec(ctx, updEnrollmentQ, strings.TrimSpace(userID), courseID, pct); err != nil {
		return false, nil, 0, err
	}

	comps, err := p.listCompetenciesTx(ctx, tx, userID)
	if err != nil {
		return false, nil, 0, err
	}

	if err := tx.Commit(ctx); err != nil {
		return false, nil, 0, err
	}
	return false, comps, pct, nil
}

func (p *Postgres) ApplyGitIssueSuccess(ctx context.Context, issueKey string) (string, string, bool, []UserCompetency, int, error) {
	if !p.hasGitBindings {
		return "", "", false, nil, 0, ErrGitBindingNotFound
	}
	const q = `
SELECT user_id::text, task_id::text
FROM public.git_issue_bindings
WHERE upper(issue_key) = upper($1)
LIMIT 1`
	var userID string
	var taskID string
	err := p.pool.QueryRow(ctx, q, strings.ToUpper(strings.TrimSpace(issueKey))).Scan(&userID, &taskID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "", false, nil, 0, ErrGitBindingNotFound
		}
		return "", "", false, nil, 0, err
	}
	already, comps, pct, err := p.RecordSuccessIfFirst(ctx, userID, taskID, "git-webhook")
	if err != nil {
		return "", "", false, nil, 0, err
	}
	return userID, taskID, already, comps, pct, nil
}

func (p *Postgres) ListStudentStatsByCourse(ctx context.Context, courseID string) ([]StudentCourseStat, error) {
	const courseQ = `SELECT EXISTS (SELECT 1 FROM public.courses WHERE id = $1::uuid)`
	var has bool
	if err := p.pool.QueryRow(ctx, courseQ, strings.TrimSpace(courseID)).Scan(&has); err != nil {
		return nil, err
	}
	if !has {
		return nil, ErrNotFound
	}

	const usersQ = `
SELECT id::text, email, full_name
FROM public.users
WHERE role = 'student'
ORDER BY email ASC`
	rows, err := p.pool.Query(ctx, usersQ)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]StudentCourseStat, 0, 32)
	for rows.Next() {
		var s StudentCourseStat
		if err := rows.Scan(&s.UserID, &s.Email, &s.FullName); err != nil {
			return nil, err
		}
		pct, err := p.courseProgressPercent(ctx, s.UserID, courseID)
		if err != nil {
			return nil, err
		}
		s.ProgressPercent = pct
		s.Competencies, err = p.ListCompetencies(ctx, s.UserID)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].ProgressPercent != out[j].ProgressPercent {
			return out[i].ProgressPercent > out[j].ProgressPercent
		}
		return out[i].Email < out[j].Email
	})
	return out, nil
}

func (p *Postgres) listCompetenciesTx(ctx context.Context, tx pgx.Tx, userID string) ([]UserCompetency, error) {
	const q = `
SELECT uc.competency_id::text, coalesce(c.name, ''), uc.level
FROM public.user_competencies uc
LEFT JOIN public.competencies c ON c.id = uc.competency_id
WHERE uc.user_id = $1::uuid`
	rows, err := tx.Query(ctx, q, strings.TrimSpace(userID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []UserCompetency
	for rows.Next() {
		var c UserCompetency
		if err := rows.Scan(&c.CompetencyID, &c.CompetencyName, &c.Level); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CompetencyName < out[j].CompetencyName })
	return out, nil
}

func (p *Postgres) courseProgressPercent(ctx context.Context, userID, courseID string) (int, error) {
	return p.courseProgressPercentTx(ctx, p.pool, userID, courseID)
}

type queryRower interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func (p *Postgres) courseProgressPercentTx(ctx context.Context, q queryRower, userID, courseID string) (int, error) {
	const totalQ = `
SELECT count(*)
FROM public.tasks t
JOIN public.lessons l ON l.id = t.lesson_id
WHERE l.course_id = $1::uuid`
	var total int
	if err := q.QueryRow(ctx, totalQ, strings.TrimSpace(courseID)).Scan(&total); err != nil {
		return 0, err
	}
	if total == 0 {
		return 0, nil
	}

	const solvedQ = `
SELECT count(DISTINCT s.task_id)
FROM public.submissions s
JOIN public.tasks t ON t.id = s.task_id
JOIN public.lessons l ON l.id = t.lesson_id
WHERE s.user_id = $1::uuid
  AND s.status = 'success'
  AND l.course_id = $2::uuid`
	var solved int
	if err := q.QueryRow(ctx, solvedQ, strings.TrimSpace(userID), strings.TrimSpace(courseID)).Scan(&solved); err != nil {
		return 0, err
	}
	return solved * 100 / total, nil
}

func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return false
	}
	return pgErr.Code == "23503"
}

var _ UserStore = (*Postgres)(nil)
var _ CourseStore = (*Postgres)(nil)
var _ TaskCheckStore = (*Postgres)(nil)
var _ GitWebhookStore = (*Postgres)(nil)
var _ AdminStatsStore = (*Postgres)(nil)

func (p *Postgres) String() string {
	return fmt.Sprintf("PostgresStore(hasGitBindings=%v)", p.hasGitBindings)
}

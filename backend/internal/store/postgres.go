package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Postgres struct {
	pool           *pgxpool.Pool
	hasGitBindings bool
}

type PostgresOptions struct {
	MaxConns         int32
	MinConns         int32
	MaxConnLifetime  time.Duration
	MaxConnIdleTime  time.Duration
	HealthCheckEvery time.Duration
}

func NewPostgres(ctx context.Context, databaseURL string, opts PostgresOptions) (*Postgres, error) {
	cfg, err := pgxpool.ParseConfig(strings.TrimSpace(databaseURL))
	if err != nil {
		return nil, err
	}
	if opts.MaxConns > 0 {
		cfg.MaxConns = opts.MaxConns
	}
	if opts.MinConns > 0 {
		cfg.MinConns = opts.MinConns
	}
	if opts.MaxConnLifetime > 0 {
		cfg.MaxConnLifetime = opts.MaxConnLifetime
	}
	if opts.MaxConnIdleTime > 0 {
		cfg.MaxConnIdleTime = opts.MaxConnIdleTime
	}
	if opts.HealthCheckEvery > 0 {
		cfg.HealthCheckPeriod = opts.HealthCheckEvery
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
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

func (p *Postgres) Ping(ctx context.Context) error {
	if p.pool == nil {
		return errors.New("postgres pool is nil")
	}
	return p.pool.Ping(ctx)
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
SELECT id::text, email, password_hash, role, full_name, tg_chat_id
FROM public.users
WHERE id = $1::uuid`
	var u User
	var tg sql.NullString
	err := p.pool.QueryRow(ctx, q, strings.TrimSpace(id)).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Role, &u.FullName, &tg)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if tg.Valid {
		s := strings.TrimSpace(tg.String)
		if s != "" {
			u.TgChatID = &s
		}
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
SELECT id::text, title, description, is_published, content_blocks_json
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
		var blocks []byte
		if err := rows.Scan(&c.ID, &c.Title, &c.Description, &c.IsPublished, &blocks); err != nil {
			return nil, err
		}
		c.ContentBlocksJSON = bytesToRawJSON(blocks)
		out = append(out, c)
	}
	return out, rows.Err()
}

func (p *Postgres) ListLessonsForPublishedCourse(ctx context.Context, courseID string) ([]Lesson, error) {
	const q = `
SELECT l.id::text, l.course_id::text, l.title, l.order_index, l.content_body,
       l.content_blocks_json, l.video_embed_url, l.practice_kind, l.practice_title,
       l.quiz_question, l.quiz_options_json, l.quiz_correct_option, l.ide_template, l.tests_json,
       (SELECT t.id::text FROM public.tasks t WHERE t.lesson_id = l.id ORDER BY t.id LIMIT 1) AS task_id
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
		l, err := scanLessonRow(rows)
		if err != nil {
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

func (p *Postgres) ListAllLessonsForPublishedCatalog(ctx context.Context) ([]Lesson, error) {
	const q = `
SELECT l.id::text, l.course_id::text, l.title, l.order_index, l.content_body,
       l.content_blocks_json, l.video_embed_url, l.practice_kind, l.practice_title,
       l.quiz_question, l.quiz_options_json, l.quiz_correct_option, l.ide_template, l.tests_json,
       (SELECT t.id::text FROM public.tasks t WHERE t.lesson_id = l.id ORDER BY t.id LIMIT 1) AS task_id
FROM public.lessons l
JOIN public.courses c ON c.id = l.course_id
WHERE c.is_published = true
ORDER BY c.title ASC, l.order_index ASC`
	rows, err := p.pool.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Lesson
	for rows.Next() {
		l, err := scanLessonRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func (p *Postgres) CreateCourse(ctx context.Context, title, description string, isPublished bool, contentBlocksJSON []byte) (Course, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return Course{}, ErrEmptyTitle
	}
	const q = `
INSERT INTO public.courses (title, description, is_published, content_blocks_json)
VALUES ($1, $2, $3, $4)
RETURNING id::text, title, description, is_published, content_blocks_json`
	var c Course
	var blocksArg any
	if len(contentBlocksJSON) > 0 {
		blocksArg = contentBlocksJSON
	}
	var retBlocks []byte
	err := p.pool.QueryRow(ctx, q, title, strings.TrimSpace(description), isPublished, blocksArg).
		Scan(&c.ID, &c.Title, &c.Description, &c.IsPublished, &retBlocks)
	if err != nil {
		return Course{}, err
	}
	c.ContentBlocksJSON = bytesToRawJSON(retBlocks)
	return c, nil
}

func (p *Postgres) GetTask(ctx context.Context, taskID string) (*Task, error) {
	const q = `
SELECT t.id::text, t.lesson_id::text, t.language_id, t.reference_answer, t.competency_id::text, coalesce(c.name, ''),
       t.task_type, t.prompt_text, t.tests_json
FROM public.tasks t
LEFT JOIN public.competencies c ON c.id = t.competency_id
WHERE t.id = $1::uuid`
	var t Task
	var taskType, promptText, testsJ sql.NullString
	err := p.pool.QueryRow(ctx, q, strings.TrimSpace(taskID)).
		Scan(&t.ID, &t.LessonID, &t.LanguageID, &t.ReferenceAnswer, &t.CompetencyID, &t.CompetencyName,
			&taskType, &promptText, &testsJ)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	t.TaskType = nullStringOrEmpty(taskType)
	t.PromptText = nullStringOrEmpty(promptText)
	t.TestsJSON = nullStringOrEmpty(testsJ)
	return &t, nil
}

func (p *Postgres) GetTaskForPublishedLesson(ctx context.Context, lessonID string) (*Task, error) {
	const q = `
SELECT t.id::text, t.lesson_id::text, t.language_id, t.reference_answer, t.competency_id::text, coalesce(c.name, ''),
       t.task_type, t.prompt_text, t.tests_json
FROM public.tasks t
JOIN public.lessons l ON l.id = t.lesson_id
JOIN public.courses co ON co.id = l.course_id
WHERE l.id = $1::uuid AND co.is_published = true
ORDER BY t.id
LIMIT 1`
	var t Task
	var taskType, promptText, testsJ sql.NullString
	err := p.pool.QueryRow(ctx, q, strings.TrimSpace(lessonID)).
		Scan(&t.ID, &t.LessonID, &t.LanguageID, &t.ReferenceAnswer, &t.CompetencyID, &t.CompetencyName,
			&taskType, &promptText, &testsJ)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	t.TaskType = nullStringOrEmpty(taskType)
	t.PromptText = nullStringOrEmpty(promptText)
	t.TestsJSON = nullStringOrEmpty(testsJ)
	return &t, nil
}

func (p *Postgres) ListEnrollmentCountsByCourse(ctx context.Context) ([]CourseEnrollmentCount, error) {
	const q = `
SELECT course_id::text, count(*)::int
FROM public.enrollments
GROUP BY course_id`
	rows, err := p.pool.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []CourseEnrollmentCount
	for rows.Next() {
		var r CourseEnrollmentCount
		if err := rows.Scan(&r.CourseID, &r.Enrollments); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (p *Postgres) BuildMeSnapshot(ctx context.Context, userID string) (*MeSnapshot, error) {
	u, err := p.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	comps, err := p.ListCompetencies(ctx, userID)
	if err != nil {
		return nil, err
	}

	const enrollQ = `
SELECT e.id::text, e.user_id::text, e.course_id::text, c.title, e.progress_percent
FROM public.enrollments e
JOIN public.courses c ON c.id = e.course_id
WHERE e.user_id = $1::uuid`
	erows, err := p.pool.Query(ctx, enrollQ, strings.TrimSpace(userID))
	if err != nil {
		return nil, err
	}
	type enrRow struct {
		eid, uid, cid, title string
		progress             int
	}
	var enrs []enrRow
	for erows.Next() {
		var r enrRow
		if err := erows.Scan(&r.eid, &r.uid, &r.cid, &r.title, &r.progress); err != nil {
			erows.Close()
			return nil, err
		}
		enrs = append(enrs, r)
	}
	erows.Close()
	if err := erows.Err(); err != nil {
		return nil, err
	}

	lessonCountByCourse := make(map[string]int)
	for _, r := range enrs {
		var n int
		if err := p.pool.QueryRow(ctx, `SELECT count(*)::int FROM public.lessons WHERE course_id = $1::uuid`, r.cid).Scan(&n); err != nil {
			return nil, err
		}
		lessonCountByCourse[r.cid] = n
	}

	enrolled := make([]EnrolledCourseRow, 0, len(enrs))
	for _, r := range enrs {
		pct := r.progress
		if pct < 0 {
			pct = 0
		}
		if pct > 100 {
			pct = 100
		}
		lt := lessonCountByCourse[r.cid]
		lc := 0
		if lt > 0 {
			lc = (pct * lt + 50) / 100
		}
		enrolled = append(enrolled, EnrolledCourseRow{
			EnrollmentID:     r.eid,
			UserID:           r.uid,
			CourseID:         r.cid,
			CourseTitle:      r.title,
			ProgressPercent:  pct,
			LessonsTotal:     lt,
			LessonsCompleted: lc,
		})
	}

	const subQ = `
SELECT s.id::text, s.task_id::text, s.status, le.id::text, le.course_id::text, le.title, co.title
FROM public.submissions s
JOIN public.tasks t ON t.id = s.task_id
JOIN public.lessons le ON le.id = t.lesson_id
JOIN public.courses co ON co.id = le.course_id
WHERE s.user_id = $1::uuid
ORDER BY s.id DESC
LIMIT 200`
	srows, err := p.pool.Query(ctx, subQ, strings.TrimSpace(userID))
	if err != nil {
		return nil, err
	}
	var subs []SubmissionSummary
	var taskSt []ProfileTaskStatus
	for srows.Next() {
		var s SubmissionSummary
		if err := srows.Scan(&s.ID, &s.TaskID, &s.Status, &s.LessonID, &s.CourseID, &s.LessonTitle, &s.CourseTitle); err != nil {
			srows.Close()
			return nil, err
		}
		subs = append(subs, s)
		st := "На проверке"
		score := "0"
		if strings.EqualFold(s.Status, "success") {
			st = "Принято"
			score = "10"
		} else if strings.EqualFold(s.Status, "failed") {
			st = "Отклонено"
		}
		taskSt = append(taskSt, ProfileTaskStatus{
			Course: s.CourseTitle,
			Task:   s.LessonTitle,
			Status: st,
			Score:  score,
		})
	}
	srows.Close()
	if err := srows.Err(); err != nil {
		return nil, err
	}

	var totalCat int
	if err := p.pool.QueryRow(ctx, `SELECT count(*)::int FROM public.competencies`).Scan(&totalCat); err != nil {
		return nil, err
	}
	avg := 0
	if len(comps) > 0 {
		sum := 0
		for _, c := range comps {
			sum += c.Level
		}
		avg = (sum + len(comps)/2) / len(comps)
	}

	recent := subs
	if len(recent) > 5 {
		recent = subs[:5]
	}

	return &MeSnapshot{
		User:              *u,
		Competencies:      comps,
		EnrolledCourses:   enrolled,
		Submissions:       subs,
		RecentSubmissions: recent,
		TaskStatuses:      taskSt,
		AverageLevel:      avg,
		TotalCompetencies: totalCat,
	}, nil
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

	const insSubmissionQ = `
INSERT INTO public.submissions (user_id, task_id, status, user_code)
VALUES ($1::uuid, $2::uuid, 'success', $3)
ON CONFLICT (user_id, task_id) WHERE status = 'success' DO NOTHING`
	submissionResult, err := tx.Exec(ctx, insSubmissionQ, strings.TrimSpace(userID), strings.TrimSpace(taskID), userCode)
	if err != nil {
		if isForeignKeyViolation(err) {
			return false, nil, 0, ErrNotFound
		}
		return false, nil, 0, err
	}
	if submissionResult.RowsAffected() == 0 {
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
	const upsertEnrollmentQ = `
INSERT INTO public.enrollments (user_id, course_id, progress_percent)
VALUES ($1::uuid, $2::uuid, $3)
ON CONFLICT (user_id, course_id)
DO UPDATE SET progress_percent = EXCLUDED.progress_percent`
	if _, err := tx.Exec(ctx, upsertEnrollmentQ, strings.TrimSpace(userID), courseID, pct); err != nil {
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

func bytesToRawJSON(b []byte) json.RawMessage {
	if len(b) == 0 || string(b) == "null" {
		return nil
	}
	out := make([]byte, len(b))
	copy(out, b)
	return json.RawMessage(out)
}

func nullStringPtr(ns sql.NullString) *string {
	if !ns.Valid {
		return nil
	}
	s := ns.String
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return &s
}

func nullStringOrEmpty(ns sql.NullString) string {
	if !ns.Valid {
		return ""
	}
	return ns.String
}

func scanLessonRow(row pgx.Row) (Lesson, error) {
	var l Lesson
	var blocks []byte
	var video, practiceKind, practiceTitle, quizQ, quizOpts, quizCorrect, ideTpl, testsJ, taskID sql.NullString
	err := row.Scan(
		&l.ID, &l.CourseID, &l.Title, &l.OrderIndex, &l.ContentBody,
		&blocks, &video, &practiceKind, &practiceTitle, &quizQ, &quizOpts, &quizCorrect, &ideTpl, &testsJ,
		&taskID,
	)
	if err != nil {
		return Lesson{}, err
	}
	l.ContentBlocksJSON = bytesToRawJSON(blocks)
	l.VideoEmbedURL = nullStringPtr(video)
	l.PracticeKind = nullStringPtr(practiceKind)
	l.PracticeTitle = nullStringPtr(practiceTitle)
	l.QuizQuestion = nullStringPtr(quizQ)
	l.QuizOptionsJSON = nullStringPtr(quizOpts)
	l.QuizCorrectOption = nullStringPtr(quizCorrect)
	l.IDETemplate = nullStringPtr(ideTpl)
	l.LessonTestsJSON = nullStringPtr(testsJ)
	l.TaskID = nullStringPtr(taskID)
	return l, nil
}

var _ UserStore = (*Postgres)(nil)
var _ CourseStore = (*Postgres)(nil)
var _ TaskCheckStore = (*Postgres)(nil)
var _ GitWebhookStore = (*Postgres)(nil)
var _ AdminStatsStore = (*Postgres)(nil)
var _ EnrollmentStatsStore = (*Postgres)(nil)
var _ MeSnapshotStore = (*Postgres)(nil)

func (p *Postgres) String() string {
	return fmt.Sprintf("PostgresStore(hasGitBindings=%v)", p.hasGitBindings)
}

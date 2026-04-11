package store

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"strings"
	"sync"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrNotFound              = errors.New("not found")
	ErrEmptyTitle            = errors.New("empty course title")
	ErrEmptyReferenceAnswer  = errors.New("reference answer required")
	ErrGitBindingNotFound    = errors.New("git issue not mapped")
	ErrEmailTaken            = errors.New("email already registered")
)

type Memory struct {
	mu              sync.RWMutex
	byID            map[string]*User
	byEmail         map[string]*User
	comps           map[string][]UserCompetency
	coursesByID     map[string]*Course
	lessonsByCourse map[string][]Lesson
	tasksByID       map[string]*Task
	lessonCourse    map[string]string
	tasksByCourse   map[string][]string
	successKey      map[string]struct{}
	gitBindings     map[string]GitIssueBinding
	enrolled        map[string]struct{}
	competencyNames map[string]string
}

func buildMemory(raw *seedFile) (*Memory, error) {
	m := &Memory{
		byID:            make(map[string]*User),
		byEmail:         make(map[string]*User),
		comps:           make(map[string][]UserCompetency),
		coursesByID:     make(map[string]*Course),
		lessonsByCourse: make(map[string][]Lesson),
		tasksByID:       make(map[string]*Task),
		lessonCourse:    make(map[string]string),
		tasksByCourse:   make(map[string][]string),
		successKey:      make(map[string]struct{}),
		gitBindings:     make(map[string]GitIssueBinding),
		enrolled:        make(map[string]struct{}),
		competencyNames: make(map[string]string),
	}
	for _, su := range raw.Users {
		emailKey := strings.ToLower(strings.TrimSpace(su.Email))
		if emailKey == "" {
			continue
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(su.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		u := &User{
			ID:           su.ID,
			Email:        su.Email,
			PasswordHash: string(hash),
			Role:         su.Role,
			FullName:     su.FullName,
		}
		if su.TgChatID != nil {
			s := strings.TrimSpace(*su.TgChatID)
			if s != "" {
				u.TgChatID = &s
			}
		}
		m.byID[u.ID] = u
		m.byEmail[emailKey] = u
	}
	for uid, list := range raw.UserCompetencies {
		out := make([]UserCompetency, len(list))
		copy(out, list)
		m.comps[uid] = out
	}
	for i := range raw.Courses {
		c := raw.Courses[i]
		cCopy := c
		m.coursesByID[c.ID] = &cCopy
	}
	tmp := make(map[string][]Lesson)
	for i := range raw.Lessons {
		les := raw.Lessons[i]
		m.lessonCourse[les.ID] = les.CourseID
		tmp[les.CourseID] = append(tmp[les.CourseID], les)
	}
	for cid, list := range tmp {
		sort.Slice(list, func(i, j int) bool { return list[i].OrderIndex < list[j].OrderIndex })
		cp := make([]Lesson, len(list))
		copy(cp, list)
		m.lessonsByCourse[cid] = cp
	}
	for i := range raw.Tasks {
		t := raw.Tasks[i]
		tCopy := t
		m.tasksByID[t.ID] = &tCopy
		if t.CompetencyID != "" && t.CompetencyName != "" {
			m.competencyNames[t.CompetencyID] = t.CompetencyName
		}
		courseID := m.lessonCourse[t.LessonID]
		if courseID != "" {
			m.tasksByCourse[courseID] = append(m.tasksByCourse[courseID], t.ID)
		}
	}
	for k, v := range raw.GitIssueBindings {
		key := strings.ToUpper(strings.TrimSpace(k))
		if key == "" || v.UserID == "" || v.TaskID == "" {
			continue
		}
		m.gitBindings[key] = GitIssueBinding{UserID: v.UserID, TaskID: v.TaskID}
	}
	return m, nil
}

func (m *Memory) ApplyGitIssueSuccess(ctx context.Context, issueKey string) (userID, taskID string, alreadySolved bool, comps []UserCompetency, courseProgress int, err error) {
	key := strings.ToUpper(strings.TrimSpace(issueKey))
	m.mu.RLock()
	b, ok := m.gitBindings[key]
	if !ok {
		m.mu.RUnlock()
		return "", "", false, nil, 0, ErrGitBindingNotFound
	}
	if _, uok := m.byID[b.UserID]; !uok {
		m.mu.RUnlock()
		return "", "", false, nil, 0, ErrNotFound
	}
	if _, tok := m.tasksByID[b.TaskID]; !tok {
		m.mu.RUnlock()
		return "", "", false, nil, 0, ErrNotFound
	}
	m.mu.RUnlock()
	alreadySolved, comps, courseProgress, err = m.RecordSuccessIfFirst(ctx, b.UserID, b.TaskID, "git-webhook")
	return b.UserID, b.TaskID, alreadySolved, comps, courseProgress, err
}

func (m *Memory) ListStudentStatsByCourse(_ context.Context, courseID string) ([]StudentCourseStat, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if _, ok := m.coursesByID[courseID]; !ok {
		return nil, ErrNotFound
	}
	var out []StudentCourseStat
	for _, u := range m.byID {
		if u.Role != "student" {
			continue
		}
		pct := m.courseProgressPercentLocked(u.ID, courseID)
		comps := copyCompetencies(m.comps[u.ID])
		out = append(out, StudentCourseStat{
			UserID:          u.ID,
			Email:           u.Email,
			FullName:        u.FullName,
			ProgressPercent: pct,
			Competencies:    comps,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].ProgressPercent != out[j].ProgressPercent {
			return out[i].ProgressPercent > out[j].ProgressPercent
		}
		return out[i].Email < out[j].Email
	})
	return out, nil
}

func successMapKey(userID, taskID string) string {
	return userID + "\x00" + taskID
}

func (m *Memory) GetTask(_ context.Context, taskID string) (*Task, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	t, ok := m.tasksByID[taskID]
	if !ok {
		return nil, ErrNotFound
	}
	c := *t
	return &c, nil
}

func (m *Memory) courseProgressPercentLocked(userID, courseID string) int {
	ids := m.tasksByCourse[courseID]
	if len(ids) == 0 {
		return 0
	}
	solved := 0
	for _, tid := range ids {
		if _, ok := m.successKey[successMapKey(userID, tid)]; ok {
			solved++
		}
	}
	return solved * 100 / len(ids)
}

func copyCompetencies(list []UserCompetency) []UserCompetency {
	out := make([]UserCompetency, len(list))
	copy(out, list)
	return out
}

func (m *Memory) RecordSuccessIfFirst(_ context.Context, userID, taskID, userCode string) (bool, []UserCompetency, int, error) {
	_ = userCode
	m.mu.Lock()
	defer m.mu.Unlock()
	t, ok := m.tasksByID[taskID]
	if !ok {
		return false, nil, 0, ErrNotFound
	}
	courseID := m.lessonCourse[t.LessonID]
	key := successMapKey(userID, taskID)
	if _, done := m.successKey[key]; done {
		comps := m.comps[userID]
		pct := m.courseProgressPercentLocked(userID, courseID)
		return true, copyCompetencies(comps), pct, nil
	}
	m.successKey[key] = struct{}{}

	list := m.comps[userID]
	found := false
	for i := range list {
		if list[i].CompetencyID == t.CompetencyID {
			nv := list[i].Level + competencyPointsPerTask
			if nv > competencyLevelMax {
				nv = competencyLevelMax
			}
			list[i].Level = nv
			found = true
			break
		}
	}
	if !found {
		lv := competencyPointsPerTask
		if lv > competencyLevelMax {
			lv = competencyLevelMax
		}
		m.comps[userID] = append(list, UserCompetency{
			CompetencyID:   t.CompetencyID,
			CompetencyName: t.CompetencyName,
			Level:          lv,
		})
	}
	pct := m.courseProgressPercentLocked(userID, courseID)
	comps := m.comps[userID]
	return false, copyCompetencies(comps), pct, nil
}

func (m *Memory) FindByEmail(_ context.Context, email string) (*User, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	u, ok := m.byEmail[strings.ToLower(strings.TrimSpace(email))]
	if !ok {
		return nil, ErrNotFound
	}
	return u, nil
}

func (m *Memory) GetByID(_ context.Context, id string) (*User, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	u, ok := m.byID[id]
	if !ok {
		return nil, ErrNotFound
	}
	return u, nil
}

func (m *Memory) ListCompetencies(_ context.Context, userID string) ([]UserCompetency, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if c, ok := m.comps[userID]; ok {
		out := make([]UserCompetency, len(c))
		copy(out, c)
		return out, nil
	}
	return []UserCompetency{}, nil
}

func (m *Memory) ListPublishedCourses(_ context.Context) ([]Course, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var out []Course
	for _, c := range m.coursesByID {
		if c.IsPublished {
			out = append(out, *c)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Title < out[j].Title })
	return out, nil
}

func (m *Memory) ListLessonsForPublishedCourse(_ context.Context, courseID string) ([]Lesson, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	c, ok := m.coursesByID[courseID]
	if !ok || !c.IsPublished {
		return nil, ErrNotFound
	}
	list := m.lessonsByCourse[courseID]
	out := make([]Lesson, len(list))
	for i := range list {
		out[i] = list[i]
		out[i].TaskID = m.taskIDForLessonLocked(list[i].ID)
	}
	return out, nil
}

func (m *Memory) ListAllLessonsForPublishedCatalog(_ context.Context) ([]Lesson, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var out []Lesson
	for _, c := range m.coursesByID {
		if !c.IsPublished {
			continue
		}
		for _, les := range m.lessonsByCourse[c.ID] {
			l := les
			l.TaskID = m.taskIDForLessonLocked(l.ID)
			out = append(out, l)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].CourseID != out[j].CourseID {
			ci := m.coursesByID[out[i].CourseID]
			cj := m.coursesByID[out[j].CourseID]
			if ci != nil && cj != nil && ci.Title != cj.Title {
				return ci.Title < cj.Title
			}
		}
		return out[i].OrderIndex < out[j].OrderIndex
	})
	return out, nil
}

func (m *Memory) taskIDForLessonLocked(lessonID string) *string {
	for _, t := range m.tasksByID {
		if t.LessonID == lessonID {
			s := t.ID
			return &s
		}
	}
	return nil
}

func (m *Memory) GetTaskForPublishedLesson(_ context.Context, lessonID string) (*Task, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	cid := m.lessonCourse[lessonID]
	if cid == "" {
		return nil, ErrNotFound
	}
	c := m.coursesByID[cid]
	if c == nil || !c.IsPublished {
		return nil, ErrNotFound
	}
	for _, t := range m.tasksByID {
		if t.LessonID == lessonID {
			tCopy := *t
			return &tCopy, nil
		}
	}
	return nil, ErrNotFound
}

func (m *Memory) ListEnrollmentCountsByCourse(_ context.Context) ([]CourseEnrollmentCount, error) {
	return nil, nil
}

func (m *Memory) BuildMeSnapshot(ctx context.Context, userID string) (*MeSnapshot, error) {
	u, err := m.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	comps, err := m.ListCompetencies(ctx, userID)
	if err != nil {
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
	return &MeSnapshot{
		User:              *u,
		Competencies:      comps,
		EnrolledCourses:   nil,
		Submissions:       nil,
		RecentSubmissions: nil,
		TaskStatuses:      nil,
		AverageLevel:      avg,
		TotalCompetencies: 0,
	}, nil
}

func (m *Memory) CreateCourse(_ context.Context, title, description string, isPublished bool, contentBlocksJSON []byte) (Course, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return Course{}, ErrEmptyTitle
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	id, err := newUUIDv4()
	if err != nil {
		return Course{}, err
	}
	c := Course{
		ID:          id,
		Title:       title,
		Description: strings.TrimSpace(description),
		IsPublished: isPublished,
	}
	if len(contentBlocksJSON) > 0 {
		c.ContentBlocksJSON = append([]byte(nil), contentBlocksJSON...)
	}
	cCopy := c
	m.coursesByID[c.ID] = &cCopy
	m.lessonsByCourse[c.ID] = nil
	return c, nil
}

func enrollKey(userID, courseID string) string {
	return userID + "\x00" + courseID
}

func (m *Memory) CreateStudent(_ context.Context, email, fullName, passwordHash string) (*User, error) {
	email = strings.TrimSpace(email)
	fullName = strings.TrimSpace(fullName)
	key := strings.ToLower(email)
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, taken := m.byEmail[key]; taken {
		return nil, ErrEmailTaken
	}
	id, err := newUUIDv4()
	if err != nil {
		return nil, err
	}
	u := &User{
		ID:           id,
		Email:        email,
		PasswordHash: passwordHash,
		Role:         "student",
		FullName:     fullName,
	}
	m.byID[id] = u
	m.byEmail[key] = u
	m.comps[id] = nil
	return u, nil
}

func (m *Memory) GetCourseByID(_ context.Context, courseID string) (*Course, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	c, ok := m.coursesByID[strings.TrimSpace(courseID)]
	if !ok {
		return nil, ErrNotFound
	}
	cp := *c
	return &cp, nil
}

func (m *Memory) CreateLesson(_ context.Context, pIn CreateLessonParams) (Lesson, error) {
	title := strings.TrimSpace(pIn.Title)
	if title == "" {
		return Lesson{}, ErrEmptyTitle
	}
	courseID := strings.TrimSpace(pIn.CourseID)
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.coursesByID[courseID]; !ok {
		return Lesson{}, ErrNotFound
	}
	id, err := newUUIDv4()
	if err != nil {
		return Lesson{}, err
	}
	var blocks json.RawMessage
	if len(pIn.ContentBlocksJSON) > 0 {
		blocks = append(json.RawMessage(nil), pIn.ContentBlocksJSON...)
	}
	l := Lesson{
		ID:                  id,
		CourseID:            courseID,
		Title:               title,
		OrderIndex:          pIn.OrderIndex,
		ContentBody:         strings.TrimSpace(pIn.ContentBody),
		ContentBlocksJSON:   blocks,
		VideoEmbedURL:       pIn.VideoEmbedURL,
		PracticeKind:        pIn.PracticeKind,
		PracticeTitle:       pIn.PracticeTitle,
		QuizQuestion:        pIn.QuizQuestion,
		QuizOptionsJSON:     pIn.QuizOptionsJSON,
		QuizCorrectOption:   pIn.QuizCorrectOption,
		IDETemplate:         pIn.IDETemplate,
		LessonTestsJSON:     pIn.TestsJSON,
	}
	m.lessonCourse[id] = courseID
	list := append(m.lessonsByCourse[courseID], l)
	sort.Slice(list, func(i, j int) bool { return list[i].OrderIndex < list[j].OrderIndex })
	m.lessonsByCourse[courseID] = list
	l.TaskID = m.taskIDForLessonLocked(id)
	return l, nil
}

func (m *Memory) CreateTask(_ context.Context, pIn CreateTaskParams) (Task, error) {
	ref := strings.TrimSpace(pIn.ReferenceAnswer)
	if ref == "" {
		return Task{}, ErrEmptyReferenceAnswer
	}
	lessonID := strings.TrimSpace(pIn.LessonID)
	compID := strings.TrimSpace(pIn.CompetencyID)
	m.mu.Lock()
	defer m.mu.Unlock()
	courseID, ok := m.lessonCourse[lessonID]
	if !ok {
		return Task{}, ErrNotFound
	}
	name, cok := m.competencyNames[compID]
	if !cok {
		return Task{}, ErrNotFound
	}
	id, err := newUUIDv4()
	if err != nil {
		return Task{}, err
	}
	var tt, pt, tests string
	if pIn.TaskType != nil {
		tt = strings.TrimSpace(*pIn.TaskType)
	}
	if pIn.PromptText != nil {
		pt = strings.TrimSpace(*pIn.PromptText)
	}
	if pIn.TestsJSON != nil {
		tests = strings.TrimSpace(*pIn.TestsJSON)
	}
	t := Task{
		ID:              id,
		LessonID:        lessonID,
		LanguageID:      pIn.LanguageID,
		ReferenceAnswer: ref,
		CompetencyID:    compID,
		CompetencyName:  name,
		TaskType:        tt,
		PromptText:      pt,
		TestsJSON:       tests,
	}
	tCopy := t
	m.tasksByID[id] = &tCopy
	if courseID != "" {
		m.tasksByCourse[courseID] = append(m.tasksByCourse[courseID], id)
	}
	return t, nil
}

func (m *Memory) InsertFailedSubmission(_ context.Context, _, _, _ string) error {
	return nil
}

func (m *Memory) EnrollStudentInPublishedCourse(_ context.Context, userID, courseID string) error {
	userID = strings.TrimSpace(userID)
	courseID = strings.TrimSpace(courseID)
	m.mu.Lock()
	defer m.mu.Unlock()
	c, ok := m.coursesByID[courseID]
	if !ok || !c.IsPublished {
		return ErrNotFound
	}
	k := enrollKey(userID, courseID)
	if _, ok := m.enrolled[k]; ok {
		return nil
	}
	m.enrolled[k] = struct{}{}
	return nil
}

var (
	_ UserStore          = (*Memory)(nil)
	_ CourseStore        = (*Memory)(nil)
	_ TaskCheckStore     = (*Memory)(nil)
	_ EnrollmentWriter   = (*Memory)(nil)
	_ GitWebhookStore    = (*Memory)(nil)
	_ AdminStatsStore    = (*Memory)(nil)
	_ EnrollmentStatsStore = (*Memory)(nil)
	_ MeSnapshotStore    = (*Memory)(nil)
)

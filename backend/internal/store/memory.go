package store

import (
	"context"
	"errors"
	"sort"
	"strings"
	"sync"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrNotFound   = errors.New("not found")
	ErrEmptyTitle = errors.New("empty course title")
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
		courseID := m.lessonCourse[t.LessonID]
		if courseID != "" {
			m.tasksByCourse[courseID] = append(m.tasksByCourse[courseID], t.ID)
		}
	}
	return m, nil
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
	copy(out, list)
	return out, nil
}

func (m *Memory) CreateCourse(_ context.Context, title, description string, isPublished bool) (Course, error) {
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
	cCopy := c
	m.coursesByID[c.ID] = &cCopy
	m.lessonsByCourse[c.ID] = nil
	return c, nil
}

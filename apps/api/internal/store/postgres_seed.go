package store

import (
	"context"
	"fmt"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// PublishedCourseCount returns the number of published courses (for seed-if-empty checks).
func (p *Postgres) PublishedCourseCount(ctx context.Context) (int, error) {
	var n int
	err := p.pool.QueryRow(ctx, `SELECT count(*)::int FROM public.courses WHERE is_published = true`).Scan(&n)
	return n, err
}

// SeedFromJSON inserts demo rows from the same format as data/seed.json (idempotent ON CONFLICT DO NOTHING / DO UPDATE where needed).
func (p *Postgres) SeedFromJSON(ctx context.Context, path string) error {
	raw, err := readSeedFile(path)
	if err != nil {
		return err
	}

	compNames := make(map[string]string)
	for _, t := range raw.Tasks {
		if id := strings.TrimSpace(t.CompetencyID); id != "" {
			if n := strings.TrimSpace(t.CompetencyName); n != "" {
				compNames[id] = n
			}
		}
	}
	for _, list := range raw.UserCompetencies {
		for _, uc := range list {
			if id := strings.TrimSpace(uc.CompetencyID); id != "" {
				if n := strings.TrimSpace(uc.CompetencyName); n != "" {
					compNames[id] = n
				}
			}
		}
	}

	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for id, name := range compNames {
		if _, err := tx.Exec(ctx, `
INSERT INTO public.competencies (id, name) VALUES ($1::uuid, $2)
ON CONFLICT (id) DO NOTHING`, id, name); err != nil {
			return fmt.Errorf("competencies %s: %w", id, err)
		}
	}

	for _, su := range raw.Users {
		email := strings.TrimSpace(su.Email)
		if email == "" {
			continue
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(su.Password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		var tg any
		if su.TgChatID != nil {
			s := strings.TrimSpace(*su.TgChatID)
			if s != "" {
				tg = s
			}
		}
		_, err = tx.Exec(ctx, `
INSERT INTO public.users (id, role, email, password_hash, full_name, tg_chat_id)
VALUES ($1::uuid, $2, $3, $4, $5, $6)
ON CONFLICT (id) DO NOTHING`,
			strings.TrimSpace(su.ID), strings.TrimSpace(su.Role), email, string(hash), strings.TrimSpace(su.FullName), tg)
		if err != nil {
			if isUniqueViolation(err) {
				continue
			}
			return fmt.Errorf("user %s: %w", email, err)
		}
	}

	for uid, list := range raw.UserCompetencies {
		uid = strings.TrimSpace(uid)
		if uid == "" {
			continue
		}
		for _, uc := range list {
			cid := strings.TrimSpace(uc.CompetencyID)
			if cid == "" {
				continue
			}
			if _, err := tx.Exec(ctx, `
INSERT INTO public.user_competencies (user_id, competency_id, level)
VALUES ($1::uuid, $2::uuid, $3)
ON CONFLICT (user_id, competency_id) DO UPDATE SET level = EXCLUDED.level`,
				uid, cid, uc.Level); err != nil {
				return fmt.Errorf("user_competencies %s/%s: %w", uid, cid, err)
			}
		}
	}

	for _, c := range raw.Courses {
		var blocks any
		if len(c.ContentBlocksJSON) > 0 {
			blocks = []byte(c.ContentBlocksJSON)
		}
		if _, err := tx.Exec(ctx, `
INSERT INTO public.courses (id, title, description, is_published, content_blocks_json)
VALUES ($1::uuid, $2, $3, $4, $5)
ON CONFLICT (id) DO NOTHING`,
			strings.TrimSpace(c.ID), strings.TrimSpace(c.Title), strings.TrimSpace(c.Description), c.IsPublished, blocks); err != nil {
			return fmt.Errorf("course %s: %w", c.ID, err)
		}
	}

	for _, les := range raw.Lessons {
		var blocks any
		if len(les.ContentBlocksJSON) > 0 {
			blocks = []byte(les.ContentBlocksJSON)
		}
		if _, err := tx.Exec(ctx, `
INSERT INTO public.lessons (
	id, course_id, title, order_index, content_body, content_blocks_json,
	video_embed_url, practice_kind, practice_title, quiz_question, quiz_options_json,
	quiz_correct_option, ide_template, tests_json)
VALUES (
	$1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
ON CONFLICT (id) DO NOTHING`,
			strings.TrimSpace(les.ID),
			strings.TrimSpace(les.CourseID),
			strings.TrimSpace(les.Title),
			les.OrderIndex,
			strings.TrimSpace(les.ContentBody),
			blocks,
			les.VideoEmbedURL,
			les.PracticeKind,
			les.PracticeTitle,
			les.QuizQuestion,
			les.QuizOptionsJSON,
			les.QuizCorrectOption,
			les.IDETemplate,
			les.LessonTestsJSON,
		); err != nil {
			return fmt.Errorf("lesson %s: %w", les.ID, err)
		}
	}

	for _, t := range raw.Tasks {
		var tt, pt, tests any
		s := strings.TrimSpace(t.TaskType)
		if s != "" {
			tt = s
		}
		s = strings.TrimSpace(t.PromptText)
		if s != "" {
			pt = s
		}
		s = strings.TrimSpace(t.TestsJSON)
		if s != "" {
			tests = s
		}
		if _, err := tx.Exec(ctx, `
INSERT INTO public.tasks (
	id, lesson_id, language_id, reference_answer, competency_id, task_type, prompt_text, tests_json)
VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, $6, $7, $8)
ON CONFLICT (id) DO NOTHING`,
			strings.TrimSpace(t.ID),
			strings.TrimSpace(t.LessonID),
			t.LanguageID,
			strings.TrimSpace(t.ReferenceAnswer),
			strings.TrimSpace(t.CompetencyID),
			tt, pt, tests,
		); err != nil {
			return fmt.Errorf("task %s: %w", t.ID, err)
		}
	}

	for key, bind := range raw.GitIssueBindings {
		k := strings.ToUpper(strings.TrimSpace(key))
		if k == "" {
			continue
		}
		if _, err := tx.Exec(ctx, `
INSERT INTO public.git_issue_bindings (issue_key, user_id, task_id)
VALUES ($1, $2::uuid, $3::uuid)
ON CONFLICT (issue_key) DO NOTHING`,
			k, strings.TrimSpace(bind.UserID), strings.TrimSpace(bind.TaskID)); err != nil {
			return fmt.Errorf("git_issue_bindings %s: %w", k, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}
	return nil
}

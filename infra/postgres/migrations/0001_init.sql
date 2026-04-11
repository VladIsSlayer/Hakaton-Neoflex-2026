-- 0001_init.sql
-- Base schema for NEO EDU backend.

CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role text NOT NULL CHECK (role IN ('student', 'moderator')),
    email text NOT NULL,
    password_hash text NOT NULL,
    full_name text NOT NULL,
    tg_chat_id text NULL,
    CONSTRAINT users_email_unique UNIQUE (email)
);

COMMENT ON TABLE public.users IS 'Profiles with auth data and business role.';
COMMENT ON COLUMN public.users.tg_chat_id IS 'Optional Telegram chat id.';

CREATE TABLE IF NOT EXISTS public.competencies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL
);

COMMENT ON TABLE public.competencies IS 'Reference list of competencies.';

CREATE TABLE IF NOT EXISTS public.courses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    is_published boolean NOT NULL DEFAULT false,
    content_blocks_json jsonb NULL
);

COMMENT ON COLUMN public.courses.is_published IS 'Unpublished courses are hidden from student feed.';

CREATE TABLE IF NOT EXISTS public.lessons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
    title text NOT NULL,
    order_index integer NOT NULL,
    content_body text NOT NULL DEFAULT '',
    content_blocks_json jsonb NULL,
    video_embed_url text NULL,
    practice_kind text NULL,
    practice_title text NULL,
    quiz_question text NULL,
    quiz_options_json text NULL,
    quiz_correct_option text NULL,
    ide_template text NULL,
    tests_json text NULL
);

COMMENT ON COLUMN public.lessons.order_index IS 'Stable lesson ordering.';

CREATE INDEX IF NOT EXISTS lessons_course_id_order_idx
    ON public.lessons (course_id, order_index);

CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id uuid NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
    language_id integer NOT NULL,
    reference_answer text NOT NULL,
    competency_id uuid NOT NULL REFERENCES public.competencies (id) ON DELETE RESTRICT,
    task_type text NULL,
    prompt_text text NULL,
    tests_json text NULL
);

COMMENT ON COLUMN public.tasks.language_id IS 'Judge0 language id.';
COMMENT ON COLUMN public.tasks.reference_answer IS 'Expected stdout value.';

CREATE INDEX IF NOT EXISTS tasks_lesson_id_idx ON public.tasks (lesson_id);
CREATE INDEX IF NOT EXISTS tasks_competency_id_idx ON public.tasks (competency_id);

CREATE TABLE IF NOT EXISTS public.submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
    status text NOT NULL CHECK (status IN ('success', 'failed')),
    user_code text NOT NULL DEFAULT ''
);

COMMENT ON TABLE public.submissions IS 'Submission log with success/failed states.';

CREATE INDEX IF NOT EXISTS submissions_user_task_idx ON public.submissions (user_id, task_id);
CREATE INDEX IF NOT EXISTS submissions_task_id_idx ON public.submissions (task_id);

CREATE TABLE IF NOT EXISTS public.git_issue_bindings (
    issue_key text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE
);

COMMENT ON TABLE public.git_issue_bindings IS 'Git issue key to user/task mapping for webhooks.';

CREATE TABLE IF NOT EXISTS public.user_competencies (
    user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    competency_id uuid NOT NULL REFERENCES public.competencies (id) ON DELETE CASCADE,
    level integer NOT NULL DEFAULT 0 CHECK (level >= 0 AND level <= 100),
    PRIMARY KEY (user_id, competency_id)
);

COMMENT ON COLUMN public.user_competencies.level IS 'User competency points in range 0..100.';

CREATE TABLE IF NOT EXISTS public.enrollments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    course_id uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
    progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    CONSTRAINT enrollments_user_course_unique UNIQUE (user_id, course_id)
);

COMMENT ON COLUMN public.enrollments.progress_percent IS 'Calculated completion percent per course.';

CREATE INDEX IF NOT EXISTS enrollments_user_id_idx ON public.enrollments (user_id);
CREATE INDEX IF NOT EXISTS enrollments_course_id_idx ON public.enrollments (course_id);

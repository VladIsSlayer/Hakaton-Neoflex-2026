-- NEO EDU — схема БД (PostgreSQL / Supabase)
-- Основано на shared/plan/db.md. Скрипт идемпотентен по структуре: можно перезапускать после правок объектов.

-- gen_random_uuid() доступен в PostgreSQL 13+ (Supabase по умолчанию).

-- ---------------------------------------------------------------------------
-- 1. Пользователи (собственная auth, не Supabase Auth)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role text NOT NULL CHECK (role IN ('student', 'moderator')),
    email text NOT NULL,
    password_hash text NOT NULL,
    full_name text NOT NULL,
    tg_chat_id text NULL,
    CONSTRAINT users_email_unique UNIQUE (email)
);

COMMENT ON TABLE public.users IS 'Профили: логин/хэш пароля, роль student|moderator, опционально Telegram.';
COMMENT ON COLUMN public.users.tg_chat_id IS 'Опционально: chat_id для бота.';

-- ---------------------------------------------------------------------------
-- 2. Справочник компетенций (до tasks и user_competencies)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.competencies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL
);

COMMENT ON TABLE public.competencies IS 'Справочник ИТ-навыков для матрицы и привязки задач.';

-- ---------------------------------------------------------------------------
-- 3. Каталог курсов
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    is_published boolean NOT NULL DEFAULT false,
    content_blocks_json jsonb NULL
);

COMMENT ON COLUMN public.courses.is_published IS 'Черновик (false) не показывается студентам в GET /api/courses.';
COMMENT ON COLUMN public.courses.content_blocks_json IS 'Модульные блоки курса (text, video, quiz, ide); см. shared/plan/db.md.';

-- ---------------------------------------------------------------------------
-- 4. Уроки (каскад при удалении курса)
-- ---------------------------------------------------------------------------
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

COMMENT ON COLUMN public.lessons.order_index IS 'Сортировка уроков в плеере: ORDER BY order_index ASC.';
COMMENT ON COLUMN public.lessons.content_blocks_json IS 'Основной контент урока для фронта; legacy-поля ниже — fallback.';

CREATE INDEX IF NOT EXISTS lessons_course_id_order_idx
    ON public.lessons (course_id, order_index);

-- ---------------------------------------------------------------------------
-- 5. Задачи (Judge0: language_id, эталон stdout, компетенция при success)
-- ---------------------------------------------------------------------------
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

COMMENT ON COLUMN public.tasks.language_id IS 'Идентификатор языка в Judge0 (например 71 Python, 82 SQL).';
COMMENT ON COLUMN public.tasks.reference_answer IS 'Эталонный вывод stdout для сравнения с ответом Judge0.';

CREATE INDEX IF NOT EXISTS tasks_lesson_id_idx ON public.tasks (lesson_id);
CREATE INDEX IF NOT EXISTS tasks_competency_id_idx ON public.tasks (competency_id);

-- ---------------------------------------------------------------------------
-- 6. Журнал отправок (защита от двойного начисления — на уровне приложения)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
    status text NOT NULL CHECK (status IN ('success', 'failed')),
    user_code text NOT NULL DEFAULT ''
);

COMMENT ON TABLE public.submissions IS 'Попытки решений; перед +10 к компетенции проверять наличие success по (user_id, task_id).';

CREATE INDEX IF NOT EXISTS submissions_user_task_idx ON public.submissions (user_id, task_id);
CREATE INDEX IF NOT EXISTS submissions_task_id_idx ON public.submissions (task_id);
CREATE UNIQUE INDEX IF NOT EXISTS submissions_one_success_per_user_task_idx
    ON public.submissions (user_id, task_id)
    WHERE status = 'success';

-- ---------------------------------------------------------------------------
-- 7. Привязка Git issue -> user/task (для /webhooks/git)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.git_issue_bindings (
    issue_key text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE
);

COMMENT ON TABLE public.git_issue_bindings IS 'Маппинг DEV-ключей из webhook merge request на пользователя и задачу.';

-- ---------------------------------------------------------------------------
-- 8. Матрица компетенций пользователя (составной PK)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_competencies (
    user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    competency_id uuid NOT NULL REFERENCES public.competencies (id) ON DELETE CASCADE,
    level integer NOT NULL DEFAULT 0 CHECK (level >= 0 AND level <= 100),
    PRIMARY KEY (user_id, competency_id)
);

COMMENT ON COLUMN public.user_competencies.level IS 'Баллы 0..100; инкремент +10 при success, cap на стороне приложения.';

-- ---------------------------------------------------------------------------
-- 9. Записи на курс и агрегированный прогресс
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enrollments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    course_id uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
    progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    CONSTRAINT enrollments_user_course_unique UNIQUE (user_id, course_id)
);

COMMENT ON COLUMN public.enrollments.progress_percent IS 'Доля решённых задач курса; пересчёт на бэкенде.';

CREATE INDEX IF NOT EXISTS enrollments_user_id_idx ON public.enrollments (user_id);
CREATE INDEX IF NOT EXISTS enrollments_course_id_idx ON public.enrollments (course_id);

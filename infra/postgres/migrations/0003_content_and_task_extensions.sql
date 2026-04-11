-- 0003_content_and_task_extensions.sql
-- Расширения каталога и задач (см. docs/database.md).

ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS content_blocks_json jsonb;

ALTER TABLE public.lessons
    ADD COLUMN IF NOT EXISTS content_blocks_json jsonb,
    ADD COLUMN IF NOT EXISTS video_embed_url text,
    ADD COLUMN IF NOT EXISTS practice_kind text,
    ADD COLUMN IF NOT EXISTS practice_title text,
    ADD COLUMN IF NOT EXISTS quiz_question text,
    ADD COLUMN IF NOT EXISTS quiz_options_json text,
    ADD COLUMN IF NOT EXISTS quiz_correct_option text,
    ADD COLUMN IF NOT EXISTS ide_template text,
    ADD COLUMN IF NOT EXISTS tests_json text;

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS task_type text,
    ADD COLUMN IF NOT EXISTS prompt_text text,
    ADD COLUMN IF NOT EXISTS tests_json text;

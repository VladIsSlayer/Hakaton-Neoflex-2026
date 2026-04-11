# База данных NEO EDU

PostgreSQL (часто через **Supabase** как хостинг). **Авторизация в приложении** — собственная (`users` + JWT на Go), не Supabase Auth.

## Миграции

- Каталог: [`infra/postgres/migrations/`](../infra/postgres/migrations/).
- Запуск из `apps/api`: `go run ./cmd/migrate` (нужен `DATABASE_URL` в корневом `.env`).
- По умолчанию путь к SQL: `../../infra/postgres/migrations`.
- Применённые версии пишутся в **`public.schema_migrations`**.

Порядок файлов: `0001_init` → `0002` (уникальность success по user+task) → `0003` (расширения колонок) → `0004` (`lessons.ide_task`).

## Таблицы (домен)

### `users`

Профили: `email` (unique), `password_hash`, `role` ∈ `student` | `moderator`, `full_name`, опционально `tg_chat_id`.

### `courses`

Каталог: `title`, `description`, `is_published`, опционально `content_blocks_json` (jsonb) — блоки `text`, `video`, `quiz`, `ide` для витрины.

### `lessons`

Привязка к курсу: `course_id`, `order_index`, `content_body`, `content_blocks_json` (основной контент для плеера), legacy-поля (`video_embed_url`, `practice_*`, `quiz_*`, `ide_template`, `tests_json`), **`ide_task`** (текст задания для IDE).

### `competencies`

Справочник навыков (имя).

### `tasks`

Задача урока: `language_id` (Judge0), `reference_answer` (эталон stdout), `competency_id`, опционально `task_type`, `prompt_text`, `tests_json`.

### `submissions`

Попытки: `user_id`, `task_id`, `status` ∈ `success` | `failed`, `user_code`. Защита от двойного success — уникальный индекс по `(user_id, task_id)` WHERE `status = 'success'`.

### `user_competencies`

Матрица: `(user_id, competency_id)` PK, `level` 0…100.

### `enrollments`

Запись на курс: `user_id`, `course_id`, `progress_percent`. Уникальность пары `(user_id, course_id)`.

### `git_issue_bindings`

`issue_key` PK → `user_id`, `task_id` для вебхука Git.

## Справочные файлы

- Полный черновик DDL: [`infra/postgres/schema.sql`](../infra/postgres/schema.sql) (может отличаться от «истории» миграций; для новой БД ориентируйтесь на **миграции**).
- Диаграмма: [`infra/postgres/db-erd.md`](../infra/postgres/db-erd.md).

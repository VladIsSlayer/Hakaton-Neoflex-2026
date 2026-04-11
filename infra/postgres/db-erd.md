# ERD: база данных NEO EDU (PostgreSQL / Supabase)

Логическая модель совпадает с таблицами в `public.*` после применения миграций из [`migrations/`](migrations/). Текстовое описание полей и форматов JSON — в [**`docs/database.md`**](../../docs/database.md).

Дополнительно в БД создаётся служебная таблица **`public.schema_migrations`** (версия, имя файла, время применения) — её добавляет раннер `apps/api/cmd/migrate`, а не файлы доменных миграций.

```mermaid
erDiagram
    users {
        uuid id PK
        text role "student | moderator"
        text email UK
        text password_hash
        text full_name
        text tg_chat_id "nullable"
    }

    courses {
        uuid id PK
        text title
        text description
        boolean is_published
        jsonb content_blocks_json "nullable"
    }

    lessons {
        uuid id PK
        uuid course_id FK
        text title
        int order_index
        text content_body
        jsonb content_blocks_json "nullable"
        text ide_task "nullable"
    }

    competencies {
        uuid id PK
        text name
    }

    tasks {
        uuid id PK
        uuid lesson_id FK
        int language_id "Judge0"
        text reference_answer
        uuid competency_id FK
        text task_type "nullable"
        text prompt_text "nullable"
        text tests_json "nullable"
    }

    submissions {
        uuid id PK
        uuid user_id FK
        uuid task_id FK
        text status "success | failed"
        text user_code
    }

    git_issue_bindings {
        text issue_key PK
        uuid user_id FK
        uuid task_id FK
    }

    user_competencies {
        uuid user_id PK_FK
        uuid competency_id PK_FK
        int level "0..100"
    }

    enrollments {
        uuid id PK
        uuid user_id FK
        uuid course_id FK
        int progress_percent "0..100"
    }

    schema_migrations {
        bigint version PK
        text name
        timestamptz applied_at
    }

    users ||--o{ submissions : ""
    users ||--o{ user_competencies : ""
    users ||--o{ enrollments : ""
    users ||--o{ git_issue_bindings : ""

    courses ||--o{ lessons : "ON DELETE CASCADE"
    courses ||--o{ enrollments : ""

    lessons ||--o{ tasks : ""

    competencies ||--o{ tasks : ""
    competencies ||--o{ user_competencies : ""

    tasks ||--o{ submissions : ""
    tasks ||--o{ git_issue_bindings : ""
```

## Связи (кратко)

| От | К | Примечание |
|----|---|------------|
| `lessons` | `courses` | `course_id`, каскад при удалении курса |
| `tasks` | `lessons` | `lesson_id` |
| `tasks` | `competencies` | `competency_id` — навык при успешной проверке |
| `submissions` | `users`, `tasks` | уникальный partial index на `(user_id, task_id)` при `status = 'success'` |
| `user_competencies` | `users`, `competencies` | составной PK `(user_id, competency_id)` |
| `enrollments` | `users`, `courses` | **UNIQUE** `(user_id, course_id)` в миграциях |

На диаграмме для читаемости не показаны все nullable-колонки уроков (`video_embed_url`, `quiz_*`, `ide_template`, …) — они перечислены в `docs/database.md` и в `schema.sql`.

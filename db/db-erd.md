# ERD: база данных NEO EDU (PostgreSQL / Supabase)

Диаграмма соответствует [`db.md`](db.md). Составной первичный ключ: `USER_COMPETENCIES` (`user_id`, `competency_id`).

```mermaid
erDiagram
    USERS {
        uuid id PK
        varchar role "student | moderator"
        varchar email UK "логин, уникальный"
        varchar password_hash "bcrypt/argon2"
        varchar full_name
        varchar tg_chat_id "nullable, Telegram"
    }

    COURSES {
        uuid id PK
        varchar title
        text description
        boolean is_published "черновик vs витрина"
    }

    LESSONS {
        uuid id PK
        uuid course_id FK
        varchar title
        int order_index
        text content_body
    }

    COMPETENCIES {
        uuid id PK
        varchar name "SQL, Python, …"
    }

    TASKS {
        uuid id PK
        uuid lesson_id FK
        int language_id "Judge0 language id"
        text reference_answer "эталон stdout"
        uuid competency_id FK "навык при success"
    }

    SUBMISSIONS {
        uuid id PK
        uuid user_id FK
        uuid task_id FK
        varchar status "success | failed"
        text user_code
    }

    USER_COMPETENCIES {
        uuid user_id PK "FK → USERS"
        uuid competency_id PK "FK → COMPETENCIES"
        int level "0..100"
    }

    ENROLLMENTS {
        uuid id PK
        uuid user_id FK
        uuid course_id FK
        int progress_percent "0..100"
    }

    USERS ||--o{ SUBMISSIONS : "журнал попыток"
    USERS ||--o{ USER_COMPETENCIES : "матрица навыков"
    USERS ||--o{ ENROLLMENTS : "запись на курс"

    COURSES ||--o{ LESSONS : "уроки, ON DELETE CASCADE"
    COURSES ||--o{ ENROLLMENTS : "участники"

    LESSONS ||--o{ TASKS : "практика в уроке"

    COMPETENCIES ||--o{ TASKS : "начисление за задачу"
    COMPETENCIES ||--o{ USER_COMPETENCIES : "уровень по навыку"

    TASKS ||--o{ SUBMISSIONS : "отправки по задаче"
```

## Связи (кратко)

| От | К | Тип | Примечание |
|----|---|-----|------------|
| `LESSONS` | `COURSES` | N : 1 | `course_id`; при удалении курса — каскад по урокам |
| `TASKS` | `LESSONS` | N : 1 | `lesson_id` |
| `TASKS` | `COMPETENCIES` | N : 1 | `competency_id` — какой навык качается при верном решении |
| `SUBMISSIONS` | `USERS` | N : 1 | `user_id` |
| `SUBMISSIONS` | `TASKS` | N : 1 | `task_id`; защита от повторного начисления по паре user + task + success |
| `USER_COMPETENCIES` | `USERS` | N : 1 | `user_id` (часть PK) |
| `USER_COMPETENCIES` | `COMPETENCIES` | N : 1 | `competency_id` (часть PK) |
| `ENROLLMENTS` | `USERS` | N : 1 | `user_id` |
| `ENROLLMENTS` | `COURSES` | N : 1 | `course_id` |

На уровне БД имеет смысл добавить уникальный ограничение на пару `(user_id, course_id)` в `ENROLLMENTS`, если одна запись = одна активная запись студента на курс (в `db.md` не зафиксировано — по желанию при миграции).

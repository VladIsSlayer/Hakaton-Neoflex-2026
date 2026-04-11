# NEO EDU — API (Go)

REST-сервис на **Gin**: аутентификация (JWT), каталог, уроки, проверка задач через **Judge0**, прогресс и компетенции, вебхук Git.

## Модуль и команды

- Модуль: `neoflex-lms` (`go.mod` в этой папке).
- **Сервер:** `go run ./cmd/server` (рабочая директория — `apps/api`).
- **Миграции:** `go run ./cmd/migrate` — читает SQL из `../../infra/postgres/migrations` (переопределение: `MIGRATIONS_DIR`).
- **Сид из JSON:** `go run ./cmd/seed` (см. `data/seed.json`, путь через `SEED_JSON_PATH`).

## Переменные окружения

Используется **только корневой** `.env` в монорепозитории (при запуске из `apps/api` путь `../../.env`). Отдельный `apps/api/.env` не читается — перенесите переменные в корень и удалите лишний файл при миграции со старой схемы.

Обязательно для старта сервера:

| Переменная | Назначение |
|------------|------------|
| `DATABASE_URL` | Строка подключения PostgreSQL |
| `JWT_SECRET` | Секрет подписи JWT |

В `APP_ENV=production` дополнительно ожидается **`WEBHOOK_GIT_SECRET`** для подписи вебхука.

Часто используемые опции: `PORT` (по умолчанию 8080), `FRONTEND_ORIGIN` / `FRONTEND_ORIGINS` (CORS), параметры пула pgx (`DB_*`), Judge0 (`JUDGE0_*`), `STATS_COURSE_ID`, `SEED_IF_EMPTY`, `SEED_JSON_PATH`. Полный список — `internal/config/config.go`.

## Маршруты (кратко)

- `GET /api/health` — проверка БД.
- `POST /api/auth/login`, `POST /api/auth/register`
- Публичные: `GET /api/courses`, `GET /api/lessons`, …
- С JWT: профиль, снимок прогресса, `POST /api/tasks/:id/check`, запись на курс (роль student), админ/модераторские POST для контента.
- `POST /webhooks/git` — GitLab-совместимый вебхук (секрет опционален в dev).

Детали реализации — пакеты `internal/handlers`, `internal/store`, `internal/auth`, `internal/judge0`.

## Теория в двух фразах

Бэкенд держит **единственный источник правды** для выдачи JWT, проверки ролей, записи попыток и пересчёта `enrollments` / `user_competencies`. Judge0 изолирует выполнение кода; сравнение результата с `reference_answer` и идемпотентность начислений — на стороне Go и ограничений БД (см. `docs/database.md`).

## Связанные документы

- [Корневой README](../../README.md)
- [База данных](../../docs/database.md)
- [Архитектура](../../docs/architecture.md)

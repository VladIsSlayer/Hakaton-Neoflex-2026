# Архитектура NEO EDU

Коротко о том, как устроен продукт и репозиторий.

## Назначение

**NEO EDU** — веб-LMS для ИТ-обучения: каталог курсов и уроков, прохождение материалов, практические задания с проверкой кода через **Judge0**, матрица компетенций и прогресс по курсам.

## Роли и доверие

- **Студент** — просмотр опубликованных курсов, запись, решение задач, профиль.
- **Модератор** — создание курсов/уроков/задач (защищённые маршруты API).

Аутентификация: **JWT**, выдаваемый Go после `POST /api/auth/login` / register. Пароли в **`users.password_hash`**. Supabase в типичном деплое используется как **PostgreSQL + PostgREST** для части чтения каталога с фронта (anon-ключ, RLS на стороне проекта), но **логин в LMS** идёт через бэкенд.

## Поток данных (упрощённо)

1. Браузер загружает SPA (`apps/web`), для API в dev использует **относительные пути** `/api/*` — Vite проксирует на Go.
2. Go (`apps/api`) обслуживает REST под `/api`, проверка кода — интеграция с Judge0, запись результатов в `submissions`, пересчёт прогресса/компетенций.
3. Персистентность — **PostgreSQL**, схема в `infra/postgres`.

## Монорепозиторий

| Путь | Роль |
|------|------|
| `apps/web` | React, Vite, FSD-слои (`app`, `pages`, `widgets`, `features`, `shared`) |
| `apps/api` | Go module `neoflex-lms`, Gin, `cmd/server`, `cmd/migrate`, `internal/*` |
| `infra/postgres` | SQL-миграции, `schema.sql`, ERD-док |
| `docs/` | Архитектура, БД, материалы для README (`readme-assets/`) |

## Переменные окружения

Один файл **`.env` только в корне** репозитория (шаблон — `.env.example`). Vite читает корень через `envDir`; Go (`cmd/server`, `cmd/migrate`, `cmd/seed`) подгружает тот же файл (`../../.env` относительно `apps/api`).

## Дальнейшее чтение

- Запуск и уровни документации: [корневой README](../README.md)
- API: [apps/api/README.md](../apps/api/README.md)
- Фронт: [apps/web/README.md](../apps/web/README.md)
- БД: [database.md](database.md), [db-erd.md](../infra/postgres/db-erd.md)

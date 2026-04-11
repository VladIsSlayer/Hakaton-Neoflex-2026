# Архитектура репозитория

Монорепозиторий:

| Путь | Назначение |
|------|------------|
| `apps/web` | React (Vite), UI по **Feature-Sliced Design**: `app`, `pages`, `widgets`, `features`, `shared` |
| `apps/api` | Go (Gin), HTTP handlers → PostgreSQL (Supabase pooler), Judge0 |
| `infra/postgres` | SQL-миграции, схема, сиды |

Переменные окружения: один файл **`.env` в корне репозитория** (шаблон — `.env.example`). Vite читает корень через `envDir` в `apps/web/vite.config.ts`; API подгружает тот же файл из `apps/api` (см. `internal/env`).

Запуск разработки: `task dev` или `npm run dev` из корня (после `npm install` в корне и `npm install` в `apps/web`).

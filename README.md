# NEO EDU (Hakaton Neoflex 2026)

LMS: React (Vite) + Go (Gin) + PostgreSQL (Supabase). Монорепозиторий.

## Структура

- `apps/web` — фронтенд (FSD: `app`, `pages`, `widgets`, `features`, `shared`)
- `apps/api` — HTTP API, миграции через `cmd/migrate`
- `infra/postgres` — SQL-миграции и схема
- `docs/` — планы и [architecture.md](docs/architecture.md)

## Быстрый старт

1. Скопируйте переменные: `cp .env.example .env` и заполните `DATABASE_URL`, `JWT_SECRET`, при необходимости Supabase для фронта.

2. Установите зависимости фронта:

   ```bash
   cd apps/web && npm install && cd ../..
   ```

3. Миграции (из `apps/api`, с загруженным `DATABASE_URL`):

   ```bash
   cd apps/api && go run ./cmd/migrate && cd ../..
   ```

4. Запуск API и Vite **одной командой из корня**:

   ```bash
   npm install
   npm run dev
   ```

   Либо с [Task](https://taskfile.dev/): `task dev`.

Фронт: обычно http://localhost:5173. API: http://localhost:8080 (прокси `/api` и `/webhooks` в dev).

## Отдельные процессы

```bash
cd apps/api && go run ./cmd/server
cd apps/web && npm run dev
```

## Сборка

```bash
npm run build:web
npm run build:api
```

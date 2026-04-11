# NEO EDU — Web

Одностраничное приложение: **React 19**, **Vite 6**, **TypeScript**, **Ant Design**, **TanStack Query**, **Zustand**, **React Router**.

## Структура (Feature-Sliced Design)

| Слой | Путь | Назначение |
|------|------|------------|
| App | `src/app/` | Провайдеры (Query, Ant Design, роутер), глобальные стили |
| Pages | `src/pages/` | Экраны (лендинг, auth, дашборд, плеер, профиль) |
| Widgets | `src/widgets/` | Крупные блоки (корневой layout, шапка) |
| Features | `src/features/` | Сценарии: auth store, проверка задачи, матрица, health-панель |
| Shared | `src/shared/` | API-клиент, конфиги, переиспользуемый UI |

Точка входа: `src/main.tsx` → стили `src/app/styles/index.css`, корневой компонент `src/app/App.tsx`. Роутинг: `src/app/router.tsx`.

## Запуск и сборка

Переменные окружения — **только корневой** `../../.env` (тот же файл, что и у Go; отдельный `.env` в `apps/web` не используется). Шаблон: `../../.env.example`.

Из **этой папки**:

```bash
npm install
npm run dev
```

Из **корня** (после `npm install` в корне и здесь): `npm run dev` поднимает и API, и Vite — см. корневой README.

Сборка и превью:

```bash
npm run build
npm run preview
```

Линт: `npm run lint`.

## API и Supabase в development

- Если **`VITE_API_URL` пустой**, запросы к API идут на origin dev-сервера (например `localhost:5173`), а Vite **проксирует** `/api` и `/webhooks` на бэкенд (`VITE_DEV_API_PROXY` / `API_URL`, по умолчанию `http://localhost:8080`). Так обходится CORS.
- Для **production build** задайте **`VITE_API_URL`** с публичным URL API (это попадёт в бандл). Это **не** строка подключения к PostgreSQL.
- **Supabase:** `VITE_SUPABASE_URL` и ключ с префиксом `VITE_` (или алиасы `API_SUPABASE_*` в `vite.config.ts`) — для клиентского SDK, если каталог/данные читаются напрямую из PostgREST.

## Два `package.json` в монорепо

- **`apps/web/package.json`** (этот каталог) — зависимости и скрипты **только фронта**.
- **`package.json` в корне** — dev-оркестрация (`concurrently`): параллельный запуск Go и Vite. В продакшен-сборке фронта корневой `package.json` не обязателен.

## Полезные файлы

| Назначение | Файл |
|------------|------|
| Прокси и env | `vite.config.ts` |
| HTTP-обёртка, JWT из store | `src/shared/api/client.ts` |
| DTO и вызовы каталога | `src/shared/api/catalog.ts` |
| Сессия | `src/features/auth/model/authStore.ts` |

## Документация

- [Корневой README](../../README.md)
- [Архитектура](../../docs/architecture.md)
- [База данных](../../docs/database.md)

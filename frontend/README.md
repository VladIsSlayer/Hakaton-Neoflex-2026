# NEO EDU — frontend

React + TypeScript + Vite. Макет страниц и навигация в режиме wireframe; часть зависимостей из плана (antd, axios, React Query, zustand, Monaco, recharts и т.д.) уже в `package.json`.

## Запуск

Из **корня репозитория** заданы переменные в `.env` (см. `../.env.example`): Supabase и при необходимости API бэка.

```bash
cd frontend
npm install
npm run dev
```

Открой в браузере адрес из вывода Vite (обычно `http://localhost:5173`).

Сборка и превью:

```bash
npm run build
npm run preview
```

Линт:

```bash
npm run lint
```

**Переменные окружения:** Vite читает **корневой** `.env` родительской папки (`envDir: '..'` в `vite.config.ts`). Для клиента подставляются `VITE_SUPABASE_*` или `API_SUPABASE_URL` / `API_SUPABASE_ANON_KEY`, а также `VITE_API_URL` или `API_URL` (по умолчанию бэк: `http://localhost:8080`).

## Что уже есть

- Роутинг: главная, `/auth`, `/dashboard`, `/lessons`, `/courses/:courseId`, уроки, `/profile` (`src/app/router.tsx`).
- Общий layout: хедер (лого, Главная / Курсы / Лекции, вход или профиль), основной контент (`RootLayout`, `AppHeader`).
- Демо-сессия: `authUiStore` переключает «вошёл / вышел» для вёрстки хедера (не продакшен-авторизация).
- Supabase-клиент: `src/api/supabase.ts` (singleton), проверка конфига.
- На дашборде: `DbStatusPanel` — тестовый запрос к таблице `courses` через Supabase (зависит от схемы и RLS в проекте).
- Профиль и остальные страницы — блоки-заглушки под будущий UI и данные.

## Чего пока нет (по плану `shared/plan/frontend.md`)

- Глобальный `ConfigProvider` + тема Ant Design в корне приложения (если ещё не подключали).
- Единый axios-клиент к Go, интерceptor `Authorization: Bearer`, типы DTO.
- Реальный логин на `POST /api/auth/login` и хранение JWT вместо демо-стора.
- `ProtectedRoute` для приватных страниц.
- Каталог курсов с `GET /api/courses`, плеер с Monaco и сабмитом на чекер.

## Ожидания от бэка (Go)

- Базовый URL и префикс `/api/...`, **CORS** для origin фронта (dev: порт Vite).
- `POST /api/auth/login` (email/password) → JWT (+ по договорённости `role` и `user` в JSON).
- Защищённые ручки: заголовок `Authorization: Bearer <token>`, при ошибке — предсказуемые коды и JSON ошибок.
- Дальше по спеке: `GET /api/courses`, уроки, профиль/компетенции, чекер задач и т.д. (см. `shared/plan/backend.md`).

## Ожидания от БД / Supabase

- Схема таблиц из `shared/plan/db.md` (`courses`, `lessons`, `users`, `submissions` и т.д.).
- Для прямых запросов с фронта через anon-ключ — настроенные **RLS** и политики; иначе Supabase будет отдавать ошибку даже при верном URL/ключе.
- Данные для демо можно наполнять через Table Editor / сиды (`shared/plan/content.md`).

## Полезные пути

| Назначение        | Путь                    |
|-------------------|-------------------------|
| Роутер            | `src/app/router.tsx`    |
| Хедер             | `src/components/AppHeader.tsx` |
| Supabase          | `src/api/supabase.ts`   |
| Конфиг Vite / env | `vite.config.ts`        |
| План фронта       | `../shared/plan/frontend.md` |

# Hakaton-Neoflex-2026 | Выборгские псы

Кейс **NEO.HACK() / NEO EDU** от [NeoFlex](https://www.neoflex.ru/): набор сервисов под ИТ-обучение — автопроверка кода и SQL, матрица компетенций, прогресс, опционально вебхуки к репозиториям и Telegram-бот. В репозитории это оформлено как LMS-прототип: каталог курсов, плеер уроков, практика в браузерной IDE, роли студент / модератор.

**Технологии:** Supabase как хост **PostgreSQL** (и инфраструктура вокруг БД), **React** (TypeScript, Vite, Ant Design, Monaco) — фронт по возможности «тонкий»: агрегация и бизнес-правила на **Go** (Gin, JWT, pgx/GORM), внешняя песочница **Judge0** для запуска кода. Тесты — отдельный слой на **TypeScript (Jest + Axios)** против API плюс ручной сценарий демо; при необходимости — точечный **TypeScript** вокруг интеграций.

**Методология:** постановка и пожелания заказчика — в [`shared/mainTask.pdf`](shared/mainTask.pdf). Детализация архитектуры, схемы БД, бэкенд/фронт, контент для сида и QA — в [`shared/plan/`](shared/plan/) (`architecture.md`, `db.md`, `backend.md`, `frontend.md`, `content.md`, `test.md`): сначала авторизация и чтение данных, затем чекер и прогресс, в конце админка/вебхуки и полировка.

---

**Ссылки**

| | |
|--|--|
| БД (Supabase) | https://supabase.com/dashboard/project/exljdepzqsgefamkkbww |
| Репозиторий | https://github.com/VladIsSlayer/Hakaton-Neoflex-2026 |
| Чат команды (Яндекс) | https://yandex.ru/chat/#/join/fd8c5eb1-5974-4e32-9103-882c5025fbab |
| Чат хакатона (Яндекс) | https://yandex.ru/chat/#/join/f4cb1044-945c-4a7c-8239-408990b7d296 |

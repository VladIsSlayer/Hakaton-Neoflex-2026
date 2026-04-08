# Схема базы данных (Relational Supabase)

Проект использует реляционную модель PostgreSQL, реализуемую через решение Supabase. 

## Общие положения 
- Все идентификаторы (`id`) используют универсальный тип `UUID`.
- Запросы от Frontend'а к нечувствительным данным (списки курсов для чтения) должны идти напрямую через клиент `supabase-js`, минуя наш самописный бэкенд на Go. Это позволяет ускорить разработку и снизить latency.
- Защита данных на стороне Supabase реализуется через **Row Level Security (RLS)** — например, Пользователь не может посмотреть или удалить `SUBMISSIONS` другого пользователя (политика: `auth.uid() = user_id`).

## Подробное описание таблиц

### 1. `USERS`
Центральная таблица пользователей системы. 
- `id` (uuid) — PK, который жестко связан 1-к-1 с системной таблицей авторизации `auth.users` в Supabase.
- `role` (string) — определяет бизнес-роль (student, hr, teacher, admin).
- `full_name` (string) — ФИО пользователя или никнейм.
- `tg_chat_id` (string) — Идентификатор телеграма для интеграции в Telegram Bot микросервисе.

### 2. `COURSES`
Каталог доступных потоков обучения.
- `id` (uuid) — PK.
- `title` (string) — Название базового курса (например, "DevOps Essentials").
- `description` (string) — Подробное описание (в формате Markdown/Plain).
- `is_published` (boolean) — Флаг релизности (RLS студента видит только где значение `true`).

### 3. `LESSONS`
Под-модули и уроки, являющиеся частью конкретного курса. Связь One-to-Many.
- `id` (uuid) — PK.
- `course_id` (uuid) — FK к `COURSES.id`. Урок удаляется каскадно при удалении курса.
- `title` (string) — Название модуля/урока.
- `order_index` (int) — Математическая очередность вывода (1, 2, 3) для сортировки списков.
- `content_type` (string) — Тип урока (`video`, `text`, `interactive_task`), позволяющий Фронтенду правильно отрендерить плеер.
- `content_body` (text) — Контент: путь к видео, текст Маркдауна, или JSON-конфигурация.

### 4. `ENROLLMENTS`
Таблица матриц привязок. Связывает объект Студента и объект Курса (трекинг участия).
- `id` (uuid) — PK.
- `user_id` (uuid) — FK к `USERS.id`.
- `course_id` (uuid) — FK к `COURSES.id`.
- `progress_percent` (int) — Вычисленный общий прогресс прохождения курса (управляется Analytics Service-ом).
- `enrolled_at` (timestamp) — Дата поступления.

### 5. `COMPETENCIES`
Доказательный справочник ИТ-компетенций для профиля учащегося.
- `id` (uuid) — PK.
- `name` (string) — Уникальное название (SQL, Python, Docker, Spring Boot).

### 6. `USER_COMPETENCIES`
Накопительная гистограмма или "Матрица компетенций" конкретного пользователя.
- `user_id` (uuid) — FK к `USERS.id` (составной PK вместе с competency_id).
- `competency_id` (uuid) — FK к `COMPETENCIES.id`.
- `level` (int) — Уровень владения технологией (число от 1 до 100), который растёт при успешном прохождении тестов.

### 7. `TASKS`
Специфичные сложные ИТ-задачи в рамках конкретного урока (например, `content_type` = `interactive_task`).
- `id` (uuid) — PK.
- `lesson_id` (uuid) — FK к `LESSONS.id`.
- `type` (string) — Определяет тип: `sql` (проверить query), `code` (сценарий питона), `git_pr` (ожидаем хук из SVN), `sandbox` (выдать контейнер стенда).
- `reference_answer` (string) — Референс/Ответ/Регулярка, которая проверяется Code/SQL Checker'ом.
- `docker_image` (string) — Опциональное имя docker-образа для sandboxes ("postgres:15-alpine").
- `competency_id` (uuid) — Связанный скилл (успех задачи прокачивает компетенцию на N-баллов).

### 8. `SUBMISSIONS`
История взаимодействия пользователя со сложными задачами (попытки).
- `id` (uuid) — PK.
- `user_id` (uuid) — FK.
- `task_id` (uuid) — FK.
- `status` (string) — ENUM: `pending` (в ожидании), `success` (выполнено верно), `failed` (завалено/ошибка компиляции).
- `user_code` (text) — Текст, который прислал студент в редакторе кода.
- `console_output` (string) — Журриал (log) выполнения.
- `created_at` (timestamp).

### 9. `SANDBOXES`
Активные "живые" контейнеры пользователя.
- `id` (uuid) — PK.
- `user_id` (uuid) — FK.
- `task_id` (uuid) — FK.
- `container_url` (string) — Сетевой URL или SSH-адрес активного стенда, который студент использует для работы.
- `expires_at` (timestamp) — Время TTL, по достижении которого Backend автоматически удаляет этот docker container.

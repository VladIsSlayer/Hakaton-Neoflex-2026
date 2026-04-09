# Схема базы данных (PostgreSQL / Supabase)

В нашем проекте вся логика агрегации данных управляется Go-бэкендом. Supabase используется исключительно как удобный хостинг для **PostgreSQL**.

> **Важно:**
> Мы отказались от встроенного Supabase Auth в пользу собственного JWT-роута на Go (`POST /api/auth/login`). Это значит, что нам нужна собственная таблица для хранения юзеров и их хэшированных паролей. База данных спроектирована максимально плоско и просто.

## 1. Таблицы Авторизации и Ролей

### `USERS` (Пользователи)

Центральная таблица для хранения профилей.

- `id` (uuid) — Primary Key.
- `role` (string) — Бизнес-роль: `student` или `moderator`. **Как работает алгоритм в Бэкенде:** При логине, Middleware в Go читает это поле и зашивает в JWT-токен. Дальше этот токен проверяется на каждом роуте, чтобы разграничить доступ (модераторы могут создавать курсы, студенты только решать).
- `email` (string) — Логин пользователя.
- `password_hash` (string) — Зашифрованный хэш пароля.
- `full_name` (string) — ФИО для отображения в "Личном Кабинете".
- `tg_chat_id` (string) — Опционально. Telegram Chat ID для привязки аккаунта студента к боту и отправки push-уведомлений.

---

## 2. Каталог Контента (Read-Only API для Студентов)

Эти таблицы формируют витрину платформы. Модераторы вносят сюда данные, а студенты их только читают.

### `COURSES` (Курсы)

Главный каталог образовательных направлений.

- `id` (uuid) — PK.
- `title` (string) — Название (например, "Основы Python для Data Science").
- `description` (text) — Описание курса.
- `is_published` (boolean) — **Зачем нужно:** Позволяет модератору готовить курс (сохранять как черновик). Бэкенд в эндпоинте `GET /api/courses` применяет фильтр `WHERE is_published = true`, отдавая студентам только готовые программы.
- `content_blocks_json` (jsonb, nullable) — модульный контент курса (финальное задание/демо-контент): блоки `text`, `video`, `quiz`, `ide`.

Формат `courses.content_blocks_json`:

```json
[
  { "type": "text", "text": "Итоговый блок курса..." },
  { "type": "video", "embedUrl": "https://www.youtube.com/embed/..." },
  {
    "type": "quiz",
    "title": "Проверка",
    "question": "Какой шаг обязателен?",
    "options": ["A", "B", "C"],
    "correctOption": "a"
  },
  {
    "type": "ide",
    "title": "Практика",
    "language": "python",
    "task": "Реализуйте функцию ...",
    "template": "def solve(x):\n    return x",
    "tests": [{ "input": "1", "expected": "1" }]
  }
]
```

### `LESSONS` (Уроки / Модули)

Структура курса (собирается роутом `GET /api/courses/{id}/lessons` для Плеера).

- `id` (uuid) — PK.
- `course_id` (uuid) — Foreign Key к `COURSES.id`. Сильная связь: при удалении курса каскадно удаляются все его уроки.
- `title` (string) — Название лекции.
- `order_index` (int) — **Для формирования дерева:** Позволяет бэкенду сделать SQL-сортировку `ORDER BY order_index ASC`, чтобы фронтенд отрисовал структуру урока (Step 1, Step 2) в правильном хронологическом порядке без багов на UI.
- `content_body` (text) — Базовый текст лекции (legacy/fallback).
- `content_blocks_json` (jsonb, nullable) — **Основной источник контента для фронта**: массив контент-блоков, которые можно свободно расширять без изменения схемы.

Формат `content_blocks_json` (пример структуры):

```json
[
  { "type": "text", "text": "Теория по теме..." },
  { "type": "video", "embedUrl": "https://www.youtube.com/embed/..." },
  {
    "type": "quiz",
    "title": "Проверка понимания",
    "question": "Какой шаг обязателен перед деплоем?",
    "options": ["Security scan", "Сразу в прод", "Отключить тесты"],
    "correctOption": "a"
  },
  {
    "type": "ide",
    "title": "Практика в IDE",
    "language": "sql",
    "template": "-- write your solution",
    "tests": [{ "input": "1 2", "expected": "3" }]
  }
]
```

Legacy-поля ниже оставлены для обратной совместимости (фронт умеет fallback, если `content_blocks_json` пуст):

- `video_embed_url` (text, nullable)
- `practice_kind` (string): `quiz`, `ide`, `hybrid`, `none`
- `practice_title` (string, nullable)
- `quiz_question` (text, nullable)
- `quiz_options_json` (text, nullable)
- `quiz_correct_option` (string, nullable)
- `ide_template` (text, nullable)
- `tests_json` (text, nullable)

---

## 3. Механика (Judge0 Чекер и Хранение)

Сердце системы — связь заданий с песочницей и хранилище попыток студента.

### `TASKS` (Интерактивные Задачи)

Справочник того, _что_ именно нужно решить студенту.

- `id` (uuid) — PK.
- `lesson_id` (uuid) — FK к уроку (одна задача принадлежит конкретному уроку).
- `language_id` (int) — **Ключевое поле для Judge0:** Содержит ID языка (например `71` для Python, `82` для SQL). Помогает бэкенду правильно сформировать POST HTTP-запрос (payload) к API системы Judge0.
- `reference_answer` (string) — Эталонный текстовый консольный ответ (stdout). **Алгоритм проверки вывода:** Бэкенд получает от внешнего API Judge0 консольный вывод (результат выполнения кода студента) и делает простейшее сравнение `if stdout == reference_answer { success }`.
- `competency_id` (uuid) — Указывает, какой именно скилл студента нужно "прокачать" в случае, если задача решена верно (например, ID скилла "SQL").
- `task_type` (string, nullable) — Тип контрольно-практической задачи: `quiz`, `ide`, `code`, `custom`.
- `prompt_text` (text, nullable) — Текст постановки задания (включая условия и ограничения).
- `tests_json` (text, nullable) — Набор тестов для code/ide задания в формате JSON.

#### Пример заполнения lesson #4 (DB-only контент, новый формат)

```sql
update public.lessons
set
  content_body = 'Подробная лекция про CI/CD и инфраструктурные пайплайны...',
  content_blocks_json = '[
    {
      "type": "text",
      "text": "CI/CD сокращает время поставки и снижает риск ошибок за счет автоматизации проверок."
    },
    {
      "type": "video",
      "embedUrl": "https://www.youtube.com/embed/dQw4w9WgXcQ"
    },
    {
      "type": "quiz",
      "title": "Мини-викторина",
      "question": "Что является главным критерием готовности пайплайна к продакшну?",
      "options": [
        "Успешные проверки качества и безопасности",
        "Только ручной деплой",
        "Минимум шагов без проверок"
      ],
      "correctOption": "a"
    },
    {
      "type": "ide",
      "title": "Практика: сумма чисел",
      "language": "python",
      "template": "def solve(nums):\n    # your code\n    return 0",
      "tests": [
        { "input": "[1,2,3]", "expected": "6" },
        { "input": "[]", "expected": "0" }
      ]
    }
  ]'::jsonb
where title = 'Lesson  4';
```

### `SUBMISSIONS` (Журнал Решений Студентов)

Таблица, куда Бэкенд делает INSERT при получении ответа от Judge0 (или при перехвате Git Webhook'a).

- `id` (uuid) — PK.
- `user_id` (uuid) — FK к `USERS.id`.
- `task_id` (uuid) — FK к `TASKS.id`.
- `status` (string) — Статус ответа студента: `success` (выполнено верно), `failed` (ошибка логики).
- `user_code` (text) — Исходный код скрипта, который написал студент.
- **Защитный Алгоритм Бэкенда:** Это не просто логгирование. Таблица защищает от "двойного" начисления баллов. Прежде чем прибавить +10 к прогрессу компетенции, бэкенд проверяет: а был ли этот `task_id` уже решен этим пользователем со статусом `success`? Если да — баллы второй раз не даем.

---

## 4. Матрица Компетенций и Радар

Сводная аналитика для отрисовки графиков в Личном Кабинете (Radar Chart).

### `COMPETENCIES` (Справочник Навыков)

Просто статичный список.

- `id` (uuid) — PK.
- `name` (string) — Название (Например: "SQL", "Docker", "Go", "Python").

### `USER_COMPETENCIES` (Уровни юзера)

Это и есть та самая **Матрица**. Сводная таблица связей студента и его накопленных баллов (ачивок).

- `user_id` (uuid) — Составной PK (вместе с competency_id).
- `competency_id` (uuid).
- `level` (int) — Баллы владения ИТ-навыком (от 0 до 100).
- **Алгоритм Начисления Бэкенда:** При получении `success`, Go-сервер выполняет `UPDATE user_competencies SET level = level + 10 WHERE user_id = X AND competency_id = Y`. Фронтенду не нужно ничего вычислять — он получает готовые баллы (например: `{ "Python": 40, "SQL": 80 }`) и рисует красивую геометрическую Паутинку (Radar Chart).

### `ENROLLMENTS` (Поступления на Курс)

Отображает, на какие курсы студент записался, и какой у него общий прогресс.

- `id` (uuid) — PK.
- `user_id` (uuid) — FK к `USERS`.
- `course_id` (uuid) — FK к `COURSES`.
- `progress_percent` (int) — Рассчитанный бэкендом общий процент завершения модуля.
- **Алгоритм Рассчета (Без Data Analysis):** Бэкенд пересчитывает дробь `[Кол-во Тасок на курсе со статусом 'success' у этого юзера] / [Общее кол-во тасок на курсе] * 100` и делает `UPDATE progress_percent`. Фронтенду остается только вывести кольцевой `Progress Circle` из Antd, показав, например, `75%`.

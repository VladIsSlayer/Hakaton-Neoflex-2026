-- =============================================================================
-- NEO EDU — демо-данные для Supabase SQL Editor
-- =============================================================================
-- Создаёт: 3 модератора, 5 студентов, компетенции, курс, уроки, задачи,
-- записи на курс, матрицу компетенций и часть submissions.
--
-- Пароль для ВСЕХ созданных пользователей:  password
-- (bcrypt ниже — стандартный тестовый хэш, совместим с Go bcrypt / большинством стеков)
-- Литералы UUID везде приведены к ::uuid (иначе UNION ALL / строгая типизация даёт text → ошибка 42804).
--
-- Запуск: вставить целиком в SQL Editor. Повторный запуск:
--   либо удалите строки вручную по email из списка ниже,
--   либо раскомментируйте блок «Очистка» в конце (осторожно: CASCADE).
--
-- Email модераторов: elena.volkova@neoflex.ru, dmitry.sokolov@neoflex.ru, olga.nikitina@neoflex.ru
-- Email студентов: artem.morozov@gmail.com, sofia.lebedeva@mail.ru, maxim.orlov@yandex.ru,
--   polina.zaytseva@student.neoflex.ru, ilya.kuznetsov@outlook.com
-- =============================================================================

-- Расширение для crypt() (если решите перейти на динамический хэш)
-- CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Приведение схемы к shared/plan/db.md (безопасно при повторе)
-- ---------------------------------------------------------------------------
ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS content_blocks_json jsonb;

ALTER TABLE public.lessons
    ADD COLUMN IF NOT EXISTS content_blocks_json jsonb,
    ADD COLUMN IF NOT EXISTS video_embed_url text,
    ADD COLUMN IF NOT EXISTS practice_kind text,
    ADD COLUMN IF NOT EXISTS practice_title text,
    ADD COLUMN IF NOT EXISTS quiz_question text,
    ADD COLUMN IF NOT EXISTS quiz_options_json text,
    ADD COLUMN IF NOT EXISTS quiz_correct_option text,
    ADD COLUMN IF NOT EXISTS ide_template text,
    ADD COLUMN IF NOT EXISTS tests_json text;

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS task_type text,
    ADD COLUMN IF NOT EXISTS prompt_text text,
    ADD COLUMN IF NOT EXISTS tests_json text;

-- ---------------------------------------------------------------------------
-- Константы: пароль «password»
-- ---------------------------------------------------------------------------
BEGIN;

-- bcrypt «password» (60 символов)
CREATE TEMP TABLE _seed_pw (h text) ON COMMIT DROP;
INSERT INTO _seed_pw VALUES
    ('$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

-- ---------------------------------------------------------------------------
-- Компетенции
-- ---------------------------------------------------------------------------
INSERT INTO public.competencies (id, name) VALUES
    ('c1111111-1111-4111-a111-111111111101'::uuid, 'SQL и инженерия данных'),
    ('c1111111-1111-4111-a111-111111111102'::uuid, 'Алгоритмика (Python)'),
    ('c1111111-1111-4111-a111-111111111103'::uuid, 'DevOps и Git'),
    ('c1111111-1111-4111-a111-111111111104'::uuid, 'Архитектура приложений')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Курс
-- ---------------------------------------------------------------------------
INSERT INTO public.courses (id, title, description, is_published, content_blocks_json)
VALUES (
    'd2222222-2222-4222-a222-222222222201'::uuid,
    'NeoFlex Bootcamp: базовый инжиниринг',
    'Вводный интенсив для младших разработчиков: Python, SQL, CI/CD и безопасные практики поставки.',
    true,
    '[
      {"type": "text", "text": "Поздравляем с завершением модуля! Вы прошли путь от сортировок до основ CI/CD."},
      {"type": "video", "embedUrl": "https://www.youtube.com/embed/dQw4w9WgXcQ"},
      {
        "type": "quiz",
        "title": "Итоговая проверка",
        "question": "Что обязательно перед выкладкой в продакшен?",
        "options": ["Автоматические проверки качества и безопасности", "Только ручной деплой", "Отключить тесты на релизе"],
        "correctOption": "a"
      },
      {
        "type": "ide",
        "title": "Мини-практика",
        "language": "python",
        "task": "Выведите в консоль строку OK",
        "template": "print(''TODO'')",
        "tests": [{"input": "", "expected": "OK"}]
      }
    ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Уроки (модульный контент + legacy-fallback)
-- ---------------------------------------------------------------------------
INSERT INTO public.lessons (
    id, course_id, title, order_index, content_body,
    content_blocks_json,
    video_embed_url, practice_kind, practice_title,
    quiz_question, quiz_options_json, quiz_correct_option,
    ide_template, tests_json
) VALUES
(
    'e3333333-3333-4333-a333-333333333301'::uuid,
    'd2222222-2222-4222-a222-222222222201'::uuid,
    'Шаг 1. Сортировка массивов (Python)',
    1,
    'Сортировка — базовый приём работы с коллекциями. В Python удобно использовать встроенный `sorted()` и понимать стабильность алгоритмов.',
    '[
      {"type": "text", "text": "Сначала разберём идею упорядочивания и зачем она нужна в обработке данных."},
      {"type": "video", "embedUrl": "https://www.youtube.com/embed/aircAruvnKk"},
      {
        "type": "quiz",
        "title": "Быстрая проверка",
        "question": "Какой вызов вернёт новый отсортированный список?",
        "options": ["sorted([3,1,2])", "[3,1,2].sort()", "order([3,1,2])"],
        "correctOption": "a"
      },
      {
        "type": "ide",
        "title": "Практика: сортировка",
        "language": "python",
        "task": "Отсортируйте массив [5, 2, 8, 1] и выведите результат в консоль одной строкой.",
        "template": "nums = [5, 2, 8, 1]\n# your code",
        "tests": [{"input": "", "expected": "[1, 2, 5, 8]"}]
      }
    ]'::jsonb,
    NULL,
    'ide',
    'Сортировка массива',
    NULL,
    NULL,
    NULL,
    'nums = [5, 2, 8, 1]\nprint(sorted(nums))',
    '[{"input": "", "expected": "[1, 2, 5, 8]"}]'
),
(
    'e3333333-3333-4333-a333-333333333302'::uuid,
    'd2222222-2222-4222-a222-222222222201'::uuid,
    'Шаг 2. Выборка данных (SQL)',
    2,
    'Операторы SELECT и WHERE — основа чтения данных. Важно учитывать индексы и предсказуемость планов запросов.',
    '[
      {"type": "text", "text": "Научимся безопасно читать данные из таблиц и фильтровать строки."},
      {"type": "video", "embedUrl": "https://www.youtube.com/embed/HXV3zeQKqGY"},
      {
        "type": "quiz",
        "title": "SQL основы",
        "question": "Какой оператор задаёт фильтр строк?",
        "options": ["WHERE", "FILTER BY", "HAVING только"],
        "correctOption": "a"
      },
      {
        "type": "ide",
        "title": "Практика: SELECT",
        "language": "sql",
        "task": "Напишите запрос, который выводит все строки из таблицы users (Judge0-эталон — фиксированный вывод среды).",
        "template": "-- SELECT ...",
        "tests": [{"input": "", "expected": "demo_rows"}]
      }
    ]'::jsonb,
    'https://www.youtube.com/embed/HXV3zeQKqGY',
    'hybrid',
    'Запрос к таблице',
    'Что делает SELECT *?',
    '["Возвращает все колонки", "Удаляет таблицу", "Создаёт индекс"]',
    'a',
    'SELECT * FROM users;',
    '[{"input": "", "expected": "demo_rows"}]'
),
(
    'e3333333-3333-4333-a333-333333333303'::uuid,
    'd2222222-2222-4222-a222-222222222201'::uuid,
    'Шаг 3. CI/CD и пайплайны',
    3,
    'Непрерывная интеграция снижает риск регрессий: автоматические тесты, линтеры и проверки безопасности в одном пайплайне.',
    '[
      {"type": "text", "text": "CI/CD сокращает время поставки и повторяемость релизов."},
      {"type": "video", "embedUrl": "https://www.youtube.com/embed/dQw4w9WgXcQ"},
      {
        "type": "quiz",
        "title": "Пайплайн",
        "question": "Главный критерий готовности к продакшену?",
        "options": [
          "Успешные проверки качества и безопасности",
          "Только ручной деплой",
          "Минимум шагов без проверок"
        ],
        "correctOption": "a"
      },
      {
        "type": "ide",
        "title": "Практика: версия Go",
        "language": "go",
        "task": "Выведите в stdout строку go1.21 (имитация проверки среды).",
        "template": "package main\nimport \"fmt\"\nfunc main() {\n  fmt.Println(\"TODO\")\n}",
        "tests": [{"input": "", "expected": "go1.21"}]
      }
    ]'::jsonb,
    NULL,
    'hybrid',
    'Контроль CI/CD',
    'Что такое CI?',
    '["Автосборка и автотесты при изменениях", "Только ручное тестирование", "Удаление старых веток"]',
    'a',
    NULL,
    NULL
),
(
    'e3333333-3333-4333-a333-333333333304'::uuid,
    'd2222222-2222-4222-a222-222222222201'::uuid,
    'Шаг 4. Обзор архитектуры',
    4,
    'Слои приложения, границы модулей и зависимости: как не превратить сервис в «большой ком грязи».',
    '[
      {"type": "text", "text": "Разделение ответственности помогает масштабировать команду и кодовую базу."},
      {"type": "video", "embedUrl": "https://www.youtube.com/embed/LEJVHDdywyg"},
      {
        "type": "quiz",
        "title": "Архитектура",
        "question": "Что чаще всего описывает диаграмма C4 уровня контейнеров?",
        "options": [
          "Взаимодействие приложений и хранилищ",
          "Цвет кнопок в UI",
          "Список коммитов за день"
        ],
        "correctOption": "a"
      }
    ]'::jsonb,
    NULL,
    'none',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Задачи (Judge0 language_id: 71 Python, 82 SQL, 60 Go — уточните под ваш Judge0)
-- ---------------------------------------------------------------------------
INSERT INTO public.tasks (
    id, lesson_id, language_id, reference_answer, competency_id,
    task_type, prompt_text, tests_json
) VALUES
(
    'f4444444-4444-4444-a444-444444444401'::uuid,
    'e3333333-3333-4333-a333-333333333301'::uuid,
    71,
    '[1, 2, 5, 8]',
    'c1111111-1111-4111-a111-111111111102'::uuid,
    'ide',
    'Отсортируйте массив [5, 2, 8, 1] и выведите результат в консоль (ожидается строка вида списка).',
    '[{"input": "", "expected": "[1, 2, 5, 8]"}]'
),
(
    'f4444444-4444-4444-a444-444444444402'::uuid,
    'e3333333-3333-4333-a333-333333333302'::uuid,
    82,
    'demo_rows',
    'c1111111-1111-4111-a111-111111111101'::uuid,
    'ide',
    'Выведите все данные из таблицы в учебной среде Judge0; эталонный stdout: demo_rows.',
    '[{"input": "", "expected": "demo_rows"}]'
),
(
    'f4444444-4444-4444-a444-444444444403'::uuid,
    'e3333333-3333-4333-a333-333333333303'::uuid,
    60,
    'go1.21',
    'c1111111-1111-4111-a111-111111111103'::uuid,
    'ide',
    'Выведите строку go1.21 в stdout.',
    '[{"input": "", "expected": "go1.21"}]'
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Пользователи: 3 модератора + 5 студентов
-- ---------------------------------------------------------------------------
INSERT INTO public.users (id, role, email, password_hash, full_name, tg_chat_id)
SELECT 'a1000000-0000-4000-a000-000000000001'::uuid, 'moderator', 'elena.volkova@neoflex.ru', h,
       'Волкова Елена Андреевна', '184920563'
FROM _seed_pw
UNION ALL
SELECT 'a1000000-0000-4000-a000-000000000002'::uuid, 'moderator', 'dmitry.sokolov@neoflex.ru', h,
       'Соколов Дмитрий Игоревич', '291837465'
FROM _seed_pw
UNION ALL
SELECT 'a1000000-0000-4000-a000-000000000003'::uuid, 'moderator', 'olga.nikitina@neoflex.ru', h,
       'Никитина Ольга Сергеевна', NULL
FROM _seed_pw
UNION ALL
SELECT 'b2000000-0000-4000-a000-000000000001'::uuid, 'student', 'artem.morozov@gmail.com', h,
       'Морозов Артём Павлович', '552198441'
FROM _seed_pw
UNION ALL
SELECT 'b2000000-0000-4000-a000-000000000002'::uuid, 'student', 'sofia.lebedeva@mail.ru', h,
       'Лебедева София Дмитриевна', '661093872'
FROM _seed_pw
UNION ALL
SELECT 'b2000000-0000-4000-a000-000000000003'::uuid, 'student', 'maxim.orlov@yandex.ru', h,
       'Орлов Максим Викторович', NULL
FROM _seed_pw
UNION ALL
SELECT 'b2000000-0000-4000-a000-000000000004'::uuid, 'student', 'polina.zaytseva@student.neoflex.ru', h,
       'Зайцева Полина Ильинична', '773084219'
FROM _seed_pw
UNION ALL
SELECT 'b2000000-0000-4000-a000-000000000005'::uuid, 'student', 'ilya.kuznetsov@outlook.com', h,
       'Кузнецов Илья Николаевич', '884075306'
FROM _seed_pw
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    tg_chat_id = EXCLUDED.tg_chat_id,
    password_hash = EXCLUDED.password_hash;

-- ---------------------------------------------------------------------------
-- Записи на курс (прогресс согласован с 3 задачами курса: 100% / 67% / 33% / 0%)
-- ---------------------------------------------------------------------------
INSERT INTO public.enrollments (id, user_id, course_id, progress_percent) VALUES
    ('ee111111-1111-4111-a111-111111111101'::uuid, 'b2000000-0000-4000-a000-000000000001'::uuid, 'd2222222-2222-4222-a222-222222222201'::uuid, 100),
    ('ee111111-1111-4111-a111-111111111102'::uuid, 'b2000000-0000-4000-a000-000000000002'::uuid, 'd2222222-2222-4222-a222-222222222201'::uuid, 67),
    ('ee111111-1111-4111-a111-111111111103'::uuid, 'b2000000-0000-4000-a000-000000000003'::uuid, 'd2222222-2222-4222-a222-222222222201'::uuid, 33),
    ('ee111111-1111-4111-a111-111111111104'::uuid, 'b2000000-0000-4000-a000-000000000004'::uuid, 'd2222222-2222-4222-a222-222222222201'::uuid, 33),
    ('ee111111-1111-4111-a111-111111111105'::uuid, 'b2000000-0000-4000-a000-000000000005'::uuid, 'd2222222-2222-4222-a222-222222222201'::uuid, 0)
ON CONFLICT (user_id, course_id) DO UPDATE SET
    progress_percent = EXCLUDED.progress_percent;

-- ---------------------------------------------------------------------------
-- Матрица компетенций (баллы 0..100, кратно +10 за успешную задачу)
-- ---------------------------------------------------------------------------
INSERT INTO public.user_competencies (user_id, competency_id, level) VALUES
    ('b2000000-0000-4000-a000-000000000001'::uuid, 'c1111111-1111-4111-a111-111111111102'::uuid, 30),
    ('b2000000-0000-4000-a000-000000000001'::uuid, 'c1111111-1111-4111-a111-111111111101'::uuid, 30),
    ('b2000000-0000-4000-a000-000000000001'::uuid, 'c1111111-1111-4111-a111-111111111103'::uuid, 30),
    ('b2000000-0000-4000-a000-000000000002'::uuid, 'c1111111-1111-4111-a111-111111111102'::uuid, 20),
    ('b2000000-0000-4000-a000-000000000002'::uuid, 'c1111111-1111-4111-a111-111111111101'::uuid, 20),
    ('b2000000-0000-4000-a000-000000000003'::uuid, 'c1111111-1111-4111-a111-111111111102'::uuid, 10),
    ('b2000000-0000-4000-a000-000000000004'::uuid, 'c1111111-1111-4111-a111-111111111101'::uuid, 10)
ON CONFLICT (user_id, competency_id) DO UPDATE SET
    level = EXCLUDED.level;

-- ---------------------------------------------------------------------------
-- Submissions (успехи под прогресс; у Ильи — одна неудачная попытка)
-- ---------------------------------------------------------------------------
INSERT INTO public.submissions (id, user_id, task_id, status, user_code) VALUES
    ('ef111111-1111-4111-a111-111111111101'::uuid, 'b2000000-0000-4000-a000-000000000001'::uuid, 'f4444444-4444-4444-a444-444444444401'::uuid, 'success',
     'print(sorted([5, 2, 8, 1]))'),
    ('ef111111-1111-4111-a111-111111111102'::uuid, 'b2000000-0000-4000-a000-000000000001'::uuid, 'f4444444-4444-4444-a444-444444444402'::uuid, 'success',
     'SELECT * FROM users;'),
    ('ef111111-1111-4111-a111-111111111103'::uuid, 'b2000000-0000-4000-a000-000000000001'::uuid, 'f4444444-4444-4444-a444-444444444403'::uuid, 'success',
     E'package main\nimport "fmt"\nfunc main() { fmt.Println("go1.21") }'),
    ('ef111111-1111-4111-a111-111111111104'::uuid, 'b2000000-0000-4000-a000-000000000002'::uuid, 'f4444444-4444-4444-a444-444444444401'::uuid, 'success',
     E'nums = [5, 2, 8, 1]\nprint(sorted(nums))'),
    ('ef111111-1111-4111-a111-111111111105'::uuid, 'b2000000-0000-4000-a000-000000000002'::uuid, 'f4444444-4444-4444-a444-444444444402'::uuid, 'success',
     'SELECT * FROM users LIMIT 10;'),
    ('ef111111-1111-4111-a111-111111111106'::uuid, 'b2000000-0000-4000-a000-000000000003'::uuid, 'f4444444-4444-4444-a444-444444444401'::uuid, 'success',
     'print(sorted([5,2,8,1]))'),
    ('ef111111-1111-4111-a111-111111111107'::uuid, 'b2000000-0000-4000-a000-000000000004'::uuid, 'f4444444-4444-4444-a444-444444444402'::uuid, 'success',
     'SELECT * FROM users;'),
    ('ef111111-1111-4111-a111-111111111108'::uuid, 'b2000000-0000-4000-a000-000000000005'::uuid, 'f4444444-4444-4444-a444-444444444401'::uuid, 'failed',
     'print([5, 2, 8, 1])')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- =============================================================================
-- Опционально: откат только этого сида (раскомментируйте при необходимости)
-- =============================================================================
-- BEGIN;
-- DELETE FROM public.submissions WHERE id::text LIKE 'ef111111%';
-- DELETE FROM public.user_competencies WHERE user_id::text LIKE 'b2000000%';
-- DELETE FROM public.enrollments WHERE id::text LIKE 'ee111111%';
-- DELETE FROM public.users WHERE id::text LIKE 'a1000000%' OR id::text LIKE 'b2000000%';
-- DELETE FROM public.tasks WHERE id::text LIKE 'f4444444%';
-- DELETE FROM public.lessons WHERE id::text LIKE 'e3333333%';
-- DELETE FROM public.courses WHERE id = 'd2222222-2222-4222-a222-222222222201';
-- DELETE FROM public.competencies WHERE id::text LIKE 'c1111111%';
-- COMMIT;
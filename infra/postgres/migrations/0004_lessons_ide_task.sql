-- 0004_lessons_ide_task.sql
-- Текст задания для IDE на уровне урока (совместимо с прод-схемой и фронтом).

ALTER TABLE public.lessons
    ADD COLUMN IF NOT EXISTS ide_task text NULL;

COMMENT ON COLUMN public.lessons.ide_task IS 'Текст практики для редактора; дополняет content_blocks_json и legacy-поля.';

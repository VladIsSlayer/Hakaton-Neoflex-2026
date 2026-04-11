-- 0002_submission_success_uniqueness.sql
-- Prevent duplicate success rows for same user/task to avoid race conditions.

CREATE UNIQUE INDEX IF NOT EXISTS submissions_one_success_per_user_task_idx
    ON public.submissions (user_id, task_id)
    WHERE status = 'success';

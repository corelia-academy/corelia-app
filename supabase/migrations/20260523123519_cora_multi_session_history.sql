-- Cora chat history: allow multiple sessions per user × course,
-- and track which lesson each session was started from for UI labelling.

-- 1. Ensure course_id exists before creating the course-scoped index below.
-- A later migration also adds this column with IF NOT EXISTS, so this remains
-- compatible with both fresh resets and already-migrated environments.
ALTER TABLE public.ai_chat_sessions
  ADD COLUMN IF NOT EXISTS course_id text NULL;

-- 2. Add lesson_id column to ai_chat_sessions
ALTER TABLE public.ai_chat_sessions
  ADD COLUMN IF NOT EXISTS lesson_id text NULL;

-- 3. Drop the old uniqueness constraint that forced "1 session per course"
DROP INDEX IF EXISTS public.ai_chat_sessions_course_unique;

-- 4. Support index for listing sessions by user × course, newest first
CREATE INDEX IF NOT EXISTS ai_chat_sessions_user_course_recent_idx
  ON public.ai_chat_sessions (user_id, course_id, last_message_at DESC)
  WHERE course_id IS NOT NULL;

-- 5. Support index for listing sessions by lesson
CREATE INDEX IF NOT EXISTS ai_chat_sessions_user_lesson_recent_idx
  ON public.ai_chat_sessions (user_id, lesson_id, last_message_at DESC)
  WHERE lesson_id IS NOT NULL;

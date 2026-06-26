-- Cora chat history: allow multiple sessions per user × course,
-- and track which lesson each session was started from for UI labelling.

-- 1. Add course_id and lesson_id columns to ai_chat_sessions
ALTER TABLE public.ai_chat_sessions
  ADD COLUMN IF NOT EXISTS course_id text NULL;

ALTER TABLE public.ai_chat_sessions
  ADD COLUMN IF NOT EXISTS lesson_id text NULL;

-- 2. Drop the old uniqueness constraint that forced "1 session per course"
DROP INDEX IF EXISTS public.ai_chat_sessions_course_unique;

-- 3. Support index for listing sessions by user × course, newest first
CREATE INDEX IF NOT EXISTS ai_chat_sessions_user_course_recent_idx
  ON public.ai_chat_sessions (user_id, course_id, last_message_at DESC)
  WHERE course_id IS NOT NULL;

-- 4. Support index for listing sessions by lesson
CREATE INDEX IF NOT EXISTS ai_chat_sessions_user_lesson_recent_idx
  ON public.ai_chat_sessions (user_id, lesson_id, last_message_at DESC)
  WHERE lesson_id IS NOT NULL;

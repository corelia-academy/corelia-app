-- Add course_id to ai_chat_sessions for per-course chat history
ALTER TABLE public.ai_chat_sessions
  ADD COLUMN IF NOT EXISTS course_id text NULL;

-- Drop the old context_type check and recreate with 'course' included
ALTER TABLE public.ai_chat_sessions
  DROP CONSTRAINT IF EXISTS ai_chat_sessions_context_type_check;

ALTER TABLE public.ai_chat_sessions
  ADD CONSTRAINT ai_chat_sessions_context_type_check
  CHECK (context_type IN (
    'dashboard',
    'course_discovery',
    'career',
    'activity',
    'profile_review',
    'global',
    'course'
  ));

-- Unique index: one course session per user per course
CREATE UNIQUE INDEX IF NOT EXISTS ai_chat_sessions_course_unique
  ON public.ai_chat_sessions (user_id, context_type, course_id)
  WHERE course_id IS NOT NULL;

-- Support index for looking up sessions by course_id
CREATE INDEX IF NOT EXISTS ai_chat_sessions_user_course_id
  ON public.ai_chat_sessions (user_id, course_id)
  WHERE course_id IS NOT NULL;

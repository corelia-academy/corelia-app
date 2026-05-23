ALTER TABLE public.ai_conversations
  DROP CONSTRAINT IF EXISTS ai_conversations_context_type_check;

ALTER TABLE public.ai_conversations
  ADD CONSTRAINT ai_conversations_context_type_check
  CHECK (context_type IN (
    'lesson',
    'course',
    'dashboard',
    'course_discovery',
    'career',
    'activity',
    'profile_review',
    'global'
  ));

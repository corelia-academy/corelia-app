-- Lesson-level quiz support
-- Adds lesson_id to course_section_questions and section_question_attempts
-- so quiz questions can be scoped to individual lessons (not just sections).

-- ── course_section_questions ──────────────────────────────────────────────────

ALTER TABLE public.course_section_questions
  ADD COLUMN IF NOT EXISTS lesson_id uuid
    REFERENCES public.lessons(id) ON DELETE CASCADE;

-- Index for fast lesson-scoped retrieval
CREATE INDEX IF NOT EXISTS idx_csq_lesson_id
  ON public.course_section_questions (lesson_id, sort_order)
  WHERE lesson_id IS NOT NULL;

-- ── section_question_attempts ─────────────────────────────────────────────────

ALTER TABLE public.section_question_attempts
  ADD COLUMN IF NOT EXISTS lesson_id uuid
    REFERENCES public.lessons(id) ON DELETE CASCADE;

-- Index for fast retrieval of attempts by user + lesson
CREATE INDEX IF NOT EXISTS idx_sqa_user_lesson
  ON public.section_question_attempts (user_id, course_id, lesson_id, attempted_at DESC)
  WHERE lesson_id IS NOT NULL;

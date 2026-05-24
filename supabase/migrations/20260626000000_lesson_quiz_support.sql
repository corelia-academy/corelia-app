-- Lesson-level quiz support
-- Adds lesson_id to course_section_questions and section_question_attempts
-- so quiz questions can be scoped to individual lessons (not just sections).
--
-- NOTE: course_lessons has a composite PK (course_id, id) with id typed as text.
-- The FK must therefore reference both columns and lesson_id must be text.

-- ── course_section_questions ──────────────────────────────────────────────────

ALTER TABLE public.course_section_questions
  ADD COLUMN IF NOT EXISTS lesson_id text;

-- Composite FK: (course_id, lesson_id) → course_lessons(course_id, id)
-- NOT VALID skips scanning existing rows (all have lesson_id = NULL, so no violation).
ALTER TABLE public.course_section_questions
  ADD CONSTRAINT csq_lesson_fk
    FOREIGN KEY (course_id, lesson_id)
    REFERENCES public.course_lessons(course_id, id)
    ON DELETE CASCADE
    NOT VALID;

ALTER TABLE public.course_section_questions
  VALIDATE CONSTRAINT csq_lesson_fk;

-- Index for fast lesson-scoped retrieval
CREATE INDEX IF NOT EXISTS idx_csq_lesson_id
  ON public.course_section_questions (lesson_id, sort_order)
  WHERE lesson_id IS NOT NULL;

-- ── section_question_attempts ─────────────────────────────────────────────────

ALTER TABLE public.section_question_attempts
  ADD COLUMN IF NOT EXISTS lesson_id text;

ALTER TABLE public.section_question_attempts
  ADD CONSTRAINT sqa_lesson_fk
    FOREIGN KEY (course_id, lesson_id)
    REFERENCES public.course_lessons(course_id, id)
    ON DELETE CASCADE
    NOT VALID;

ALTER TABLE public.section_question_attempts
  VALIDATE CONSTRAINT sqa_lesson_fk;

-- Index for fast retrieval of attempts by user + lesson
CREATE INDEX IF NOT EXISTS idx_sqa_user_lesson
  ON public.section_question_attempts (user_id, course_id, lesson_id, attempted_at DESC)
  WHERE lesson_id IS NOT NULL;

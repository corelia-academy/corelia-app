-- Allow section_id to be NULL for lesson-scoped quizzes.
-- Original schema had section_id NOT NULL, but lesson_quiz_support added lesson_id
-- without relaxing section_id — so inserting a lesson-scoped row (section_id = NULL)
-- fails with "null value in column section_id violates not-null constraint".
--
-- New invariant: exactly one of (section_id, lesson_id) is set per row.

-- ── course_section_questions ──────────────────────────────────────────────────

ALTER TABLE public.course_section_questions
  ALTER COLUMN section_id DROP NOT NULL;

ALTER TABLE public.course_section_questions
  ADD CONSTRAINT csq_scope_exactly_one
    CHECK (
      (section_id IS NOT NULL AND lesson_id IS NULL)
      OR
      (section_id IS NULL AND lesson_id IS NOT NULL)
    );

-- ── section_question_attempts ─────────────────────────────────────────────────

ALTER TABLE public.section_question_attempts
  ALTER COLUMN section_id DROP NOT NULL;

ALTER TABLE public.section_question_attempts
  ADD CONSTRAINT sqa_scope_exactly_one
    CHECK (
      (section_id IS NOT NULL AND lesson_id IS NULL)
      OR
      (section_id IS NULL AND lesson_id IS NOT NULL)
    );

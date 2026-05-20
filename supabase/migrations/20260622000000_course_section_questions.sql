-- Course section questions for AI-generated quizzes.
-- Each row is one MCQ question belonging to a course section.
-- Instructors generate & edit these; enrolled students read them to take quizzes.

CREATE TABLE public.course_section_questions (
  id          text        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  course_id   text        NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  section_id  text        NOT NULL,
  sort_order  integer     NOT NULL DEFAULT 0,
  -- Full question payload (type, question text, options, correct_index, explanation, locale)
  data        jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_csq_section
  ON public.course_section_questions (course_id, section_id, sort_order);

ALTER TABLE public.course_section_questions ENABLE ROW LEVEL SECURITY;

-- Read: anyone who can view the course (published → all; draft → content managers)
CREATE POLICY csq_select
  ON public.course_section_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.published = true
          OR private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'content')
        )
    )
  );

-- Write: content managers only (instructor, co-instructor with content permission, admin)
CREATE POLICY csq_insert
  ON public.course_section_questions FOR INSERT
  WITH CHECK (private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'content'));

CREATE POLICY csq_update
  ON public.course_section_questions FOR UPDATE
  USING (private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'content'))
  WITH CHECK (private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'content'));

CREATE POLICY csq_delete
  ON public.course_section_questions FOR DELETE
  USING (private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'content'));

-- ---------------------------------------------------------------------------

-- Student quiz attempts: one row per (user, question) per attempt.
-- Multiple attempts allowed — last attempt wins for display, all kept for history.

CREATE TABLE public.section_question_attempts (
  id              text        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id       text        NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  section_id      text        NOT NULL,
  question_id     text        NOT NULL REFERENCES public.course_section_questions(id) ON DELETE CASCADE,
  selected_index  integer     NOT NULL,
  is_correct      boolean     NOT NULL,
  attempted_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sqa_user_section
  ON public.section_question_attempts (user_id, course_id, section_id, attempted_at DESC);

ALTER TABLE public.section_question_attempts ENABLE ROW LEVEL SECURITY;

-- Students can only read and write their own attempts
CREATE POLICY sqa_select
  ON public.section_question_attempts FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY sqa_insert
  ON public.section_question_attempts FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

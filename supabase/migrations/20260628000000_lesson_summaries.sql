-- AI-generated lesson recap summaries (per user × lesson).
--
-- Triggered when a user marks a lesson complete. Cora distills 3-5 key
-- points + practical tips from the lesson content; this row is the
-- persisted recap so the card stays available on revisit.
--
-- course_lessons has composite PK (course_id, id) with id typed as text,
-- so lesson_id must be text and the FK is composite.

CREATE TABLE IF NOT EXISTS public.lesson_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id text NOT NULL,
  lesson_id text NOT NULL,
  locale text NOT NULL DEFAULT 'vi' CHECK (locale IN ('vi', 'en')),
  key_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  practical_tips jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_used text,
  source_kinds text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lesson_summaries_user_lesson_uq UNIQUE (user_id, lesson_id),
  CONSTRAINT lesson_summaries_lesson_fk
    FOREIGN KEY (course_id, lesson_id)
    REFERENCES public.course_lessons(course_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lesson_summaries_user_lesson
  ON public.lesson_summaries (user_id, lesson_id);

CREATE INDEX IF NOT EXISTS idx_lesson_summaries_user_course
  ON public.lesson_summaries (user_id, course_id, created_at DESC);

ALTER TABLE public.lesson_summaries ENABLE ROW LEVEL SECURITY;

-- Users can read only their own summaries.
CREATE POLICY lesson_summaries_select_own
  ON public.lesson_summaries
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Writes go through the edge function (service role); block direct client writes.
-- (No INSERT/UPDATE/DELETE policy for authenticated → only service_role can mutate.)

-- AI-generated flashcard decks per (user × lesson).
--
-- A deck stores its cards inline as jsonb. Each card carries simple
-- 3-bucket spaced-repetition state (new / good / easy) maintained
-- client-side via authenticated UPDATEs on the owning row.
--
-- course_lessons has composite PK (course_id, id) with id typed as text,
-- so lesson_id must be text and the FK is composite.

CREATE TABLE IF NOT EXISTS public.flashcard_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id text NOT NULL,
  lesson_id text NOT NULL,
  locale text NOT NULL DEFAULT 'vi' CHECK (locale IN ('vi', 'en')),
  cards jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_used text,
  source_kinds text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flashcard_decks_user_lesson_uq UNIQUE (user_id, lesson_id),
  CONSTRAINT flashcard_decks_lesson_fk
    FOREIGN KEY (course_id, lesson_id)
    REFERENCES public.course_lessons(course_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS flashcard_decks_user_idx
  ON public.flashcard_decks (user_id);

ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY flashcard_decks_owner_read
  ON public.flashcard_decks FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY flashcard_decks_owner_update
  ON public.flashcard_decks FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Pre-lesson Readiness Check: 2-3 MCQs sinh từ kiến thức của các lesson
-- trước trong cùng section, để học viên tự đo nền tảng trước khi vào lesson.
--
-- Một row = một (user × lesson). Câu hỏi sinh ra + câu trả lời + score lưu
-- inline trong jsonb. Sau khi user submit hoặc skip, reviewed_at được set
-- và UI sẽ ẩn banner trong các lần truy cập sau.
--
-- course_lessons có composite PK (course_id, id) với id text, nên FK
-- composite + lesson_id text.

CREATE TABLE IF NOT EXISTS public.lesson_readiness_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id text NOT NULL,
  lesson_id text NOT NULL,
  locale text NOT NULL DEFAULT 'vi' CHECK (locale IN ('vi', 'en')),
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_lesson_ids text[] NOT NULL DEFAULT '{}'::text[],
  user_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  score numeric,
  passed boolean,
  skipped boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lrc_user_lesson_uq UNIQUE (user_id, lesson_id),
  CONSTRAINT lrc_lesson_fk
    FOREIGN KEY (course_id, lesson_id)
    REFERENCES public.course_lessons(course_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS lrc_user_idx
  ON public.lesson_readiness_checks (user_id);

ALTER TABLE public.lesson_readiness_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lrc_owner_read ON public.lesson_readiness_checks;
CREATE POLICY lrc_owner_read
  ON public.lesson_readiness_checks FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS lrc_owner_insert ON public.lesson_readiness_checks;
CREATE POLICY lrc_owner_insert
  ON public.lesson_readiness_checks FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS lrc_owner_update ON public.lesson_readiness_checks;
CREATE POLICY lrc_owner_update
  ON public.lesson_readiness_checks FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

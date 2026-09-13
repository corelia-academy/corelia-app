-- Empty video URLs represent published lessons whose video is still being updated.
-- A non-empty malformed URL remains a publication/readiness error.
BEGIN;

DO $$
DECLARE definition text; changed text;
BEGIN
  definition := pg_get_functiondef('private.learning_lesson_errors(text,jsonb,text)'::regprocedure);
  changed := replace(
    definition,
    'IF private.learning_youtube_id(p_data->>''youtube_url'') IS NULL THEN errors:=array_append(errors,''youtube_required''); END IF;',
    'IF COALESCE(btrim(p_data->>''youtube_url''),'''')<>'''' AND private.learning_youtube_id(p_data->>''youtube_url'') IS NULL THEN errors:=array_append(errors,''youtube_required''); END IF;'
  );
  changed := replace(
    changed,
    'CASE WHEN COALESCE(btrim(p_data->>''youtube_url''),'''')<>'''' THEN ''video'' ELSE ''article'' END',
    'CASE WHEN COALESCE(btrim(p_data->>''youtube_url''),'''')<>'''' THEN ''video'' WHEN COALESCE(btrim(p_data->>''description_markdown''),btrim(p_data->>''short_description''),'''')<>'''' THEN ''article'' ELSE ''video'' END'
  );
  IF changed <> definition THEN
    EXECUTE changed;
  ELSIF position('COALESCE(btrim(p_data->>''youtube_url''),'''')<>'''' AND private.learning_youtube_id' IN definition)=0 THEN
    RAISE EXCEPTION 'learning_lesson_errors video validation signature changed';
  END IF;
END $$;

DO $$
DECLARE definition text; changed text;
BEGIN
  definition := pg_get_functiondef('private.learning_lesson_issues(text,text,jsonb,text)'::regprocedure);
  changed := replace(
    definition,
    'CASE WHEN NULLIF(p_data->>''youtube_url'','''') IS NOT NULL THEN ''video'' ELSE ''article'' END',
    'CASE WHEN COALESCE(btrim(p_data->>''youtube_url''),'''')<>'''' THEN ''video'' WHEN COALESCE(btrim(p_data->>''description_markdown''),btrim(p_data->>''short_description''),'''')<>'''' THEN ''article'' ELSE ''video'' END'
  );
  IF changed <> definition THEN
    EXECUTE changed;
  ELSIF position('WHEN COALESCE(btrim(p_data->>''description_markdown''),btrim(p_data->>''short_description''),'''')<>'''' THEN ''article''' IN definition)=0 THEN
    RAISE EXCEPTION 'learning_lesson_issues format inference signature changed';
  END IF;
END $$;

-- Keep an idempotent audit trail for legacy question groups moved into draft quizzes.
CREATE TABLE IF NOT EXISTS private.learning_legacy_quiz_migrations (
  course_id text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('lesson','section')),
  source_id text NOT NULL,
  locale text NOT NULL,
  quiz_lesson_id text NOT NULL,
  migrated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id,source_kind,source_id,locale),
  UNIQUE (course_id,quiz_lesson_id),
  FOREIGN KEY (course_id,quiz_lesson_id) REFERENCES public.course_lessons(course_id,id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);
REVOKE ALL ON TABLE private.learning_legacy_quiz_migrations FROM PUBLIC,anon,authenticated;

CREATE TEMP TABLE learning_legacy_question_snapshot ON COMMIT DROP AS
SELECT q.id,q.course_id,q.data,
  CASE WHEN q.lesson_id IS NULL THEN 'section' ELSE 'lesson' END AS source_kind,
  COALESCE(q.lesson_id,q.section_id) AS source_id,
  COALESCE(NULLIF(q.data->>'locale',''),COALESCE(c.data->'i18n'->>'primary_content_locale','vi')) AS locale
FROM public.course_section_questions q
JOIN public.courses c ON c.id=q.course_id
LEFT JOIN public.course_lessons lesson ON lesson.course_id=q.course_id AND lesson.id=q.lesson_id
WHERE q.archived_at IS NULL
  AND (q.lesson_id IS NULL OR COALESCE(lesson.data->>'lesson_format','')<>'quiz');

-- Create a draft Quiz for every legacy question group that is not already owned
-- by a Quiz lesson. Locale-specific groups stay separate when identity cannot be
-- proven across translations.
UPDATE public.course_lessons lesson
SET sort_order=lesson.sort_order*1000
WHERE EXISTS (
  SELECT 1
  FROM public.course_section_questions question
  LEFT JOIN public.course_lessons source
    ON source.course_id=question.course_id AND source.id=question.lesson_id
  WHERE question.course_id=lesson.course_id
    AND question.archived_at IS NULL
    AND (question.lesson_id IS NULL OR COALESCE(source.data->>'lesson_format','')<>'quiz')
);

WITH groups AS (
  SELECT q.course_id,
    CASE WHEN q.lesson_id IS NULL THEN 'section' ELSE 'lesson' END AS source_kind,
    COALESCE(q.lesson_id,q.section_id) AS source_id,
    COALESCE(NULLIF(q.data->>'locale',''),COALESCE(c.data->'i18n'->>'primary_content_locale','vi')) AS locale,
    COALESCE(q.section_id,l.section_id) AS target_section,
    CASE WHEN q.lesson_id IS NULL THEN COALESCE(max(existing.sort_order),-1)+1000 ELSE l.sort_order+500 END AS target_order
  FROM public.course_section_questions q
  JOIN public.courses c ON c.id=q.course_id
  LEFT JOIN public.course_lessons l ON l.course_id=q.course_id AND l.id=q.lesson_id
  LEFT JOIN public.course_lessons existing ON existing.course_id=q.course_id AND existing.section_id=q.section_id
  WHERE q.archived_at IS NULL
    AND (q.lesson_id IS NULL OR COALESCE(l.data->>'lesson_format','')<>'quiz')
  GROUP BY q.course_id,q.lesson_id,q.section_id,q.data->>'locale',c.data,l.section_id,l.sort_order
), inserted_map AS (
  INSERT INTO private.learning_legacy_quiz_migrations(course_id,source_kind,source_id,locale,quiz_lesson_id)
  SELECT course_id,source_kind,source_id,locale,
    'legacy-quiz-'||substr(md5(course_id||':'||source_kind||':'||source_id||':'||locale),1,24)
  FROM groups
  ON CONFLICT (course_id,source_kind,source_id,locale) DO NOTHING
  RETURNING *
)
INSERT INTO public.course_lessons(id,course_id,section_id,sort_order,published,archived_at,data)
SELECT m.quiz_lesson_id,g.course_id,g.target_section,g.target_order,false,NULL,
  jsonb_build_object(
    'title',CASE WHEN g.locale='vi' THEN 'Bài kiểm tra đã chuyển đổi' ELSE 'Migrated quiz' END,
    'lesson_format','quiz','quiz_config',jsonb_build_object('passing_ratio',0.7,'allow_retry',true),
    'legacy_question_source',jsonb_build_object('kind',g.source_kind,'id',g.source_id,'locale',g.locale)
  )
FROM inserted_map m JOIN groups g USING(course_id,source_kind,source_id,locale);

UPDATE public.course_section_questions q
SET lesson_id=m.quiz_lesson_id,section_id=NULL,updated_at=now()
FROM private.learning_legacy_quiz_migrations m
LEFT JOIN public.course_lessons source_lesson
  ON m.source_kind='lesson' AND source_lesson.course_id=m.course_id AND source_lesson.id=m.source_id
WHERE q.course_id=m.course_id
  AND COALESCE(NULLIF(q.data->>'locale',''),COALESCE((SELECT data->'i18n'->>'primary_content_locale' FROM public.courses WHERE id=q.course_id),'vi'))=m.locale
  AND ((m.source_kind='section' AND q.section_id=m.source_id AND q.lesson_id IS NULL)
    OR (m.source_kind='lesson' AND q.lesson_id=m.source_id AND COALESCE(source_lesson.data->>'lesson_format','')<>'quiz'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM learning_legacy_question_snapshot snapshot
    LEFT JOIN private.learning_legacy_quiz_migrations mapping
      ON mapping.course_id=snapshot.course_id
      AND mapping.source_kind=snapshot.source_kind
      AND mapping.source_id=snapshot.source_id
      AND mapping.locale=snapshot.locale
    LEFT JOIN public.course_lessons quiz
      ON quiz.course_id=mapping.course_id AND quiz.id=mapping.quiz_lesson_id
    LEFT JOIN public.course_section_questions question
      ON question.id=snapshot.id AND question.course_id=snapshot.course_id
    WHERE mapping.quiz_lesson_id IS NULL
      OR quiz.id IS NULL
      OR quiz.published
      OR quiz.data->>'lesson_format'<>'quiz'
      OR question.id IS NULL
      OR question.lesson_id IS DISTINCT FROM mapping.quiz_lesson_id
      OR question.section_id IS NOT NULL
      OR question.data IS DISTINCT FROM snapshot.data
  ) THEN
    RAISE EXCEPTION 'LEGACY_QUIZ_MIGRATION_DATA_MISMATCH';
  END IF;
END $$;

-- Attempts intentionally keep their original section/lesson scope. They remain
-- historical evidence and must not become completion or scoring for the new
-- draft Quiz.

-- Normalize ordering after inserting migrated quizzes while preserving the
-- source-before-quiz relationship and the existing relative order.
WITH ranked AS (
  SELECT course_id,id,row_number() OVER (PARTITION BY course_id,section_id ORDER BY sort_order,id)-1 AS next_order
  FROM public.course_lessons
)
UPDATE public.course_lessons l SET sort_order=ranked.next_order
FROM ranked WHERE ranked.course_id=l.course_id AND ranked.id=l.id;

-- Active questions can only belong to Quiz lessons after the conversion.
CREATE OR REPLACE FUNCTION private.learning_quiz_question_scope_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.archived_at IS NULL AND (
    NEW.lesson_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.course_lessons lesson
      WHERE lesson.course_id=NEW.course_id
        AND lesson.id=NEW.lesson_id
        AND lesson.data->>'lesson_format'='quiz'
    )
  ) THEN
    RAISE EXCEPTION 'QUESTIONS_REQUIRE_QUIZ_LESSON';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.learning_quiz_question_scope_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS learning_quiz_question_scope ON public.course_section_questions;
CREATE TRIGGER learning_quiz_question_scope
BEFORE INSERT OR UPDATE ON public.course_section_questions
FOR EACH ROW EXECUTE FUNCTION private.learning_quiz_question_scope_guard();

-- Keep the read model for history, but retire the section-level write contract.
CREATE OR REPLACE FUNCTION private.learning_save_section_questions(p_course text,p_section text,p_questions jsonb,p_locale text DEFAULT NULL)
RETURNS SETOF public.course_section_questions
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'QUESTIONS_REQUIRE_QUIZ_LESSON';
END $$;

COMMIT;

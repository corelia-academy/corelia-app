-- V-29 / Mục E migration contracts. All fixtures and writes roll back.
BEGIN;

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('ffff2900-0000-4000-8000-000000000001', 'studio-v29@corelia.local', '{"full_name":"Studio V29"}');
UPDATE public.profiles SET role = 'instructor', instructor_origin = 'corelia'
WHERE id = 'ffff2900-0000-4000-8000-000000000001';

INSERT INTO public.studio_courses (id, title, level, audience, corelia_direction, content_locale)
VALUES
  ('ffff2900-1000-4000-8000-000000000001', 'V29 fixture A', 'beginner', 'Fixture audience', 'Fixture direction', 'en'),
  ('ffff2900-1000-4000-8000-000000000002', 'V29 fixture B', 'beginner', 'Fixture audience', 'Fixture direction', 'en');
INSERT INTO public.studio_runs (id, course_id, started_by)
VALUES
  ('ffff2900-2000-4000-8000-000000000001', 'ffff2900-1000-4000-8000-000000000001', 'ffff2900-0000-4000-8000-000000000001'),
  ('ffff2900-2000-4000-8000-000000000002', 'ffff2900-1000-4000-8000-000000000002', 'ffff2900-0000-4000-8000-000000000001');
INSERT INTO public.studio_run_steps (run_id, step_key)
VALUES
  ('ffff2900-2000-4000-8000-000000000001', 'translate'),
  ('ffff2900-2000-4000-8000-000000000002', 'translate');

DO $$
DECLARE definition text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'studio_generations' AND column_name = 'locale'
  ) THEN RAISE EXCEPTION 'studio_generations.locale column missing'; END IF;

  SELECT pg_get_constraintdef(oid) INTO definition
  FROM pg_constraint
  WHERE conrelid = 'public.studio_generations'::regclass AND conname = 'studio_generations_attempt_key';
  IF definition IS NULL OR definition NOT LIKE '%catalog_job_id%' OR definition NOT LIKE '%locale%' THEN
    RAISE EXCEPTION 'locale uniqueness must keep catalog_job_id and include locale: %', definition;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.studio_generations'::regclass
      AND conname = 'studio_generations_agent_role_check'
      AND pg_get_constraintdef(oid) LIKE '%A7%'
      AND pg_get_constraintdef(oid) LIKE '%A8%'
  ) THEN RAISE EXCEPTION 'A7/A8 are not accepted by the agent role CHECK'; END IF;
END $$;

INSERT INTO public.studio_generations (
  run_id, step_key, lesson_id, locale, attempt, agent_role, kind, provider,
  requested_model_id, prompt_version, input, status
)
VALUES
  ('ffff2900-2000-4000-8000-000000000001', 'translate', NULL, 'zh-CN', 0, 'A7', 'text', 'openai', 'fixture-model', 'v1', '{}', 'submitting'),
  ('ffff2900-2000-4000-8000-000000000001', 'translate', NULL, 'ko', 0, 'A7', 'text', 'openai', 'fixture-model', 'v1', '{}', 'submitting');

DO $$
BEGIN
  BEGIN
    INSERT INTO public.studio_generations (
      run_id, step_key, lesson_id, locale, attempt, agent_role, kind, provider,
      requested_model_id, prompt_version, input, status
    ) VALUES
      ('ffff2900-2000-4000-8000-000000000001', 'translate', NULL, 'zh-CN', 0, 'A7', 'text', 'openai', 'fixture-model', 'v1', '{}', 'submitting');
    RAISE EXCEPTION 'duplicate locale attempt unexpectedly accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.studio_generations (
      run_id, step_key, lesson_id, locale, attempt, agent_role, kind, provider,
      requested_model_id, prompt_version, input, status
    ) VALUES
      ('ffff2900-2000-4000-8000-000000000001', 'translate', NULL, 'ja', 0, 'A9', 'text', 'openai', 'fixture-model', 'v1', '{}', 'submitting');
    RAISE EXCEPTION 'unsupported A9 agent role unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  IF (SELECT count(*) FROM public.studio_generations
      WHERE run_id = 'ffff2900-2000-4000-8000-000000000001' AND step_key = 'translate') <> 2 THEN
    RAISE EXCEPTION 'locale uniqueness should keep distinct locale attempts and reject duplicate locale';
  END IF;
END $$;

SET LOCAL ROLE service_role;
SELECT public.studio_publish_course(
  'ffff2900-2000-4000-8000-000000000001',
  '{"slug":"studio-v29-a","data":{"course_type":"ai_generated","title":"V29 course A","description":"Fixture course","i18n":{"supported_locales":["en","zh-CN"],"primary_content_locale":"en"}}}',
  '[{"id":"section-1","sort_order":0,"data":{"title":"Section A"}}]',
  '[{"id":"lesson-1","section_id":"section-1","sort_order":0,"data":{"title":"Lesson A","lesson_format":"quiz","description_markdown":"Fixture quiz lesson.","quiz_config":{"allow_retry":true,"passing_ratio":0.7}}}]',
  '[{"id":"ffff2900-1000-4000-8000-000000000001-lesson-1-q1","lesson_id":"lesson-1","sort_order":0,"data":{"type":"mcq","question":"Fixture question A?","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],"correct_index":0}}]',
  '[{"locale":"zh-CN","data":{"title":"V29 课程 A","description":"课程内容"}}]',
  '[{"section_id":"section-1","locale":"zh-CN","data":{"title":"章节 A"}}]',
  '[{"lesson_id":"lesson-1","locale":"zh-CN","data":{"title":"课程 A","description_markdown":"课程正文。"}}]'
);
SELECT public.studio_publish_course(
  'ffff2900-2000-4000-8000-000000000002',
  '{"slug":"studio-v29-b","data":{"course_type":"ai_generated","title":"V29 course B","description":"Fixture course","i18n":{"supported_locales":["en","zh-CN"],"primary_content_locale":"en"}}}',
  '[{"id":"section-1","sort_order":0,"data":{"title":"Section B"}}]',
  '[{"id":"lesson-1","section_id":"section-1","sort_order":0,"data":{"title":"Lesson B","lesson_format":"quiz","description_markdown":"Fixture quiz lesson.","quiz_config":{"allow_retry":true,"passing_ratio":0.7}}}]',
  '[{"id":"ffff2900-1000-4000-8000-000000000002-lesson-1-q1","lesson_id":"lesson-1","sort_order":0,"data":{"type":"mcq","question":"Fixture question B?","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],"correct_index":0}}]',
  '[{"locale":"zh-CN","data":{"title":"V29 课程 B","description":"课程内容"}}]',
  '[{"section_id":"section-1","locale":"zh-CN","data":{"title":"章节 B"}}]',
  '[{"lesson_id":"lesson-1","locale":"zh-CN","data":{"title":"课程 B","description_markdown":"课程正文。"}}]'
);
RESET ROLE;
SET CONSTRAINTS ALL IMMEDIATE;

DO $$
DECLARE rejected boolean := false;
BEGIN
  IF (SELECT count(*) FROM public.course_section_questions
      WHERE id IN ('ffff2900-1000-4000-8000-000000000001-lesson-1-q1', 'ffff2900-1000-4000-8000-000000000002-lesson-1-q1')) <> 2 THEN
    RAISE EXCEPTION 'publish did not preserve the two stable question IDs';
  END IF;
  IF EXISTS (
    SELECT id FROM public.course_section_questions
    WHERE id IN ('ffff2900-1000-4000-8000-000000000001-lesson-1-q1', 'ffff2900-1000-4000-8000-000000000002-lesson-1-q1')
    GROUP BY id HAVING count(*) <> 1
  ) THEN RAISE EXCEPTION 'stable question IDs collided across courses'; END IF;
  IF (SELECT count(*) FROM public.course_locales WHERE course_id IN ('ffff2900-1000-4000-8000-000000000001', 'ffff2900-1000-4000-8000-000000000002') AND locale='zh-CN') <> 2
     OR (SELECT count(*) FROM public.course_section_locales WHERE course_id IN ('ffff2900-1000-4000-8000-000000000001', 'ffff2900-1000-4000-8000-000000000002') AND locale='zh-CN') <> 2
     OR (SELECT count(*) FROM public.course_lesson_locales WHERE course_id IN ('ffff2900-1000-4000-8000-000000000001', 'ffff2900-1000-4000-8000-000000000002') AND locale='zh-CN') <> 2 THEN
    RAISE EXCEPTION 'publish did not persist course, section, and lesson locale rows';
  END IF;

  BEGIN
    INSERT INTO public.course_locales(course_id, locale, data)
    VALUES ('ffff2900-1000-4000-8000-000000000001', 'ja', '{"title":"Invalid machine config","owner_type":"external"}');
    RAISE EXCEPTION 'locale row accepted machine-owned owner_type';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'LOCALE_MACHINE_CONFIG_FORBIDDEN%' THEN RAISE; END IF;
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'course locale machine config guard did not reject owner_type'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id='studio-assets' AND public=false AND file_size_limit=52428800
      AND allowed_mime_types @> ARRAY['font/ttf']::text[]
  ) THEN RAISE EXCEPTION 'private studio-assets bucket configuration missing'; END IF;
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname='storage' AND tablename='objects'
        AND policyname IN ('studio_assets_admin_read','studio_assets_admin_insert','studio_assets_admin_update')
        AND 'authenticated' = ANY(roles)) <> 3 THEN
    RAISE EXCEPTION 'studio-assets authenticated read/insert/update policies missing';
  END IF;
END $$;

ROLLBACK;

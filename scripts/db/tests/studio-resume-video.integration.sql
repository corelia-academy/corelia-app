-- Resuming a run copies judged A8 candidates for copied lessons, skips provider failures,
-- creates the lesson_video step, and preserves accepted translations by locale. All rows roll back.
BEGIN;

INSERT INTO public.studio_courses (id, title) VALUES
  ('e8e80000-1000-4000-8000-000000000001', 'Studio resume video fixture source'),
  ('e8e80000-1000-4000-8000-000000000002', 'Studio resume video fixture target');

INSERT INTO public.studio_runs (id, course_id) VALUES
  ('e8e80000-2000-4000-8000-000000000001', 'e8e80000-1000-4000-8000-000000000001'),
  ('e8e80000-2000-4000-8000-000000000002', 'e8e80000-1000-4000-8000-000000000002');

INSERT INTO public.studio_run_steps (run_id, step_key, state) VALUES
  ('e8e80000-2000-4000-8000-000000000001', 'lessons', 'done'),
  ('e8e80000-2000-4000-8000-000000000001', 'lesson_video', 'done'),
  ('e8e80000-2000-4000-8000-000000000001', 'translate', 'done'),
  ('e8e80000-2000-4000-8000-000000000002', 'lessons', 'active'),
  ('e8e80000-2000-4000-8000-000000000002', 'translate', 'active');

INSERT INTO public.studio_generations (
  id, run_id, step_key, lesson_id, locale, attempt, agent_role, kind, provider,
  requested_model_id, model_id, prompt_version, input, status, provider_request_id,
  output, completed_at, failure_kind, error
) VALUES
  ('e8e80000-3000-4000-8000-000000000001', 'e8e80000-2000-4000-8000-000000000001', 'lessons', 'lesson-video', NULL, 0, 'A5', 'text', 'openai', 'fixture-model', 'fixture-model', 'v1', '{}', 'completed', 'lesson-video-draft', '{"description_markdown":"Video lesson"}', now(), NULL, NULL),
  ('e8e80000-3000-4000-8000-000000000002', 'e8e80000-2000-4000-8000-000000000001', 'lessons', 'lesson-fallback', NULL, 0, 'A5', 'text', 'openai', 'fixture-model', 'fixture-model', 'v1', '{}', 'completed', 'lesson-fallback-draft', '{"description_markdown":"Fallback lesson"}', now(), NULL, NULL),
  ('e8e80000-3000-4000-8000-000000000003', 'e8e80000-2000-4000-8000-000000000001', 'lessons', 'lesson-uncopied', NULL, 0, 'A5', 'text', 'openai', 'fixture-model', 'fixture-model', 'v1', '{}', 'completed', 'lesson-uncopied-draft', '{"description_markdown":"Uncopied lesson"}', now(), NULL, NULL),
  ('e8e80000-3000-4000-8000-000000000004', 'e8e80000-2000-4000-8000-000000000001', 'translate', 'lesson-video', 'vi', 0, 'A7', 'text', 'openai', 'fixture-model', 'fixture-model', 'v1', '{}', 'completed', 'lesson-video-translation', '{"title":"Bài học video"}', now(), NULL, NULL),
  ('e8e80000-3000-4000-8000-000000000011', 'e8e80000-2000-4000-8000-000000000001', 'lesson_video', 'lesson-video', NULL, 0, 'A8', 'research', 'google', 'fixture-gemini', 'fixture-gemini', 'v1', '{}', 'completed', 'gemini-candidate-0', '{"accepted":false,"reason":"does not cover outcome","candidate_index":0}', now(), NULL, NULL),
  ('e8e80000-3000-4000-8000-000000000012', 'e8e80000-2000-4000-8000-000000000001', 'lesson_video', 'lesson-video', NULL, 1, 'A8', 'research', 'google', 'fixture-gemini', 'fixture-gemini', 'v1', '{}', 'completed', 'gemini-candidate-1', '{"accepted":true,"segment":{"start_seconds":30,"end_seconds":90},"candidate_index":1}', now(), NULL, NULL),
  ('e8e80000-3000-4000-8000-000000000013', 'e8e80000-2000-4000-8000-000000000001', 'lesson_video', 'lesson-video', NULL, 2, 'A8', 'research', 'google', 'fixture-gemini', NULL, 'v1', '{}', 'failed', NULL, NULL, NULL, 'transport', 'Provider request interrupted'),
  ('e8e80000-3000-4000-8000-000000000014', 'e8e80000-2000-4000-8000-000000000001', 'lesson_video', 'lesson-fallback', NULL, 0, 'A8', 'research', 'google', 'fixture-gemini', NULL, 'v1', '{}', 'failed', NULL, '{"accepted":false,"reason":"no usable candidate"}', NULL, 'rejected', 'No candidate covered the lesson outcome'),
  ('e8e80000-3000-4000-8000-000000000015', 'e8e80000-2000-4000-8000-000000000001', 'lesson_video', 'lesson-uncopied', NULL, 0, 'A8', 'research', 'google', 'fixture-gemini', 'fixture-gemini', 'v1', '{}', 'completed', 'gemini-uncopied-candidate', '{"accepted":true,"segment":{"start_seconds":10,"end_seconds":40},"candidate_index":0}', now(), NULL, NULL);

DO $$
DECLARE copied integer;
BEGIN
  copied := private.studio_copy_generations(
    'e8e80000-2000-4000-8000-000000000002',
    ARRAY[
      'e8e80000-3000-4000-8000-000000000001'::uuid,
      'e8e80000-3000-4000-8000-000000000002'::uuid,
      'e8e80000-3000-4000-8000-000000000004'::uuid
    ]
  );

  IF copied <> 6 THEN RAISE EXCEPTION 'expected 3 selected generations and 3 judged video rows, got %', copied; END IF;
  IF (SELECT count(*) FROM public.studio_run_steps WHERE run_id = 'e8e80000-2000-4000-8000-000000000002' AND step_key = 'lesson_video' AND state = 'active') <> 1 THEN
    RAISE EXCEPTION 'copy did not create the active lesson_video run step';
  END IF;
  IF (SELECT count(*) FROM public.studio_generations WHERE run_id = 'e8e80000-2000-4000-8000-000000000002' AND step_key = 'lesson_video') <> 3 THEN
    RAISE EXCEPTION 'copy did not preserve both judged candidates and the rejected fallback';
  END IF;
  IF EXISTS (SELECT 1 FROM public.studio_generations WHERE run_id = 'e8e80000-2000-4000-8000-000000000002' AND parent_generation_id = 'e8e80000-3000-4000-8000-000000000013') THEN
    RAISE EXCEPTION 'transport failure was copied';
  END IF;
  IF EXISTS (SELECT 1 FROM public.studio_generations WHERE run_id = 'e8e80000-2000-4000-8000-000000000002' AND lesson_id = 'lesson-uncopied') THEN
    RAISE EXCEPTION 'video rows for an unselected lesson were copied';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.studio_generations
    WHERE run_id = 'e8e80000-2000-4000-8000-000000000002' AND step_key = 'lesson_video'
      AND parent_generation_id = 'e8e80000-3000-4000-8000-000000000011'
      AND attempt = 0 AND status = 'completed' AND output->>'accepted' = 'false'
      AND provider_request_id = 'resume:e8e80000-3000-4000-8000-000000000011'
  ) THEN RAISE EXCEPTION 'refused completed A8 candidate or its attempt metadata was not preserved'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.studio_generations
    WHERE run_id = 'e8e80000-2000-4000-8000-000000000002' AND step_key = 'lesson_video'
      AND parent_generation_id = 'e8e80000-3000-4000-8000-000000000012'
      AND attempt = 1 AND status = 'completed' AND output->>'accepted' = 'true'
      AND provider_request_id = 'resume:e8e80000-3000-4000-8000-000000000012'
  ) THEN RAISE EXCEPTION 'accepted A8 output or attempt metadata was not preserved'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.studio_generations
    WHERE run_id = 'e8e80000-2000-4000-8000-000000000002' AND step_key = 'lesson_video'
      AND parent_generation_id = 'e8e80000-3000-4000-8000-000000000014'
      AND attempt = 0 AND status = 'failed' AND failure_kind = 'rejected'
      AND error = 'No candidate covered the lesson outcome' AND provider_request_id IS NULL
  ) THEN RAISE EXCEPTION 'rejected fallback metadata was not preserved'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.studio_generations
    WHERE run_id = 'e8e80000-2000-4000-8000-000000000002' AND step_key = 'translate'
      AND lesson_id = 'lesson-video' AND locale = 'vi' AND parent_generation_id = 'e8e80000-3000-4000-8000-000000000004'
  ) THEN RAISE EXCEPTION 'accepted translation or its locale was not copied'; END IF;
END $$;

ROLLBACK;

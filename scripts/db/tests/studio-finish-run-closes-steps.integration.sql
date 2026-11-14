-- studio_finish_run leaves no active step behind: draft_failed -> pending, published -> done, a failed step stays failed.
-- Rolled back.
BEGIN;

INSERT INTO public.studio_courses(id, title, status, research_status) VALUES
 ('ffff7777-2222-4000-8000-000000000001','Close steps failed course','generating','evidence_ok'),
 ('ffff7777-2222-4000-8000-000000000002','Close steps published course','generating','evidence_ok');
INSERT INTO public.studio_runs(id, course_id, status) VALUES
 ('ffff7777-3333-4000-8000-000000000001','ffff7777-2222-4000-8000-000000000001','running'),
 ('ffff7777-3333-4000-8000-000000000002','ffff7777-2222-4000-8000-000000000002','running');
INSERT INTO public.studio_run_steps(run_id, step_key, state) VALUES
 ('ffff7777-3333-4000-8000-000000000001','brief','done'),
 ('ffff7777-3333-4000-8000-000000000001','lessons','failed'),
 ('ffff7777-3333-4000-8000-000000000001','lesson_review','active'),
 ('ffff7777-3333-4000-8000-000000000001','publish','pending'),
 ('ffff7777-3333-4000-8000-000000000002','brief','done'),
 ('ffff7777-3333-4000-8000-000000000002','publish','active');

SET LOCAL ROLE service_role;
DO $$
DECLARE
  states jsonb;
BEGIN
  IF NOT public.studio_finish_run('ffff7777-3333-4000-8000-000000000001', 'draft_failed', 'lesson failed') THEN
    RAISE EXCEPTION 'expected the failed run to finish';
  END IF;
  SELECT jsonb_object_agg(step_key, state) INTO states FROM public.studio_run_steps WHERE run_id = 'ffff7777-3333-4000-8000-000000000001';
  IF states <> '{"brief":"done","lessons":"failed","lesson_review":"pending","publish":"pending"}'::jsonb THEN
    RAISE EXCEPTION 'unexpected states after draft_failed: %', states;
  END IF;

  IF NOT public.studio_finish_run('ffff7777-3333-4000-8000-000000000002', 'published', '') THEN
    RAISE EXCEPTION 'expected the published run to finish';
  END IF;
  SELECT jsonb_object_agg(step_key, state) INTO states FROM public.studio_run_steps WHERE run_id = 'ffff7777-3333-4000-8000-000000000002';
  IF states <> '{"brief":"done","publish":"done"}'::jsonb THEN
    RAISE EXCEPTION 'unexpected states after published: %', states;
  END IF;

  -- A replay of a finished run changes nothing.
  IF public.studio_finish_run('ffff7777-3333-4000-8000-000000000001', 'draft_failed', 'again') THEN
    RAISE EXCEPTION 'a finished run must not finish twice';
  END IF;
END;
$$;

ROLLBACK;

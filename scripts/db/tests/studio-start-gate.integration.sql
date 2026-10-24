-- Studio start gate D6: evidence and latest production queue are checked atomically with run creation.
-- Includes a rank-2 Solana fixture, replay after exclusion, no-ranking, and resume behavior. All rolled back.
BEGIN;

INSERT INTO public.studio_scoring_weights(version, weights) VALUES (1, jsonb_build_object(
  'trend', 0.25, 'demand', 0.25, 'corelia_fit', 0.20,
  'catalog_gap', 0.15, 'ai_feasibility', 0.10, 'maintainability', 0.05))
ON CONFLICT (version) DO NOTHING;

INSERT INTO public.studio_courses(id, title, status, research_status) VALUES
 ('eeee7777-2222-4000-8000-000000000001','D6 idea course','idea','idea'),
 ('eeee7777-2222-4000-8000-000000000002','D6 no ranking course','idea','evidence_ok'),
 ('eeee7777-2222-4000-8000-000000000003','D6 no path course','idea','evidence_ok'),
 ('eeee7777-2222-4000-8000-000000000004','D6 non-startable course','published','evidence_ok'),
 ('eeee7777-2222-4000-8000-000000000005','D6 prerequisite course','idea','evidence_ok'),
 ('eeee7777-2222-4000-8000-000000000006','D6 Solana rank two course','idea','evidence_ok');

INSERT INTO public.studio_paths(id, group_kind, slug, title) VALUES
 ('eeee7777-1111-4000-8000-000000000001','ecosystem','d6-solana','D6 Solana');
INSERT INTO public.studio_course_paths(course_id, path_id) VALUES
 ('eeee7777-2222-4000-8000-000000000001','eeee7777-1111-4000-8000-000000000001'),
 ('eeee7777-2222-4000-8000-000000000002','eeee7777-1111-4000-8000-000000000001'),
 ('eeee7777-2222-4000-8000-000000000004','eeee7777-1111-4000-8000-000000000001'),
 ('eeee7777-2222-4000-8000-000000000005','eeee7777-1111-4000-8000-000000000001'),
 ('eeee7777-2222-4000-8000-000000000006','eeee7777-1111-4000-8000-000000000001');

INSERT INTO public.studio_catalog_jobs(id, course_id, trigger, status, finished_at) VALUES
 ('eeee7777-4444-4000-8000-000000000001','eeee7777-2222-4000-8000-000000000005','manual','evidence_ok',now()),
 ('eeee7777-4444-4000-8000-000000000002','eeee7777-2222-4000-8000-000000000006','manual','evidence_ok',now());

SET LOCAL ROLE service_role;
DO $$
DECLARE
  result jsonb;
  got_message text;
  got_detail text;
  v_ranking_id uuid := 'eeee7777-5555-4000-8000-000000000001';
  expected_job uuid := 'eeee7777-4444-4000-8000-000000000002';
  new_run uuid := 'eeee7777-3333-4000-8000-000000000006';
  old_run uuid := 'eeee7777-3333-4000-8000-000000000005';
BEGIN
  -- No production pass: rank detail is not_ranked.
  BEGIN
    PERFORM public.studio_start_run(
      'eeee7777-2222-4000-8000-000000000002', 'eeee7777-3333-4000-8000-000000000002', NULL, NULL);
    RAISE EXCEPTION 'expected course_not_in_queue with not_ranked when no production pass exists';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS got_message = MESSAGE_TEXT, got_detail = PG_EXCEPTION_DETAIL;
    IF got_message <> 'course_not_in_queue' OR got_detail <> 'not_ranked' THEN RAISE; END IF;
  END;

  -- Research status is checked before queue membership.
  BEGIN
    PERFORM public.studio_start_run(
      'eeee7777-2222-4000-8000-000000000001', 'eeee7777-3333-4000-8000-000000000001', NULL, NULL);
    RAISE EXCEPTION 'expected course_not_researched';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS got_message = MESSAGE_TEXT;
    IF got_message <> 'course_not_researched' THEN RAISE; END IF;
  END;

  -- Existing guards keep their order and remain in force.
  BEGIN
    PERFORM public.studio_start_run(
      'eeee7777-2222-4000-8000-000000000004', 'eeee7777-3333-4000-8000-000000000004', NULL, NULL);
    RAISE EXCEPTION 'expected course_not_startable';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS got_message = MESSAGE_TEXT;
    IF got_message <> 'course_not_startable' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.studio_start_run(
      'eeee7777-2222-4000-8000-000000000003', 'eeee7777-3333-4000-8000-000000000003', NULL, NULL);
    RAISE EXCEPTION 'expected course_has_no_path';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS got_message = MESSAGE_TEXT;
    IF got_message <> 'course_has_no_path' THEN RAISE; END IF;
  END;

  INSERT INTO public.studio_catalog_rankings(id, group_kind, weights_version, algorithm_version)
  VALUES (v_ranking_id, NULL, 1, 'd6-test@v1');
  INSERT INTO public.studio_catalog_scores(ranking_id, course_id, job_id, total, confidence, rank)
  VALUES
   (v_ranking_id,'eeee7777-2222-4000-8000-000000000005','eeee7777-4444-4000-8000-000000000001',90,'high',1),
   (v_ranking_id,'eeee7777-2222-4000-8000-000000000006',expected_job,80,'medium',2);
  INSERT INTO public.studio_catalog_scores(ranking_id, course_id, excluded_reason, placement_for)
  VALUES (v_ranking_id,'eeee7777-2222-4000-8000-000000000002','blocked_by_prerequisite','eeee7777-2222-4000-8000-000000000005');

  -- An evidence_ok course excluded by its prerequisite is rejected with the persisted reason.
  BEGIN
    PERFORM public.studio_start_run(
      'eeee7777-2222-4000-8000-000000000002', 'eeee7777-3333-4000-8000-000000000022', NULL, NULL);
    RAISE EXCEPTION 'expected course_not_in_queue with blocked_by_prerequisite';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS got_message = MESSAGE_TEXT, got_detail = PG_EXCEPTION_DETAIL;
    IF got_message <> 'course_not_in_queue' OR got_detail <> 'blocked_by_prerequisite' THEN RAISE; END IF;
  END;

  -- The user may choose any queued course: this Solana fixture is rank 2, not rank 1.
  result := public.studio_start_run(
    'eeee7777-2222-4000-8000-000000000006', new_run, NULL, NULL);
  IF result->>'created' <> 'true' THEN RAISE EXCEPTION 'ranked course should create a run: %', result; END IF;
  IF (SELECT catalog_job_id FROM public.studio_runs WHERE id = new_run) <> expected_job THEN
    RAISE EXCEPTION 'run must retain its production score A1 job';
  END IF;

  -- Once the course is out of the current queue, an idempotent replay still returns created=false.
  UPDATE public.studio_catalog_scores AS score
  SET rank = NULL, excluded_reason = 'prerequisite_cycle'
  WHERE score.ranking_id = v_ranking_id AND score.course_id = 'eeee7777-2222-4000-8000-000000000006';
  UPDATE public.studio_courses SET research_status = 'needs_more_sources'
  WHERE id = 'eeee7777-2222-4000-8000-000000000006';
  result := public.studio_start_run(
    'eeee7777-2222-4000-8000-000000000006', new_run, NULL, NULL);
  IF result->>'created' <> 'false' THEN RAISE EXCEPTION 'replay must return created=false: %', result; END IF;

  -- Resume still creates through the same gate and preserves the existing skip behavior.
  INSERT INTO public.studio_runs(id, course_id, status, hold_reason, finished_at, started_at)
  VALUES (old_run,'eeee7777-2222-4000-8000-000000000005','draft_failed','fixture failure',now(),now() - interval '1 day');
  result := public.studio_start_run(
    'eeee7777-2222-4000-8000-000000000005', 'eeee7777-3333-4000-8000-000000000007', NULL, old_run);
  IF result->>'created' <> 'true' OR result->>'resume_skipped' <> 'nothing_done' THEN
    RAISE EXCEPTION 'resume semantics changed: %', result;
  END IF;
END $$;
RESET ROLE;

ROLLBACK;

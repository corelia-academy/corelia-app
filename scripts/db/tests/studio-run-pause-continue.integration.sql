-- Pause/continue RPC contract. Run only on a disposable schema-only clone.
-- The fixture is randomized and the whole test rolls back.
BEGIN;

CREATE TEMP TABLE studio_pause_fixture_ids AS
SELECT gen_random_uuid() AS course_id, gen_random_uuid() AS run_id;

INSERT INTO public.studio_courses (id, title, status)
SELECT course_id, 'Studio pause fixture ' || course_id::text, 'idea'
FROM studio_pause_fixture_ids;

INSERT INTO public.studio_runs (id, course_id, status, started_at)
SELECT run_id, course_id, 'running', now()
FROM studio_pause_fixture_ids;

INSERT INTO public.studio_run_steps (run_id, step_key, state)
SELECT run_id, 'brief', 'active'
FROM studio_pause_fixture_ids;

DO $$
DECLARE
  v_course_id uuid;
  v_run_id uuid;
  v_result jsonb;
  v_paused_at timestamptz;
  v_status text;
  v_event_count integer;
  v_pause_count integer;
  v_resume_count integer;
  v_message text;
  v_constraint_count integer;
  v_unique_running_index boolean;
  v_second_run_id uuid := gen_random_uuid();
BEGIN
  SELECT course_id, run_id INTO v_course_id, v_run_id FROM pg_temp.studio_pause_fixture_ids;

  IF NOT has_function_privilege('service_role', 'public.studio_pause_run(uuid)'::regprocedure, 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.studio_continue_run(uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role cannot execute pause/continue RPC';
  END IF;
  IF has_function_privilege('anon', 'public.studio_pause_run(uuid)'::regprocedure, 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.studio_pause_run(uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'pause RPC is executable by a browser role';
  END IF;

  v_result := public.studio_pause_run(v_run_id);
  IF v_result ->> 'changed' <> 'true' THEN RAISE EXCEPTION 'first pause did not change state'; END IF;
  SELECT r.paused_at, r.status INTO v_paused_at, v_status FROM public.studio_runs r WHERE r.id = v_run_id;
  IF v_paused_at IS NULL OR v_status <> 'running' THEN RAISE EXCEPTION 'pause changed the run status or failed to set paused_at'; END IF;
  IF (SELECT status FROM public.studio_courses WHERE id = v_course_id) <> 'idea' THEN
    RAISE EXCEPTION 'pause changed the course status';
  END IF;
  SELECT count(*) INTO v_event_count FROM public.studio_run_events WHERE run_id = v_run_id;
  IF v_event_count <> 1 THEN RAISE EXCEPTION 'first pause wrote % events, expected one', v_event_count; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.studio_run_events e
    WHERE e.run_id = v_run_id AND e.kind = 'progress'
      AND e.payload ? 'paused_at' AND NOT (e.payload ? 'resumed_at')
      AND e.message !~ '(UTC|[0-9]{4}-[0-9]{2}-[0-9]{2})'
  ) THEN RAISE EXCEPTION 'pause event payload or relative message is invalid'; END IF;

  v_result := public.studio_pause_run(v_run_id);
  IF v_result ->> 'changed' <> 'false' THEN RAISE EXCEPTION 'repeated pause was not idempotent'; END IF;
  SELECT count(*) INTO v_event_count FROM public.studio_run_events WHERE run_id = v_run_id;
  IF v_event_count <> 1 THEN RAISE EXCEPTION 'repeated pause added an event'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'studio_runs_one_running_per_course'
      AND i.indisunique AND i.indpred IS NOT NULL
  ) INTO v_unique_running_index;
  IF NOT v_unique_running_index THEN RAISE EXCEPTION 'one-running-run partial unique index changed'; END IF;

  BEGIN
    INSERT INTO public.studio_runs (id, course_id, status, started_at)
    VALUES (v_second_run_id, v_course_id, 'running', now());
    RAISE EXCEPTION 'a second running run was accepted while the first was paused';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  v_result := public.studio_continue_run(v_run_id);
  IF v_result ->> 'changed' <> 'true' OR v_result -> 'paused_at' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'continue did not clear paused_at';
  END IF;
  SELECT r.paused_at, r.status INTO v_paused_at, v_status FROM public.studio_runs r WHERE r.id = v_run_id;
  IF v_paused_at IS NOT NULL OR v_status <> 'running' THEN RAISE EXCEPTION 'continue changed the run status'; END IF;
  SELECT count(*) FILTER (WHERE e.payload ? 'paused_at'),
         count(*) FILTER (WHERE e.payload ? 'resumed_at' AND e.payload ? 'paused_seconds'),
         count(*)
    INTO v_pause_count, v_resume_count, v_event_count
  FROM public.studio_run_events e WHERE e.run_id = v_run_id AND e.kind = 'progress';
  IF v_pause_count <> 1 OR v_resume_count <> 1 OR v_event_count <> 2 THEN
    RAISE EXCEPTION 'continue must add exactly one relative resume event';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.studio_run_events e WHERE e.run_id = v_run_id
      AND e.message ~ '(UTC|[0-9]{4}-[0-9]{2}-[0-9]{2})'
  ) THEN RAISE EXCEPTION 'pause/continue event contains an absolute UTC timestamp'; END IF;

  v_result := public.studio_continue_run(v_run_id);
  IF v_result ->> 'changed' <> 'false' THEN RAISE EXCEPTION 'repeated continue was not idempotent'; END IF;
  SELECT count(*) INTO v_event_count FROM public.studio_run_events WHERE run_id = v_run_id;
  IF v_event_count <> 2 THEN RAISE EXCEPTION 'repeated continue added an event'; END IF;

  PERFORM public.studio_pause_run(v_run_id);
  IF NOT private.studio_finish_run(v_run_id, 'draft_failed', 'Fixture ended while paused') THEN
    RAISE EXCEPTION 'finish_run did not finish the paused fixture';
  END IF;
  SELECT r.paused_at, r.status INTO v_paused_at, v_status FROM public.studio_runs r WHERE r.id = v_run_id;
  IF v_paused_at IS NOT NULL OR v_status <> 'draft_failed' THEN
    RAISE EXCEPTION 'terminal run retained its paused marker';
  END IF;

  FOREACH v_message IN ARRAY ARRAY['pause', 'continue'] LOOP
    BEGIN
      IF v_message = 'pause' THEN
        PERFORM public.studio_pause_run(v_run_id);
      ELSE
        PERFORM public.studio_continue_run(v_run_id);
      END IF;
      RAISE EXCEPTION 'terminal run accepted %', v_message;
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
      GET STACKED DIAGNOSTICS v_status = MESSAGE_TEXT;
      IF v_status <> 'run_not_running' THEN RAISE; END IF;
    END;
  END LOOP;

  SELECT count(*) INTO v_constraint_count
  FROM pg_catalog.pg_constraint c
  WHERE c.conrelid = 'public.studio_runs'::regclass
    AND c.conname IN ('studio_runs_finished_matches_status', 'studio_runs_paused_only_while_running')
    AND c.contype = 'c' AND c.convalidated;
  IF v_constraint_count <> 2 THEN RAISE EXCEPTION 'run lifecycle constraints were removed or invalid'; END IF;
END;
$$;

ROLLBACK;

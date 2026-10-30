-- Studio catalog ranking pass: studio_save_ranking (service role only, atomic, shared computed_at) and
-- the two constraints of studio_catalog_scores it relies on (placement_for for blocked courses, known
-- excluded_reason). Each new constraint is also dropped inside the transaction to show that its probe
-- is refused by that constraint and by nothing else. All rolled back.
BEGIN;

INSERT INTO public.studio_courses(id,title) VALUES
 ('eeee8888-2222-4000-8000-000000000001','Ranking course A'),
 ('eeee8888-2222-4000-8000-000000000002','Ranking course B'),
 ('eeee8888-2222-4000-8000-000000000003','Ranking course C'),
 ('eeee8888-2222-4000-8000-000000000004','Ranking course D'),
 ('eeee8888-2222-4000-8000-000000000005','Manual-order blank-reason probe');
INSERT INTO public.studio_catalog_jobs(id,course_id,trigger,status,finished_at) VALUES
 ('eeee8888-4444-4000-8000-000000000001','eeee8888-2222-4000-8000-000000000001','manual','evidence_ok',now());

-- A pass through the service role: three group rankings (one empty) and the production order, where
-- D is pulled up for A, A is placed by hand, B is blocked by C and C was never researched.
SET LOCAL ROLE service_role;
DO $$
DECLARE
  r jsonb;
  pass jsonb := $j$[
    {"group_kind":"skill","scores":[
      {"course_id":"eeee8888-2222-4000-8000-000000000001","job_id":"eeee8888-4444-4000-8000-000000000001","components":{"trend":{"level":4,"weight_used":0.25,"confidence":"medium"},"maintainability":{"missing":true}},"total":75.00,"confidence":"medium","rank":1},
      {"course_id":"eeee8888-2222-4000-8000-000000000003","excluded_reason":"not_researched"}]},
    {"group_kind":"role","scores":[]},
    {"group_kind":"ecosystem","scores":[]},
    {"group_kind":null,"scores":[
      {"course_id":"eeee8888-2222-4000-8000-000000000004","job_id":"eeee8888-4444-4000-8000-000000000001","components":{},"total":50.00,"confidence":"low","rank":1,"placement_reason":"prerequisite_of","placement_for":"eeee8888-2222-4000-8000-000000000001"},
      {"course_id":"eeee8888-2222-4000-8000-000000000001","job_id":"eeee8888-4444-4000-8000-000000000001","components":{},"total":75.00,"confidence":"medium","rank":2,"placement_reason":"manual"},
      {"course_id":"eeee8888-2222-4000-8000-000000000003","excluded_reason":"not_researched"},
      {"course_id":"eeee8888-2222-4000-8000-000000000002","excluded_reason":"blocked_by_prerequisite","placement_for":"eeee8888-2222-4000-8000-000000000003"}]}
  ]$j$::jsonb;
  n_before integer;
BEGIN
  r := public.studio_save_ranking(1, 'rank@v1', '2026-10-23 09:00:00.123456+00', pass);
  IF jsonb_array_length(r->'ranking_ids') <> 4 THEN RAISE EXCEPTION 'pass should create 4 rankings: %', r; END IF;
  IF (SELECT count(DISTINCT computed_at) FROM public.studio_catalog_rankings WHERE id::text IN (SELECT jsonb_array_elements_text(r->'ranking_ids'))) <> 1
     OR (SELECT computed_at FROM public.studio_catalog_rankings WHERE id::text = r->'ranking_ids'->>0) <> (r->>'computed_at')::timestamptz THEN
    RAISE EXCEPTION 'rankings of one pass must share computed_at';
  END IF;
  IF (SELECT count(DISTINCT source_as_of) FROM public.studio_catalog_rankings WHERE id::text IN (SELECT jsonb_array_elements_text(r->'ranking_ids'))) <> 1
     OR (SELECT source_as_of FROM public.studio_catalog_rankings WHERE id::text = r->'ranking_ids'->>0) <> '2026-10-23 09:00:00.123456+00'::timestamptz THEN
    RAISE EXCEPTION 'rankings of one pass must share source_as_of';
  END IF;
  IF (SELECT count(*) FROM public.studio_catalog_scores s WHERE s.ranking_id::text IN (SELECT jsonb_array_elements_text(r->'ranking_ids'))) <> 6 THEN
    RAISE EXCEPTION 'pass should hold 6 score rows';
  END IF;
  IF (SELECT placement_for FROM public.studio_catalog_scores s JOIN public.studio_catalog_rankings k ON k.id = s.ranking_id
      WHERE k.group_kind IS NULL AND s.course_id = 'eeee8888-2222-4000-8000-000000000002') <> 'eeee8888-2222-4000-8000-000000000003' THEN
    RAISE EXCEPTION 'blocked course lost its placement_for';
  END IF;
  IF (SELECT components FROM public.studio_catalog_scores s JOIN public.studio_catalog_rankings k ON k.id = s.ranking_id
      WHERE k.group_kind = 'skill' AND s.course_id = 'eeee8888-2222-4000-8000-000000000003') <> '{}'::jsonb THEN
    RAISE EXCEPTION 'absent components should be stored as {}';
  END IF;

  -- Invalid passes are refused as a whole.
  FOREACH pass IN ARRAY ARRAY[
    '[{"group_kind":"skill","scores":[]}]'::jsonb,
    '[{"group_kind":null,"scores":[]},{"group_kind":null,"scores":[]}]'::jsonb,
    '[{"group_kind":null,"scores":[]},{"group_kind":"skill","scores":[]},{"group_kind":"skill","scores":[]}]'::jsonb,
    '[]'::jsonb,
    '{"group_kind":null}'::jsonb,
    -- the score list must be under "scores" and be an array
    '[{"group_kind":null}]'::jsonb,
    '[{"group_kind":null,"rows":[]}]'::jsonb,
    '[{"group_kind":null,"scores":{}}]'::jsonb,
    '[{"group_kind":null,"scores":null}]'::jsonb,
    '[{"group_kind":null,"scores":[]},{"group_kind":"skill"}]'::jsonb,
    '[1]'::jsonb
  ] LOOP
    BEGIN
      PERFORM public.studio_save_ranking(1, 'rank@v1', '2026-10-23 09:00:00.123456+00', pass);
      RAISE EXCEPTION 'invalid pass was accepted: %', pass;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'invalid_ranking_pass' THEN RAISE; END IF;
    END;
  END LOOP;

  -- An explicit empty list is a valid ranking, and every ranking keeps the rows it was sent with.
  r := public.studio_save_ranking(1, 'rank@v1', NULL, '[{"group_kind":null,"scores":[]},{"group_kind":"role","scores":[{"course_id":"eeee8888-2222-4000-8000-000000000001","job_id":"eeee8888-4444-4000-8000-000000000001","total":10,"confidence":"low","rank":1}]}]'::jsonb);
  IF (SELECT count(*) FROM public.studio_catalog_scores s WHERE s.ranking_id::text IN (SELECT jsonb_array_elements_text(r->'ranking_ids'))) <> 1 THEN
    RAISE EXCEPTION 'sent rows were not all saved';
  END IF;

  -- A row refused by a constraint in a later ranking leaves nothing of the pass behind.
  SELECT count(*) INTO n_before FROM public.studio_catalog_rankings;
  BEGIN
    PERFORM public.studio_save_ranking(1, 'rank@v1', NULL, $j$[
      {"group_kind":"skill","scores":[{"course_id":"eeee8888-2222-4000-8000-000000000001","job_id":"eeee8888-4444-4000-8000-000000000001","total":60,"confidence":"low","rank":1}]},
      {"group_kind":null,"scores":[{"course_id":"eeee8888-2222-4000-8000-000000000003","excluded_reason":"duplicate"}]}]$j$::jsonb);
    RAISE EXCEPTION 'pass with an unknown excluded_reason was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF (SELECT count(*) FROM public.studio_catalog_rankings) <> n_before THEN
    RAISE EXCEPTION 'a refused pass left rankings behind';
  END IF;
  BEGIN
    PERFORM public.studio_save_ranking(99, 'rank@v1', NULL, '[{"group_kind":null,"scores":[]}]'::jsonb);
    RAISE EXCEPTION 'pass with an unknown weights version was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;
RESET ROLE;

-- Nobody but the service role calls it.
DO $$
DECLARE
  actor text;
BEGIN
  FOREACH actor IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    EXECUTE format('SET LOCAL ROLE %I', actor);
    IF has_function_privilege(current_user, 'public.studio_save_ranking(integer,text,timestamptz,jsonb)', 'EXECUTE') THEN
      RAISE EXCEPTION '% can execute studio_save_ranking', actor;
    END IF;
    IF has_function_privilege(current_user, 'private.studio_save_ranking(integer,text,timestamptz,jsonb)', 'EXECUTE') THEN
      RAISE EXCEPTION '% can execute private.studio_save_ranking', actor;
    END IF;
    RESET ROLE;
  END LOOP;
  IF NOT has_function_privilege('service_role', 'public.studio_save_ranking(integer,text,timestamptz,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'private.studio_save_ranking(integer,text,timestamptz,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role cannot execute studio_save_ranking';
  END IF;
END $$;

-- Constraint probes (as postgres) on the rows of the pass above, then the same probes with the
-- constraint dropped: each must be accepted, so each constraint is what refuses it.
DO $$
DECLARE
  prod uuid := (SELECT id FROM public.studio_catalog_rankings WHERE group_kind IS NULL ORDER BY computed_at DESC LIMIT 1);
  s text;
  code text;
  placement_probes text[];
  reason_probes text[];
BEGIN
  placement_probes := ARRAY[
    -- blocked without the course that blocks it
    format($q$UPDATE public.studio_catalog_scores SET placement_for = NULL WHERE ranking_id = %L AND course_id = 'eeee8888-2222-4000-8000-000000000002'$q$, prod),
    -- another exclusion reason with a placement_for
    format($q$UPDATE public.studio_catalog_scores SET placement_for = 'eeee8888-2222-4000-8000-000000000001' WHERE ranking_id = %L AND course_id = 'eeee8888-2222-4000-8000-000000000003'$q$, prod),
    -- ranked row with a placement_for and no reason (a NULL comparison must not satisfy the check)
    format($q$UPDATE public.studio_catalog_scores SET placement_reason = NULL, placement_for = 'eeee8888-2222-4000-8000-000000000004' WHERE ranking_id = %L AND course_id = 'eeee8888-2222-4000-8000-000000000001'$q$, prod),
    -- prerequisite_of without the dependent course
    format($q$UPDATE public.studio_catalog_scores SET placement_for = NULL WHERE ranking_id = %L AND course_id = 'eeee8888-2222-4000-8000-000000000004'$q$, prod)
  ];
  reason_probes := ARRAY[
    format($q$UPDATE public.studio_catalog_scores SET excluded_reason = 'unknown_reason' WHERE ranking_id = %L AND course_id = 'eeee8888-2222-4000-8000-000000000003'$q$, prod),
    format($q$UPDATE public.studio_catalog_scores SET excluded_reason = 'Not_Researched' WHERE ranking_id = %L AND course_id = 'eeee8888-2222-4000-8000-000000000003'$q$, prod)
  ];

  -- Every known code is accepted on an unranked row.
  FOREACH s IN ARRAY ARRAY['not_researched', 'missing_core_criteria', 'no_path', 'prerequisite_cycle'] LOOP
    EXECUTE format($q$UPDATE public.studio_catalog_scores SET excluded_reason = %L WHERE ranking_id = %L AND course_id = 'eeee8888-2222-4000-8000-000000000003'$q$, s, prod);
  END LOOP;
  UPDATE public.studio_catalog_scores SET excluded_reason = 'not_researched' WHERE ranking_id = prod AND course_id = 'eeee8888-2222-4000-8000-000000000003';

  FOREACH s IN ARRAY placement_probes || reason_probes LOOP
    code := NULL;
    BEGIN EXECUTE s; EXCEPTION WHEN check_violation THEN code := 'check'; END;
    IF code IS NULL THEN RAISE EXCEPTION 'Constraint probe was accepted: %', s; END IF;
  END LOOP;

  ALTER TABLE public.studio_catalog_scores DROP CONSTRAINT studio_catalog_scores_placement_for_iff_prerequisite;
  FOREACH s IN ARRAY placement_probes LOOP
    BEGIN EXECUTE s; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'probe is refused by something else than placement_for_iff_prerequisite: % (%)', s, SQLERRM; END;
  END LOOP;

  ALTER TABLE public.studio_catalog_scores DROP CONSTRAINT studio_catalog_scores_excluded_reason_known;
  FOREACH s IN ARRAY reason_probes LOOP
    BEGIN EXECUTE s; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'probe is refused by something else than excluded_reason_known: % (%)', s, SQLERRM; END;
  END LOOP;
END $$;

-- Manual-order actions: NULL/blank reasons, clear snapshots, conflict guards and restore.
SET LOCAL ROLE service_role;
DO $$
DECLARE
  id_a uuid;
  id_b uuid;
  id_c uuid;
  id_d uuid;
  snapshot jsonb;
  returned jsonb;
  code text;
  message text;
  active_count integer;
  total_count integer;
BEGIN
  id_a := public.studio_set_manual_order('eeee8888-2222-4000-8000-000000000001', 11, NULL, NULL);
  id_b := public.studio_set_manual_order('eeee8888-2222-4000-8000-000000000002', 22, '   ', NULL);
  id_c := public.studio_set_manual_order('eeee8888-2222-4000-8000-000000000003', 33, 'reviewed reason C', NULL);
  id_d := public.studio_set_manual_order('eeee8888-2222-4000-8000-000000000004', 44, 'reviewed reason D', NULL);

  IF (SELECT reason FROM public.studio_catalog_manual_orders WHERE id = id_a) IS NOT NULL
     OR (SELECT reason FROM public.studio_catalog_manual_orders WHERE id = id_b) IS NOT NULL THEN
    RAISE EXCEPTION 'NULL and whitespace reasons must be stored as NULL';
  END IF;

  code := NULL;
  BEGIN
    INSERT INTO public.studio_catalog_manual_orders(course_id, position, reason)
    VALUES ('eeee8888-2222-4000-8000-000000000005', 55, '   ');
  EXCEPTION WHEN check_violation THEN code := 'check';
  END;
  IF code IS NULL THEN RAISE EXCEPTION 'direct whitespace reason bypassed the table check'; END IF;

  snapshot := jsonb_build_array(
    jsonb_build_object('course_id', 'eeee8888-2222-4000-8000-000000000001', 'position', 11, 'reason', NULL),
    jsonb_build_object('course_id', 'eeee8888-2222-4000-8000-000000000002', 'position', 22, 'reason', NULL),
    jsonb_build_object('course_id', 'eeee8888-2222-4000-8000-000000000003', 'position', 33, 'reason', 'reviewed reason C'),
    jsonb_build_object('course_id', 'eeee8888-2222-4000-8000-000000000004', 'position', 44, 'reason', 'reviewed reason D')
  );
  BEGIN
    PERFORM public.studio_clear_manual_orders(snapshot || '[{"course_id":"eeee8888-2222-4000-8000-000000000005","position":55,"reason":null}]'::jsonb);
    RAISE EXCEPTION 'expected manual_order_conflict after a mismatched clear snapshot';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS message = MESSAGE_TEXT;
    IF message <> 'manual_order_conflict' THEN RAISE; END IF;
  END;
  SELECT count(*) INTO active_count FROM public.studio_catalog_manual_orders WHERE status = 'active';
  IF active_count <> 4 THEN RAISE EXCEPTION 'mismatched clear snapshot changed the active rows'; END IF;

  BEGIN
    PERFORM public.studio_restore_manual_orders(snapshot, NULL);
    RAISE EXCEPTION 'restore unexpectedly succeeded while active rows existed';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS message = MESSAGE_TEXT;
    IF message <> 'manual_order_conflict' THEN RAISE; END IF;
  END;

  returned := public.studio_clear_manual_orders(snapshot);
  IF returned IS DISTINCT FROM snapshot THEN RAISE EXCEPTION 'clear returned a different snapshot: %', returned; END IF;
  SELECT count(*) INTO active_count FROM public.studio_catalog_manual_orders WHERE status = 'active';
  IF active_count <> 0 THEN RAISE EXCEPTION 'clear left active manual orders'; END IF;
  IF (SELECT count(*) FROM public.studio_catalog_manual_orders WHERE status = 'superseded' AND ended_at IS NOT NULL) <> 4 THEN
    RAISE EXCEPTION 'clear did not close each active manual order';
  END IF;

  returned := public.studio_restore_manual_orders(snapshot, NULL);
  IF returned IS DISTINCT FROM snapshot THEN RAISE EXCEPTION 'restore returned a different snapshot: %', returned; END IF;
  SELECT count(*) INTO active_count FROM public.studio_catalog_manual_orders WHERE status = 'active';
  SELECT count(*) INTO total_count FROM public.studio_catalog_manual_orders;
  IF active_count <> 4 OR total_count <> 8 THEN RAISE EXCEPTION 'restore did not create a new active audit set'; END IF;
  IF (SELECT count(*) FROM public.studio_catalog_manual_orders WHERE status = 'active' AND reason IS NULL) <> 2 THEN
    RAISE EXCEPTION 'restore did not retain NULL reasons';
  END IF;
END $$;
RESET ROLE;

ROLLBACK;

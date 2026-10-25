-- Studio catalog research contract: admin read-only, service role writes, job lifecycle, generation
-- owner, weights and scores constraints, research_status server-owned. All rolled back.
-- Actors: 0 anon | 1 student | 2 support_staff | 3 admin
BEGIN;

INSERT INTO auth.users(id,email,instance_id,aud,role,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change)
SELECT ('dddd7777-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'studio-catalog-'||n||'@corelia.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated',now(),'','','','' FROM generate_series(1,3) n;

UPDATE public.profiles SET role = CASE right(id::text,1) WHEN '1' THEN 'student' WHEN '2' THEN 'support_staff' ELSE 'admin' END
WHERE id::text LIKE 'dddd7777%';

INSERT INTO public.studio_courses(id,title) VALUES
 ('dddd7777-2222-4000-8000-000000000001','Catalog course A'),
 ('dddd7777-2222-4000-8000-000000000002','Catalog course B');
INSERT INTO public.studio_runs(id,course_id) VALUES('dddd7777-3333-4000-8000-000000000001','dddd7777-2222-4000-8000-000000000002');
INSERT INTO public.studio_run_steps(run_id,step_key) VALUES('dddd7777-3333-4000-8000-000000000001','research');

-- Job lifecycle through the service role.
SET LOCAL ROLE service_role;
DO $$
DECLARE
  r jsonb;
  ok boolean;
BEGIN
  r := public.studio_start_catalog_job('dddd7777-2222-4000-8000-000000000001','dddd7777-4444-4000-8000-000000000001','manual','dddd7777-0000-4000-8000-000000000003');
  IF (r->>'created')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'first start should create the job: %', r; END IF;
  r := public.studio_start_catalog_job('dddd7777-2222-4000-8000-000000000001','dddd7777-4444-4000-8000-000000000001','manual',NULL);
  IF (r->>'created')::boolean IS NOT FALSE THEN RAISE EXCEPTION 'repeated start should return the job unchanged: %', r; END IF;

  BEGIN
    PERFORM public.studio_start_catalog_job('dddd7777-2222-4000-8000-000000000002','dddd7777-4444-4000-8000-000000000001','manual',NULL);
    RAISE EXCEPTION 'job id reused for another course was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'job_id_conflict' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.studio_start_catalog_job('dddd7777-2222-4000-8000-000000000001',gen_random_uuid(),'scheduled',NULL);
    RAISE EXCEPTION 'second running job of the course was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.studio_start_catalog_job(gen_random_uuid(),gen_random_uuid(),'manual',NULL);
    RAISE EXCEPTION 'job of an unknown course was accepted';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;

  -- A1 generation of the job; a second job of another course may reuse attempt 0.
  INSERT INTO public.studio_generations(catalog_job_id,attempt,agent_role,kind,provider,requested_model_id,prompt_version,input)
  VALUES('dddd7777-4444-4000-8000-000000000001',0,'A1','research','openai','m','a1-catalog-research@v1','{}');
  BEGIN
    INSERT INTO public.studio_generations(catalog_job_id,attempt,agent_role,kind,provider,requested_model_id,prompt_version,input)
    VALUES('dddd7777-4444-4000-8000-000000000001',0,'A1','research','openai','m','a1-catalog-research@v1','{}');
    RAISE EXCEPTION 'duplicate catalog attempt was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  -- Run claim is unchanged.
  INSERT INTO public.studio_generations(run_id,step_key,attempt,agent_role,kind,provider,requested_model_id,prompt_version,input)
  VALUES('dddd7777-3333-4000-8000-000000000001','research',0,'A2','research','openai','m','a2-research@v1','{}');
  BEGIN
    INSERT INTO public.studio_generations(run_id,step_key,attempt,agent_role,kind,provider,requested_model_id,prompt_version,input)
    VALUES('dddd7777-3333-4000-8000-000000000001','research',0,'A2','research','openai','m','a2-research@v1','{}');
    RAISE EXCEPTION 'duplicate run attempt was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  IF public.studio_finish_catalog_job('dddd7777-4444-4000-8000-000000000001','evidence_ok',NULL) IS NOT TRUE THEN
    RAISE EXCEPTION 'finish of a running job should return true';
  END IF;
  IF public.studio_finish_catalog_job('dddd7777-4444-4000-8000-000000000001','failed','late tick') IS NOT FALSE THEN
    RAISE EXCEPTION 'finish of an ended job should return false';
  END IF;
  IF (SELECT research_status FROM public.studio_courses WHERE id='dddd7777-2222-4000-8000-000000000001') <> 'evidence_ok' THEN
    RAISE EXCEPTION 'evidence_ok job did not set research_status';
  END IF;

  -- needs_more_sources sets research_status; failed leaves it.
  r := public.studio_start_catalog_job('dddd7777-2222-4000-8000-000000000001','dddd7777-4444-4000-8000-000000000002','scheduled',NULL);
  IF (r->>'created')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'scheduled start with no actor should create the job: %', r; END IF;
  -- Another job reuses attempt 0: the claim is per job, not shared by every catalog row.
  INSERT INTO public.studio_generations(catalog_job_id,attempt,agent_role,kind,provider,requested_model_id,prompt_version,input)
  VALUES('dddd7777-4444-4000-8000-000000000002',0,'A1','research','openai','m','a1-catalog-research@v1','{}');
  PERFORM public.studio_finish_catalog_job('dddd7777-4444-4000-8000-000000000002','needs_more_sources','no demand data');
  IF (SELECT research_status FROM public.studio_courses WHERE id='dddd7777-2222-4000-8000-000000000001') <> 'needs_more_sources' THEN
    RAISE EXCEPTION 'needs_more_sources job did not set research_status';
  END IF;
  PERFORM public.studio_start_catalog_job('dddd7777-2222-4000-8000-000000000001','dddd7777-4444-4000-8000-000000000003','after_publish',NULL);
  PERFORM public.studio_finish_catalog_job('dddd7777-4444-4000-8000-000000000003','failed','provider down');
  IF (SELECT research_status FROM public.studio_courses WHERE id='dddd7777-2222-4000-8000-000000000001') <> 'needs_more_sources' THEN
    RAISE EXCEPTION 'failed job changed research_status';
  END IF;
  BEGIN
    PERFORM public.studio_finish_catalog_job('dddd7777-4444-4000-8000-000000000003','running',NULL);
    RAISE EXCEPTION 'finish with status running was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invalid_job_status' THEN RAISE; END IF;
  END;

  -- The production order (group_kind NULL) with one ranked and one excluded course.
  INSERT INTO public.studio_catalog_rankings(id,weights_version,algorithm_version,computed_at)
  VALUES('dddd7777-5555-4000-8000-000000000001',1,'rank@v1','2026-10-23 10:00+00');
  INSERT INTO public.studio_catalog_scores(ranking_id,course_id,job_id,components,total,confidence,rank) VALUES
   ('dddd7777-5555-4000-8000-000000000001','dddd7777-2222-4000-8000-000000000001','dddd7777-4444-4000-8000-000000000001','{"trend":{"level":4}}',72.5,'medium',1);
  INSERT INTO public.studio_catalog_scores(ranking_id,course_id,excluded_reason) VALUES
   ('dddd7777-5555-4000-8000-000000000001','dddd7777-2222-4000-8000-000000000002','no_path');

  -- Course A has a path in two Types: one row in each group ranking, at a rank of its own in each.
  -- Course B ranks beside it in the skill ranking and has no row in the ecosystem one.
  INSERT INTO public.studio_paths(id,group_kind,slug,title) VALUES
   ('dddd7777-6666-4000-8000-000000000001','skill','studio-catalog-test','Test skill path'),
   ('dddd7777-6666-4000-8000-000000000002','ecosystem','studio-catalog-test','Test ecosystem path');
  INSERT INTO public.studio_course_paths(course_id,path_id) VALUES
   ('dddd7777-2222-4000-8000-000000000001','dddd7777-6666-4000-8000-000000000001'),
   ('dddd7777-2222-4000-8000-000000000001','dddd7777-6666-4000-8000-000000000002'),
   ('dddd7777-2222-4000-8000-000000000002','dddd7777-6666-4000-8000-000000000001');
  INSERT INTO public.studio_catalog_rankings(id,group_kind,weights_version,algorithm_version,computed_at) VALUES
   ('dddd7777-5555-4000-8000-000000000010','skill',1,'rank@v1','2026-10-23 09:00+00'),
   ('dddd7777-5555-4000-8000-000000000011','skill',1,'rank@v1','2026-10-23 10:00+00'),
   ('dddd7777-5555-4000-8000-000000000012','ecosystem',1,'rank@v1','2026-10-23 10:00+00');
  INSERT INTO public.studio_catalog_scores(ranking_id,course_id,job_id,components,total,confidence,rank) VALUES
   ('dddd7777-5555-4000-8000-000000000011','dddd7777-2222-4000-8000-000000000001','dddd7777-4444-4000-8000-000000000001','{}',72.5,'medium',2),
   ('dddd7777-5555-4000-8000-000000000011','dddd7777-2222-4000-8000-000000000002','dddd7777-4444-4000-8000-000000000001','{}',80,'medium',1),
   ('dddd7777-5555-4000-8000-000000000012','dddd7777-2222-4000-8000-000000000001','dddd7777-4444-4000-8000-000000000001','{}',65,'medium',1);
  IF (SELECT rank FROM public.studio_catalog_scores s JOIN public.studio_catalog_rankings r ON r.id = s.ranking_id
      WHERE r.id = (SELECT id FROM public.studio_catalog_rankings WHERE group_kind = 'skill' ORDER BY computed_at DESC LIMIT 1)
        AND s.course_id = 'dddd7777-2222-4000-8000-000000000001') <> 2
     OR (SELECT rank FROM public.studio_catalog_scores s
         WHERE s.ranking_id = (SELECT id FROM public.studio_catalog_rankings WHERE group_kind = 'ecosystem' ORDER BY computed_at DESC LIMIT 1)
           AND s.course_id = 'dddd7777-2222-4000-8000-000000000001') <> 1
     OR (SELECT id FROM public.studio_catalog_rankings WHERE group_kind IS NULL ORDER BY computed_at DESC LIMIT 1)
        <> 'dddd7777-5555-4000-8000-000000000001' THEN
    RAISE EXCEPTION 'latest group rank of course A per Type, or latest production pass, is wrong';
  END IF;
  IF (SELECT count(*) FROM public.studio_catalog_scores
      WHERE course_id = 'dddd7777-2222-4000-8000-000000000001' AND rank IS NOT NULL) <> 3 THEN
    RAISE EXCEPTION 'course A should have rows in the production order and in two group rankings';
  END IF;

  -- Production placement reasons: prerequisite_of names the dependent course, manual does not.
  INSERT INTO public.studio_catalog_scores(ranking_id,course_id,job_id,components,total,confidence,rank,placement_reason,placement_for)
  VALUES('dddd7777-5555-4000-8000-000000000012','dddd7777-2222-4000-8000-000000000002','dddd7777-4444-4000-8000-000000000001','{}',50,'low',2,'prerequisite_of','dddd7777-2222-4000-8000-000000000001');
  UPDATE public.studio_catalog_scores SET placement_reason = 'manual', placement_for = NULL
  WHERE ranking_id = 'dddd7777-5555-4000-8000-000000000012' AND course_id = 'dddd7777-2222-4000-8000-000000000002';

  -- Manual orders: a new order supersedes the previous one; a research result expires the active one.
  PERFORM public.studio_set_manual_order('dddd7777-2222-4000-8000-000000000002',3,'pilot partner','dddd7777-0000-4000-8000-000000000003');
  PERFORM public.studio_set_manual_order('dddd7777-2222-4000-8000-000000000002',1,'moved up','dddd7777-0000-4000-8000-000000000003');
  IF (SELECT count(*) FROM public.studio_catalog_manual_orders WHERE course_id='dddd7777-2222-4000-8000-000000000002' AND status='superseded' AND ended_at IS NOT NULL) <> 1
     OR (SELECT position FROM public.studio_catalog_manual_orders WHERE course_id='dddd7777-2222-4000-8000-000000000002' AND status='active') <> 1 THEN
    RAISE EXCEPTION 'new manual order did not supersede the previous one';
  END IF;
  BEGIN
    PERFORM public.studio_set_manual_order(gen_random_uuid(),1,'x',NULL);
    RAISE EXCEPTION 'manual order of an unknown course was accepted';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  PERFORM public.studio_start_catalog_job('dddd7777-2222-4000-8000-000000000002','dddd7777-4444-4000-8000-000000000004','rank_check_retry',NULL);
  PERFORM public.studio_finish_catalog_job('dddd7777-4444-4000-8000-000000000004','failed','provider down');
  IF NOT EXISTS (SELECT 1 FROM public.studio_catalog_manual_orders WHERE course_id='dddd7777-2222-4000-8000-000000000002' AND status='active') THEN
    RAISE EXCEPTION 'a failed job expired the manual order';
  END IF;
  PERFORM public.studio_start_catalog_job('dddd7777-2222-4000-8000-000000000002','dddd7777-4444-4000-8000-000000000005','manual',NULL);
  PERFORM public.studio_finish_catalog_job('dddd7777-4444-4000-8000-000000000005','evidence_ok',NULL);
  IF EXISTS (SELECT 1 FROM public.studio_catalog_manual_orders WHERE course_id='dddd7777-2222-4000-8000-000000000002' AND status='active')
     OR NOT EXISTS (SELECT 1 FROM public.studio_catalog_manual_orders WHERE course_id='dddd7777-2222-4000-8000-000000000002' AND status='expired' AND ended_at IS NOT NULL) THEN
    RAISE EXCEPTION 'a new research result did not expire the manual order';
  END IF;
  PERFORM public.studio_set_manual_order('dddd7777-2222-4000-8000-000000000002',2,'after new research','dddd7777-0000-4000-8000-000000000003');
END $$;
RESET ROLE;

-- Browser actors: admin reads every new table, nobody writes; research_status is not writable.
DO $$
DECLARE
  actor integer;
  n integer;
  t text;
  op text;
  stmt text;
BEGIN
  FOR actor IN 0..3 LOOP
    PERFORM set_config('request.jwt.claim.sub', CASE WHEN actor=0 THEN '' ELSE 'dddd7777-0000-4000-8000-'||lpad(actor::text,12,'0') END, true);
    EXECUTE CASE WHEN actor=0 THEN 'SET LOCAL ROLE anon' ELSE 'SET LOCAL ROLE authenticated' END;

    FOREACH t IN ARRAY ARRAY['studio_scoring_weights','studio_catalog_jobs','studio_catalog_rankings','studio_catalog_scores','studio_catalog_manual_orders'] LOOP
      n := -1;
      BEGIN
        EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      EXCEPTION WHEN insufficient_privilege THEN n := -42501; END;
      IF actor = 0 AND n <> -42501 THEN RAISE EXCEPTION 'anon SELECT on % returned %, expected 42501', t, n; END IF;
      IF actor IN (1,2) AND n <> 0 THEN RAISE EXCEPTION 'Non-admin actor % sees % rows of %', actor, n, t; END IF;
      IF actor = 3 AND n < 1 THEN RAISE EXCEPTION 'Admin sees no rows of %', t; END IF;

      FOREACH op IN ARRAY ARRAY['update','delete'] LOOP
        stmt := CASE op WHEN 'update' THEN format('UPDATE public.%I SET %I = %I', t,
                  CASE t WHEN 'studio_scoring_weights' THEN 'weights' WHEN 'studio_catalog_jobs' THEN 'reason' WHEN 'studio_catalog_rankings' THEN 'computed_at' WHEN 'studio_catalog_manual_orders' THEN 'reason' ELSE 'components' END,
                  CASE t WHEN 'studio_scoring_weights' THEN 'weights' WHEN 'studio_catalog_jobs' THEN 'reason' WHEN 'studio_catalog_rankings' THEN 'computed_at' WHEN 'studio_catalog_manual_orders' THEN 'reason' ELSE 'components' END)
                ELSE format('DELETE FROM public.%I', t) END;
        n := -1;
        BEGIN
          EXECUTE stmt;
          GET DIAGNOSTICS n = ROW_COUNT;
        EXCEPTION WHEN insufficient_privilege THEN n := -42501; END;
        IF n <> -42501 THEN RAISE EXCEPTION 'Actor % % on % returned %, expected 42501', actor, op, t, n; END IF;
      END LOOP;
    END LOOP;

    FOREACH stmt IN ARRAY ARRAY[
      $q$INSERT INTO public.studio_catalog_jobs(course_id,trigger) VALUES('dddd7777-2222-4000-8000-000000000001','manual')$q$,
      $q$INSERT INTO public.studio_scoring_weights(version,weights) VALUES(99,(SELECT weights FROM public.studio_scoring_weights WHERE version=1))$q$,
      $q$UPDATE public.studio_courses SET research_status='evidence_ok' WHERE id='dddd7777-2222-4000-8000-000000000002'$q$,
      $q$INSERT INTO public.studio_courses(title,research_status) VALUES('forged evidence','evidence_ok')$q$,
      $q$SELECT public.studio_start_catalog_job('dddd7777-2222-4000-8000-000000000002',gen_random_uuid(),'manual',NULL)$q$,
      $q$SELECT public.studio_finish_catalog_job('dddd7777-4444-4000-8000-000000000001','evidence_ok',NULL)$q$,
      $q$INSERT INTO public.studio_catalog_manual_orders(course_id,position,reason) VALUES('dddd7777-2222-4000-8000-000000000002',1,'forged')$q$,
      $q$INSERT INTO public.studio_catalog_rankings(group_kind,weights_version,algorithm_version) VALUES('skill',1,'forged')$q$,
      $q$SELECT public.studio_set_manual_order('dddd7777-2222-4000-8000-000000000002',1,'forged',NULL)$q$
    ] LOOP
      n := -1;
      BEGIN
        EXECUTE stmt;
        GET DIAGNOSTICS n = ROW_COUNT;
      EXCEPTION WHEN insufficient_privilege THEN n := -42501; END;
      IF n <> -42501 THEN RAISE EXCEPTION 'Actor % write was not refused (%): %', actor, n, stmt; END IF;
    END LOOP;

    -- Admin keeps the course columns the Studio UI writes.
    IF actor = 3 THEN
      INSERT INTO public.studio_courses(title,level,status) VALUES('admin idea','beginner','idea');
      UPDATE public.studio_courses SET title='Catalog course B2', level='advanced' WHERE id='dddd7777-2222-4000-8000-000000000002';
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n <> 1 THEN RAISE EXCEPTION 'Admin update of title/level touched % rows', n; END IF;
    END IF;

    -- policy_tier is writable by the admin only (RLS hides the row from the others), and writing it
    -- does not open research_status.
    n := -1;
    BEGIN
      UPDATE public.studio_courses SET policy_tier='pilot' WHERE id='dddd7777-2222-4000-8000-000000000002';
      GET DIAGNOSTICS n = ROW_COUNT;
    EXCEPTION WHEN insufficient_privilege THEN n := -42501; END;
    IF actor = 3 AND n <> 1 THEN RAISE EXCEPTION 'Admin update of policy_tier touched % rows', n; END IF;
    IF actor <> 3 AND n NOT IN (0, -42501) THEN RAISE EXCEPTION 'Actor % updated policy_tier (%)', actor, n; END IF;
    IF actor = 3 THEN
      INSERT INTO public.studio_courses(title,policy_tier) VALUES('admin pilot idea','pilot');
    END IF;
    RESET ROLE;
  END LOOP;
END $$;

-- Data contract (as postgres): constraint probes must all be rejected.
DO $$
DECLARE
  code text;
  s text;
  bad text[] := ARRAY[
    $q$INSERT INTO public.studio_courses(title,research_status) VALUES('x','ranked')$q$,
    -- weights: wrong key set, sum <> 1, out of range, not a number
    $q$INSERT INTO public.studio_scoring_weights(version,weights) VALUES(2,'{"trend":1}')$q$,
    $q$INSERT INTO public.studio_scoring_weights(version,weights) VALUES(2,'{"trend":0.3,"demand":0.25,"corelia_fit":0.2,"catalog_gap":0.15,"ai_feasibility":0.1,"maintainability":0.05}')$q$,
    $q$INSERT INTO public.studio_scoring_weights(version,weights) VALUES(2,'{"trend":1.5,"demand":-0.5,"corelia_fit":0,"catalog_gap":0,"ai_feasibility":0,"maintainability":0}')$q$,
    $q$INSERT INTO public.studio_scoring_weights(version,weights) VALUES(2,'{"trend":"0.5","demand":0.5,"corelia_fit":0,"catalog_gap":0,"ai_feasibility":0,"maintainability":0}')$q$,
    $q$INSERT INTO public.studio_scoring_weights(version,weights) VALUES(2,'[1]')$q$,
    -- jobs: bad trigger/status, reason rules, finished_at rule
    $q$INSERT INTO public.studio_catalog_jobs(course_id,trigger) VALUES('dddd7777-2222-4000-8000-000000000002','signal')$q$,
    $q$INSERT INTO public.studio_catalog_jobs(course_id,trigger,status,finished_at) VALUES('dddd7777-2222-4000-8000-000000000002','manual','needs_more_sources',now())$q$,
    $q$INSERT INTO public.studio_catalog_jobs(course_id,trigger,status,finished_at,reason) VALUES('dddd7777-2222-4000-8000-000000000002','manual','evidence_ok',now(),'x')$q$,
    $q$INSERT INTO public.studio_catalog_jobs(course_id,trigger,status) VALUES('dddd7777-2222-4000-8000-000000000002','manual','evidence_ok')$q$,
    -- generations: no owner, two owners, catalog row not A1, A1 on a run step, lesson on catalog row
    $q$INSERT INTO public.studio_generations(attempt,agent_role,kind,provider,requested_model_id,prompt_version,input) VALUES(0,'A1','research','openai','m','p','{}')$q$,
    $q$INSERT INTO public.studio_generations(run_id,step_key,catalog_job_id,attempt,agent_role,kind,provider,requested_model_id,prompt_version,input) VALUES('dddd7777-3333-4000-8000-000000000001','research','dddd7777-4444-4000-8000-000000000001',5,'A1','research','openai','m','p','{}')$q$,
    $q$INSERT INTO public.studio_generations(catalog_job_id,attempt,agent_role,kind,provider,requested_model_id,prompt_version,input) VALUES('dddd7777-4444-4000-8000-000000000001',5,'A2','research','openai','m','p','{}')$q$,
    $q$INSERT INTO public.studio_generations(run_id,step_key,attempt,agent_role,kind,provider,requested_model_id,prompt_version,input) VALUES('dddd7777-3333-4000-8000-000000000001','research',5,'A1','research','openai','m','p','{}')$q$,
    $q$INSERT INTO public.studio_generations(catalog_job_id,lesson_id,attempt,agent_role,kind,provider,requested_model_id,prompt_version,input) VALUES('dddd7777-4444-4000-8000-000000000001','l1',5,'A1','research','openai','m','p','{}')$q$,
    -- scores: unknown weights version, ranked without score, unranked without reason, rank and reason, total out of range
    $q$INSERT INTO public.studio_catalog_rankings(weights_version) VALUES(42)$q$,
    $q$INSERT INTO public.studio_catalog_scores(ranking_id,course_id,rank) VALUES('dddd7777-5555-4000-8000-000000000001','dddd7777-2222-4000-8000-000000000002',2)$q$,
    $q$UPDATE public.studio_catalog_scores SET excluded_reason=NULL WHERE course_id='dddd7777-2222-4000-8000-000000000002'$q$,
    $q$UPDATE public.studio_catalog_scores SET excluded_reason='x' WHERE course_id='dddd7777-2222-4000-8000-000000000001'$q$,
    $q$UPDATE public.studio_catalog_scores SET total=100.5 WHERE course_id='dddd7777-2222-4000-8000-000000000001'$q$,
    $q$UPDATE public.studio_catalog_scores SET confidence='certain' WHERE course_id='dddd7777-2222-4000-8000-000000000001'$q$,
    -- rankings: unknown Type, missing/empty algorithm version
    $q$INSERT INTO public.studio_catalog_rankings(group_kind,weights_version,algorithm_version) VALUES('tier',1,'rank@v1')$q$,
    $q$INSERT INTO public.studio_catalog_rankings(weights_version,algorithm_version) VALUES(1,'')$q$,
    $q$INSERT INTO public.studio_catalog_rankings(weights_version,algorithm_version) VALUES(1,NULL)$q$,
    -- courses: unknown policy tier
    $q$INSERT INTO public.studio_courses(title,policy_tier) VALUES('x','gold')$q$,
    -- scores: unknown placement reason, prerequisite_of without its course, manual with a course,
    -- placement on an unranked row, placement_for pointing at no course
    $q$UPDATE public.studio_catalog_scores SET placement_reason='other' WHERE ranking_id='dddd7777-5555-4000-8000-000000000001' AND course_id='dddd7777-2222-4000-8000-000000000001'$q$,
    $q$UPDATE public.studio_catalog_scores SET placement_reason='prerequisite_of' WHERE ranking_id='dddd7777-5555-4000-8000-000000000001' AND course_id='dddd7777-2222-4000-8000-000000000001'$q$,
    $q$UPDATE public.studio_catalog_scores SET placement_reason='manual', placement_for='dddd7777-2222-4000-8000-000000000002' WHERE ranking_id='dddd7777-5555-4000-8000-000000000001' AND course_id='dddd7777-2222-4000-8000-000000000001'$q$,
    $q$UPDATE public.studio_catalog_scores SET placement_reason='manual' WHERE ranking_id='dddd7777-5555-4000-8000-000000000001' AND course_id='dddd7777-2222-4000-8000-000000000002'$q$,
    $q$UPDATE public.studio_catalog_scores SET placement_reason='prerequisite_of', placement_for=gen_random_uuid() WHERE ranking_id='dddd7777-5555-4000-8000-000000000001' AND course_id='dddd7777-2222-4000-8000-000000000001'$q$,
    -- manual orders: position, reason, status and validity rules
    $q$INSERT INTO public.studio_catalog_manual_orders(course_id,position,reason) VALUES('dddd7777-2222-4000-8000-000000000001',0,'x')$q$,
    $q$INSERT INTO public.studio_catalog_manual_orders(course_id,position,reason) VALUES('dddd7777-2222-4000-8000-000000000001',1,'  ')$q$,
    $q$INSERT INTO public.studio_catalog_manual_orders(course_id,position,reason) VALUES('dddd7777-2222-4000-8000-000000000001',1,NULL)$q$,
    $q$INSERT INTO public.studio_catalog_manual_orders(course_id,position,reason,status) VALUES('dddd7777-2222-4000-8000-000000000001',1,'x','done')$q$,
    $q$INSERT INTO public.studio_catalog_manual_orders(course_id,position,reason,ended_at) VALUES('dddd7777-2222-4000-8000-000000000001',1,'x',now())$q$,
    $q$INSERT INTO public.studio_catalog_manual_orders(course_id,position,reason,status) VALUES('dddd7777-2222-4000-8000-000000000001',1,'x','expired')$q$
  ];
BEGIN
  FOREACH s IN ARRAY bad LOOP
    code := NULL;
    BEGIN
      EXECUTE s;
    EXCEPTION WHEN check_violation THEN code := 'check';
              WHEN foreign_key_violation THEN code := 'fk';
              WHEN not_null_violation THEN code := 'not_null';
    END;
    IF code IS NULL THEN RAISE EXCEPTION 'Constraint probe was accepted: %', s; END IF;
  END LOOP;

  -- research_status is independent of status: every combination below is accepted.
  FOREACH s IN ARRAY ARRAY['idea','needs_more_sources','evidence_ok'] LOOP
    UPDATE public.studio_courses SET research_status = s, status = 'published' WHERE id='dddd7777-2222-4000-8000-000000000002';
  END LOOP;
  UPDATE public.studio_courses SET research_status = 'idea', status = 'idea' WHERE id='dddd7777-2222-4000-8000-000000000002';

  -- Two ranked courses cannot share a rank in one pass.
  BEGIN
    UPDATE public.studio_catalog_scores SET job_id='dddd7777-4444-4000-8000-000000000001', total=10, confidence='low', rank=1, excluded_reason=NULL
    WHERE course_id='dddd7777-2222-4000-8000-000000000002';
    RAISE EXCEPTION 'duplicate rank in one ranking was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- One active manual order per course: a direct second active row is refused.
  BEGIN
    INSERT INTO public.studio_catalog_manual_orders(course_id,position,reason) VALUES('dddd7777-2222-4000-8000-000000000002',9,'second active');
    RAISE EXCEPTION 'second active manual order of a course was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Deleting the course removes its jobs, their generations, its scores and its manual orders.
  DELETE FROM public.studio_courses WHERE id='dddd7777-2222-4000-8000-000000000001';
  IF EXISTS (SELECT 1 FROM public.studio_catalog_jobs WHERE course_id='dddd7777-2222-4000-8000-000000000001')
     OR EXISTS (SELECT 1 FROM public.studio_generations WHERE catalog_job_id='dddd7777-4444-4000-8000-000000000001')
     OR EXISTS (SELECT 1 FROM public.studio_catalog_scores WHERE course_id='dddd7777-2222-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Catalog research rows survived deletion of their course';
  END IF;
  DELETE FROM public.studio_courses WHERE id='dddd7777-2222-4000-8000-000000000002';
  IF EXISTS (SELECT 1 FROM public.studio_catalog_manual_orders WHERE course_id='dddd7777-2222-4000-8000-000000000002')
     OR EXISTS (SELECT 1 FROM public.studio_catalog_scores WHERE placement_for='dddd7777-2222-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Manual orders or placement rows survived deletion of their course';
  END IF;
END $$;

ROLLBACK;

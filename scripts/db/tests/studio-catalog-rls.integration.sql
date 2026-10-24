-- Studio catalog RLS contract: real operations under each role, all rolled back.
-- Actors: 0 anon | 1 student | 2 instructor (corelia) | 3 instructor (external) | 4 support_staff | 5 admin | 6 admin (demotion probe)
-- Expected: only admin reads and writes. anon: any statement 42501 (no grant).
-- Other actors: SELECT/UPDATE/DELETE see 0 rows, INSERT 42501.
BEGIN;

INSERT INTO auth.users(id,email,instance_id,aud,role,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change)
SELECT ('dddd5555-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'studio-rls-'||n||'@corelia.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated',now(),'','','','' FROM generate_series(1,6) n;

-- Postgres/service context (auth.uid() IS NULL) may set roles; this is the trusted path.
UPDATE public.profiles SET
  role = CASE right(id::text,1) WHEN '1' THEN 'student' WHEN '4' THEN 'support_staff' WHEN '5' THEN 'admin' WHEN '6' THEN 'admin' ELSE 'instructor' END,
  instructor_origin = CASE right(id::text,1) WHEN '2' THEN 'corelia' WHEN '3' THEN 'external' ELSE NULL END
WHERE id::text LIKE 'dddd5555%';

-- Seed (as postgres): one row per table, plus spare parents for insert probes.
INSERT INTO public.studio_catalog_scopes(group_kind,audience,corelia_direction) VALUES('role','Web3 developers','Practical Web3 engineering');
INSERT INTO public.studio_paths(id,group_kind,slug,title) VALUES('dddd5555-1111-4000-8000-000000000001','skill','rust','Rust');
INSERT INTO public.studio_courses(id,title) VALUES
 ('dddd5555-2222-4000-8000-000000000001','Seed course A'),
 ('dddd5555-2222-4000-8000-000000000002','Seed course B');
INSERT INTO public.studio_course_paths(course_id,path_id) VALUES('dddd5555-2222-4000-8000-000000000001','dddd5555-1111-4000-8000-000000000001');
INSERT INTO public.studio_runs(id,course_id) VALUES('dddd5555-3333-4000-8000-000000000001','dddd5555-2222-4000-8000-000000000001');
INSERT INTO public.studio_run_steps(run_id,step_key) VALUES('dddd5555-3333-4000-8000-000000000001','research');

DO $$
DECLARE
  actor integer;
  t text;
  is_writer boolean;
  n integer;
  stmt text;
  insert_sql constant jsonb := jsonb_build_object(
    'studio_catalog_scopes', $q$INSERT INTO public.studio_catalog_scopes(group_kind,audience,corelia_direction) VALUES('skill','probe','probe')$q$,
    'studio_paths',          $q$INSERT INTO public.studio_paths(group_kind,slug,title) VALUES('skill','probe','Probe')$q$,
    'studio_courses',        $q$INSERT INTO public.studio_courses(title) VALUES('Probe')$q$,
    'studio_course_paths',   $q$INSERT INTO public.studio_course_paths(course_id,path_id) VALUES('dddd5555-2222-4000-8000-000000000002','dddd5555-1111-4000-8000-000000000001')$q$,
    'studio_runs',           $q$INSERT INTO public.studio_runs(course_id) VALUES('dddd5555-2222-4000-8000-000000000002')$q$,
    'studio_run_steps',      $q$INSERT INTO public.studio_run_steps(run_id,step_key) VALUES('dddd5555-3333-4000-8000-000000000001','brief')$q$);
  update_sql constant jsonb := jsonb_build_object(
    'studio_catalog_scopes', $q$UPDATE public.studio_catalog_scopes SET audience='changed' WHERE group_kind='role'$q$,
    'studio_paths',          $q$UPDATE public.studio_paths SET title='changed' WHERE id='dddd5555-1111-4000-8000-000000000001'$q$,
    'studio_courses',        $q$UPDATE public.studio_courses SET title='changed' WHERE id='dddd5555-2222-4000-8000-000000000001'$q$,
    'studio_course_paths',   $q$UPDATE public.studio_course_paths SET learning_order=5 WHERE course_id='dddd5555-2222-4000-8000-000000000001'$q$,
    'studio_runs',           $q$UPDATE public.studio_runs SET started_at=started_at WHERE id='dddd5555-3333-4000-8000-000000000001'$q$,
    'studio_run_steps',      $q$UPDATE public.studio_run_steps SET state='done' WHERE run_id='dddd5555-3333-4000-8000-000000000001' AND step_key='research'$q$);
  delete_sql constant jsonb := jsonb_build_object(
    'studio_catalog_scopes', $q$DELETE FROM public.studio_catalog_scopes WHERE group_kind='role'$q$,
    'studio_paths',          $q$DELETE FROM public.studio_paths WHERE id='dddd5555-1111-4000-8000-000000000001'$q$,
    'studio_courses',        $q$DELETE FROM public.studio_courses WHERE id='dddd5555-2222-4000-8000-000000000002'$q$,
    'studio_course_paths',   $q$DELETE FROM public.studio_course_paths WHERE course_id='dddd5555-2222-4000-8000-000000000001'$q$,
    'studio_runs',           $q$DELETE FROM public.studio_runs WHERE id='dddd5555-3333-4000-8000-000000000001'$q$,
    'studio_run_steps',      $q$DELETE FROM public.studio_run_steps WHERE run_id='dddd5555-3333-4000-8000-000000000001' AND step_key='research'$q$);
  op text;
BEGIN
  FOR actor IN 0..5 LOOP
    PERFORM set_config('request.jwt.claim.sub', CASE WHEN actor=0 THEN '' ELSE 'dddd5555-0000-4000-8000-'||lpad(actor::text,12,'0') END, true);
    EXECUTE CASE WHEN actor=0 THEN 'SET LOCAL ROLE anon' ELSE 'SET LOCAL ROLE authenticated' END;
    is_writer := actor = 5;

    FOREACH t IN ARRAY ARRAY['studio_catalog_scopes','studio_paths','studio_courses','studio_course_paths','studio_runs','studio_run_steps'] LOOP
      -- SELECT: admin sees the seed rows; anon has no grant; the rest see nothing.
      n := -1;
      BEGIN
        EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      EXCEPTION WHEN insufficient_privilege THEN n := -42501; END;
      IF is_writer THEN
        IF n < 1 THEN RAISE EXCEPTION 'Admin cannot read % (count %)', t, n; END IF;
      ELSIF actor = 0 THEN
        IF n <> -42501 THEN RAISE EXCEPTION 'anon SELECT % returned %, expected 42501', t, n; END IF;
      ELSE
        IF n <> 0 THEN RAISE EXCEPTION 'Non-admin actor % sees % rows in %', actor, n, t; END IF;
      END IF;

      FOREACH op IN ARRAY ARRAY['insert','update','delete'] LOOP
        stmt := CASE op WHEN 'insert' THEN insert_sql->>t WHEN 'update' THEN update_sql->>t ELSE delete_sql->>t END;
        n := -1;
        BEGIN
          EXECUTE stmt;
          GET DIAGNOSTICS n = ROW_COUNT;
          RAISE EXCEPTION SQLSTATE 'P0002' USING MESSAGE = 'rollback probe';
        EXCEPTION
          WHEN no_data_found THEN NULL;
          WHEN insufficient_privilege THEN n := -42501;
        END;
        IF t IN ('studio_runs','studio_run_steps') THEN
          IF has_table_privilege(current_user, format('public.%I', t), upper(op)) THEN
            RAISE EXCEPTION 'Client actor % retains % privilege on %', actor, op, t;
          END IF;
          IF n <> -42501 THEN RAISE EXCEPTION 'Client actor % % % returned %, expected 42501 (service role only)', actor, op, t, n; END IF;
        ELSIF is_writer THEN
          IF n <> 1 THEN RAISE EXCEPTION 'Writer actor % % % affected %, expected 1', actor, op, t, n; END IF;
        ELSIF op = 'insert' THEN
          IF n <> -42501 THEN RAISE EXCEPTION 'Non-writer actor % INSERT % returned %, expected 42501', actor, t, n; END IF;
        ELSIF actor = 0 THEN
          IF n <> -42501 THEN RAISE EXCEPTION 'anon % % returned %, expected 42501 (no grant)', op, t, n; END IF;
        ELSE
          IF n <> 0 THEN RAISE EXCEPTION 'read-only actor % % % affected %, expected 0 rows', actor, op, t, n; END IF;
        END IF;
      END LOOP;
    END LOOP;

    IF public.studio_can_write() IS DISTINCT FROM is_writer THEN
      RAISE EXCEPTION 'Actor % studio_can_write() = %, expected %', actor, public.studio_can_write(), is_writer;
    END IF;
    RESET ROLE;
  END LOOP;
END $$;

-- Self-escalation: a student / instructor tries to promote themself. guard_profile_privileged_columns
-- reverts the change silently, so assert the stored role AND that writes stay denied.
DO $$
DECLARE r text; denied boolean; uid text; expected text;
BEGIN
  FOR uid, expected IN VALUES ('dddd5555-0000-4000-8000-000000000001','student'),('dddd5555-0000-4000-8000-000000000002','instructor'),('dddd5555-0000-4000-8000-000000000003','instructor') LOOP
    denied := false;
    PERFORM set_config('request.jwt.claim.sub',uid,true);
    SET LOCAL ROLE authenticated;
    UPDATE public.profiles SET role='admin' WHERE id=uid::uuid;
    SELECT role INTO r FROM public.profiles WHERE id=uid::uuid;
    IF r <> expected THEN RAISE EXCEPTION 'Self-promotion by % changed stored role to %', uid, r; END IF;
    IF public.studio_can_write() THEN RAISE EXCEPTION 'Actor % can write after attempted self-promotion', uid; END IF;
    BEGIN
      INSERT INTO public.studio_courses(title) VALUES('escalation probe');
    EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
    IF NOT denied THEN RAISE EXCEPTION 'Studio write succeeded for % after attempted self-promotion', uid; END IF;
    RESET ROLE;
  END LOOP;
END $$;

-- Claims forged in the JWT (user_metadata / app_metadata / role claim) must not grant write.
DO $$
DECLARE denied boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','dddd5555-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"dddd5555-0000-4000-8000-000000000001","role":"authenticated","user_metadata":{"role":"admin"},"app_metadata":{"role":"admin"},"user_role":"admin"}',true);
  SET LOCAL ROLE authenticated;
  IF public.studio_can_write() THEN RAISE EXCEPTION 'Forged JWT claims granted studio write'; END IF;
  BEGIN
    INSERT INTO public.studio_courses(title) VALUES('claim probe');
  EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Studio write succeeded with forged JWT claims'; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims','',true);
END $$;

-- Permission follows the live profile: demoting an admin removes access immediately.
DO $$
DECLARE denied boolean := false;
BEGIN
  -- Demote through the trusted path (no end-user uid), otherwise the guard trigger reverts it.
  PERFORM set_config('request.jwt.claim.sub','',true);
  UPDATE public.profiles SET role='student' WHERE id='dddd5555-0000-4000-8000-000000000006';
  IF (SELECT role FROM public.profiles WHERE id='dddd5555-0000-4000-8000-000000000006') <> 'student' THEN
    RAISE EXCEPTION 'Test setup: demotion did not apply';
  END IF;
  PERFORM set_config('request.jwt.claim.sub','dddd5555-0000-4000-8000-000000000006',true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.studio_courses(title) VALUES('demoted probe');
  EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Demoted admin can still write'; END IF;
  RESET ROLE;
END $$;

-- User without any profile row / without uid cannot write via the helper.
DO $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub','dddd5555-0000-4000-8000-0000000000ff',true);
  SET LOCAL ROLE authenticated;
  IF public.studio_can_write() THEN RAISE EXCEPTION 'Unknown uid can write'; END IF;
  RESET ROLE;
END $$;

-- Data contract: catalog as admin, runs/steps as service role, plus the updated_at trigger.
DO $$
DECLARE
  n integer; after_ts timestamptz; code text;
  bad_catalog text[] := ARRAY[
    $q$INSERT INTO public.studio_courses(title,status) VALUES('x','bogus')$q$,
    $q$INSERT INTO public.studio_courses(title) VALUES('   ')$q$,
    $q$INSERT INTO public.studio_courses(title,level) VALUES('x','expert')$q$,
    $q$INSERT INTO public.studio_courses(title) VALUES('  seed COURSE a ')$q$,
    $q$INSERT INTO public.studio_paths(group_kind,slug,title) VALUES('other','x','x')$q$,
    $q$INSERT INTO public.studio_paths(group_kind,slug,title) VALUES('skill','Bad Slug','x')$q$,
    $q$INSERT INTO public.studio_paths(group_kind,slug,title) VALUES('skill','rust','dup')$q$,
    $q$INSERT INTO public.studio_catalog_scopes(group_kind,audience,corelia_direction,locale) VALUES('skill','a','b','xx')$q$,
    $q$INSERT INTO public.studio_catalog_scopes(group_kind,audience,corelia_direction,research_period_days) VALUES('skill','a','b',0)$q$,
    $q$INSERT INTO public.studio_course_paths(course_id,path_id,learning_order) VALUES('dddd5555-2222-4000-8000-000000000002','dddd5555-1111-4000-8000-000000000001',-1)$q$,
    $q$INSERT INTO public.studio_course_paths(course_id,path_id) VALUES('dddd5555-2222-4000-8000-000000000001','dddd5555-1111-4000-8000-000000000001')$q$,
    $q$INSERT INTO public.studio_course_paths(course_id,path_id) VALUES(gen_random_uuid(),'dddd5555-1111-4000-8000-000000000001')$q$
  ];
  bad_runtime text[] := ARRAY[
    $q$INSERT INTO public.studio_run_steps(run_id,step_key) VALUES('dddd5555-3333-4000-8000-000000000001','lessons_old')$q$,
    $q$INSERT INTO public.studio_run_steps(run_id,step_key,state) VALUES('dddd5555-3333-4000-8000-000000000001','brief','bogus')$q$,
    $q$INSERT INTO public.studio_run_steps(run_id,step_key,repair_count) VALUES('dddd5555-3333-4000-8000-000000000001','brief',-1)$q$,
    $q$INSERT INTO public.studio_run_steps(run_id,step_key) VALUES(gen_random_uuid(),'brief')$q$,
    $q$INSERT INTO public.studio_runs(id,course_id) VALUES('dddd5555-3333-4000-8000-000000000001','dddd5555-2222-4000-8000-000000000002')$q$,
    $q$INSERT INTO public.studio_runs(course_id) VALUES('dddd5555-2222-4000-8000-000000000001')$q$,
    $q$INSERT INTO public.studio_runs(course_id,status) VALUES('dddd5555-2222-4000-8000-000000000002','bogus')$q$,
    $q$INSERT INTO public.studio_runs(course_id,status,finished_at) VALUES('dddd5555-2222-4000-8000-000000000002','draft_failed',now())$q$,
    $q$INSERT INTO public.studio_runs(course_id,status,finished_at,hold_reason) VALUES('dddd5555-2222-4000-8000-000000000002','draft_failed',now(),'  ')$q$,
    $q$INSERT INTO public.studio_runs(course_id,status,finished_at,hold_reason) VALUES('dddd5555-2222-4000-8000-000000000002','published',now(),'reason')$q$,
    $q$INSERT INTO public.studio_runs(course_id,status) VALUES('dddd5555-2222-4000-8000-000000000002','published')$q$,
    $q$INSERT INTO public.studio_runs(course_id,finished_at) VALUES('dddd5555-2222-4000-8000-000000000002',now())$q$
  ];
  s text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','dddd5555-0000-4000-8000-000000000005',true);
  SET LOCAL ROLE authenticated;

  INSERT INTO public.studio_catalog_scopes(group_kind,audience,corelia_direction) VALUES('skill','a','b');
  SELECT research_period_days INTO n FROM public.studio_catalog_scopes WHERE group_kind='skill';
  IF n <> 90 THEN RAISE EXCEPTION 'research_period_days default % <> 90', n; END IF;
  SELECT locale INTO code FROM public.studio_catalog_scopes WHERE group_kind='skill';
  IF code <> 'vi' THEN RAISE EXCEPTION 'scope locale default % <> vi', code; END IF;

  SELECT status INTO code FROM public.studio_courses WHERE id='dddd5555-2222-4000-8000-000000000001';
  IF code <> 'idea' THEN RAISE EXCEPTION 'course status default % <> idea', code; END IF;
  SELECT research_status INTO code FROM public.studio_courses WHERE id='dddd5555-2222-4000-8000-000000000001';
  IF code <> 'idea' THEN RAISE EXCEPTION 'course research_status default % <> idea', code; END IF;

  -- research_status is written only by the server (studio-catalog-research.integration.sql).

  -- One course in several paths, with an independent order per path.
  INSERT INTO public.studio_paths(id,group_kind,slug,title) VALUES('dddd5555-1111-4000-8000-000000000002','ecosystem','solana','Solana');
  INSERT INTO public.studio_course_paths(course_id,path_id,learning_order,display_order) VALUES('dddd5555-2222-4000-8000-000000000001','dddd5555-1111-4000-8000-000000000002',3,7);
  SELECT count(*) INTO n FROM public.studio_course_paths WHERE course_id='dddd5555-2222-4000-8000-000000000001';
  IF n <> 2 THEN RAISE EXCEPTION 'course should be in 2 paths, found %', n; END IF;

  -- Every course status value is accepted.
  FOREACH s IN ARRAY ARRAY['idea','queued','generating','published','needs_update','not_passed'] LOOP
    UPDATE public.studio_courses SET status = s WHERE id='dddd5555-2222-4000-8000-000000000002';
  END LOOP;

  -- Catalog constraint probes remain client writes and accept only their data constraints.
  FOREACH s IN ARRAY bad_catalog LOOP
    code := NULL;
    BEGIN
      EXECUTE s;
    EXCEPTION WHEN check_violation THEN code := 'check';
              WHEN unique_violation THEN code := 'unique';
              WHEN foreign_key_violation THEN code := 'fk';
    END;
    IF code IS NULL THEN RAISE EXCEPTION 'Catalog constraint probe was accepted: %', s; END IF;
  END LOOP;

  -- Runtime rows are written only by the trusted service role.
  SET LOCAL ROLE service_role;

  -- A run holds all 9 step keys, with a repair count per step.
  INSERT INTO public.studio_runs(id,course_id) VALUES('dddd5555-3333-4000-8000-000000000002','dddd5555-2222-4000-8000-000000000002');
  INSERT INTO public.studio_run_steps(run_id,step_key)
  SELECT 'dddd5555-3333-4000-8000-000000000002', k FROM unnest(ARRAY['brief','research','curriculum','curriculum_review','lessons','lesson_review','structure_check','journey_test','publish']) k;
  SELECT count(*) INTO n FROM public.studio_run_steps WHERE run_id='dddd5555-3333-4000-8000-000000000002';
  IF n <> 9 THEN RAISE EXCEPTION 'expected 9 step rows, found %', n; END IF;
  UPDATE public.studio_run_steps SET repair_count = repair_count + 1, state = 'failed', failure_reason = 'answer key mismatch'
    WHERE run_id='dddd5555-3333-4000-8000-000000000002' AND step_key='lesson_review';
  SELECT repair_count INTO n FROM public.studio_run_steps WHERE run_id='dddd5555-3333-4000-8000-000000000002' AND step_key='lesson_review';
  IF n <> 1 THEN RAISE EXCEPTION 'repair_count % <> 1', n; END IF;

  -- A run ends as a draft with a reason; the course can then start a new running run.
  UPDATE public.studio_runs SET status='draft_failed', finished_at=now(), hold_reason='repair limit reached'
    WHERE id='dddd5555-3333-4000-8000-000000000002';
  INSERT INTO public.studio_runs(course_id) VALUES('dddd5555-2222-4000-8000-000000000002');
  SELECT count(*) INTO n FROM public.studio_runs WHERE course_id='dddd5555-2222-4000-8000-000000000002';
  IF n <> 2 THEN RAISE EXCEPTION 'expected run history of 2 for course B, found %', n; END IF;
  UPDATE public.studio_runs SET status='published', finished_at=now()
    WHERE course_id='dddd5555-2222-4000-8000-000000000002' AND status='running';

  -- Runtime constraint probes must reach their data constraints under service_role.
  FOREACH s IN ARRAY bad_runtime LOOP
    code := NULL;
    BEGIN
      EXECUTE s;
    EXCEPTION WHEN check_violation THEN code := 'check';
              WHEN unique_violation THEN code := 'unique';
              WHEN foreign_key_violation THEN code := 'fk';
    END;
    IF code IS NULL THEN RAISE EXCEPTION 'Runtime constraint probe was accepted: %', s; END IF;
  END LOOP;
  -- updated_at is maintained by the trigger: a client-supplied past value is overridden.
  -- (now() is the transaction start time, so compare against it directly.)
  RESET ROLE;
  UPDATE public.studio_courses SET level = 'advanced', updated_at = now() - interval '1 day' WHERE id='dddd5555-2222-4000-8000-000000000001';
  SELECT updated_at INTO after_ts FROM public.studio_courses WHERE id='dddd5555-2222-4000-8000-000000000001';
  IF after_ts <> now() THEN RAISE EXCEPTION 'updated_at was not refreshed on UPDATE (%)', after_ts; END IF;
END $$;

ROLLBACK;

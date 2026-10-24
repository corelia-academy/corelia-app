-- Studio run events contract: admin read-only, service role writes, append-only constraints. All rolled back.
-- Actors: 0 anon | 1 student | 2 support_staff | 3 admin
BEGIN;

INSERT INTO auth.users(id,email,instance_id,aud,role,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change)
SELECT ('dddd6666-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'studio-events-'||n||'@corelia.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated',now(),'','','','' FROM generate_series(1,3) n;

UPDATE public.profiles SET role = CASE right(id::text,1) WHEN '1' THEN 'student' WHEN '2' THEN 'support_staff' ELSE 'admin' END
WHERE id::text LIKE 'dddd6666%';

INSERT INTO public.studio_courses(id,title) VALUES('dddd6666-2222-4000-8000-000000000001','Events course');
INSERT INTO public.studio_runs(id,course_id) VALUES('dddd6666-3333-4000-8000-000000000001','dddd6666-2222-4000-8000-000000000001');
INSERT INTO public.studio_run_steps(run_id,step_key) VALUES('dddd6666-3333-4000-8000-000000000001','research');

-- Trusted writer: the service role (orchestrator) appends lines.
SET LOCAL ROLE service_role;
INSERT INTO public.studio_run_events(run_id,step_key,kind,agent_role,message) VALUES
 ('dddd6666-3333-4000-8000-000000000001','research','progress','A2','reading source 1'),
 ('dddd6666-3333-4000-8000-000000000001','research','result','A2','brief ready');
INSERT INTO public.studio_run_events(run_id,step_key,attempt,kind,message,payload) VALUES
 ('dddd6666-3333-4000-8000-000000000001','research',1,'progress','retry: reading source 1','{"sources":2}');
RESET ROLE;

DO $$
DECLARE
  actor integer;
  n integer;
  op text;
  stmt text;
BEGIN
  FOR actor IN 0..3 LOOP
    PERFORM set_config('request.jwt.claim.sub', CASE WHEN actor=0 THEN '' ELSE 'dddd6666-0000-4000-8000-'||lpad(actor::text,12,'0') END, true);
    EXECUTE CASE WHEN actor=0 THEN 'SET LOCAL ROLE anon' ELSE 'SET LOCAL ROLE authenticated' END;

    n := -1;
    BEGIN
      SELECT count(*) INTO n FROM public.studio_run_events;
    EXCEPTION WHEN insufficient_privilege THEN n := -42501; END;
    IF actor = 3 AND n <> 3 THEN RAISE EXCEPTION 'Admin should read 3 events, got %', n; END IF;
    IF actor = 0 AND n <> -42501 THEN RAISE EXCEPTION 'anon SELECT returned %, expected 42501', n; END IF;
    IF actor IN (1,2) AND n <> 0 THEN RAISE EXCEPTION 'Non-admin actor % sees % events', actor, n; END IF;

    -- Nobody in the browser can write, including admin.
    FOREACH op IN ARRAY ARRAY['insert','update','delete'] LOOP
      stmt := CASE op
        WHEN 'insert' THEN $q$INSERT INTO public.studio_run_events(run_id,step_key,kind,message) VALUES('dddd6666-3333-4000-8000-000000000001','research','progress','forged')$q$
        WHEN 'update' THEN $q$UPDATE public.studio_run_events SET message='edited'$q$
        ELSE $q$DELETE FROM public.studio_run_events$q$ END;
      n := -1;
      BEGIN
        EXECUTE stmt;
        GET DIAGNOSTICS n = ROW_COUNT;
      EXCEPTION WHEN insufficient_privilege THEN n := -42501; END;
      IF n <> -42501 THEN RAISE EXCEPTION 'Actor % % on studio_run_events returned %, expected 42501', actor, op, n; END IF;
    END LOOP;
    RESET ROLE;
  END LOOP;
END $$;

-- Data contract (as postgres): constraint probes must all be rejected.
DO $$
DECLARE
  code text;
  s text;
  bad text[] := ARRAY[
    $q$INSERT INTO public.studio_run_events(run_id,step_key,kind,message) VALUES('dddd6666-3333-4000-8000-000000000001','research','thinking','x')$q$,
    $q$INSERT INTO public.studio_run_events(run_id,step_key,kind,agent_role,message) VALUES('dddd6666-3333-4000-8000-000000000001','research','progress','A7','x')$q$,
    $q$INSERT INTO public.studio_run_events(run_id,step_key,kind,message) VALUES('dddd6666-3333-4000-8000-000000000001','research','progress','   ')$q$,
    $q$INSERT INTO public.studio_run_events(run_id,step_key,kind,message) VALUES('dddd6666-3333-4000-8000-000000000001','research','progress',repeat('x',501))$q$,
    $q$INSERT INTO public.studio_run_events(run_id,step_key,attempt,kind,message) VALUES('dddd6666-3333-4000-8000-000000000001','research',-1,'progress','x')$q$,
    $q$INSERT INTO public.studio_run_events(run_id,step_key,kind,message,payload) VALUES('dddd6666-3333-4000-8000-000000000001','research','result','x','[1,2]')$q$,
    $q$INSERT INTO public.studio_run_events(run_id,step_key,kind,message,payload) VALUES('dddd6666-3333-4000-8000-000000000001','research','result','x',jsonb_build_object('blob',(SELECT string_agg(md5(i::text),'') FROM generate_series(1,1000) i)))$q$,
    $q$INSERT INTO public.studio_run_events(run_id,step_key,kind,message) VALUES('dddd6666-3333-4000-8000-000000000001','lessons','progress','step not in run')$q$,
    $q$INSERT INTO public.studio_run_events(run_id,step_key,kind,message) VALUES(gen_random_uuid(),'research','progress','unknown run')$q$
  ];
BEGIN
  FOREACH s IN ARRAY bad LOOP
    code := NULL;
    BEGIN
      EXECUTE s;
    EXCEPTION WHEN check_violation THEN code := 'check';
              WHEN foreign_key_violation THEN code := 'fk';
    END;
    IF code IS NULL THEN RAISE EXCEPTION 'Constraint probe was accepted: %', s; END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='studio_run_events') THEN
    RAISE EXCEPTION 'studio_run_events is not in the supabase_realtime publication';
  END IF;

  -- Deleting the run removes its log.
  DELETE FROM public.studio_runs WHERE id='dddd6666-3333-4000-8000-000000000001';
  IF EXISTS (SELECT 1 FROM public.studio_run_events WHERE run_id='dddd6666-3333-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Events survived deletion of their run';
  END IF;
END $$;

ROLLBACK;

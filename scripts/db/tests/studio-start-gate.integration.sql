-- Step 0 A1 integration contract. Run only on a disposable schema-only clone.
-- Every fixture and function call is rolled back.
BEGIN;

-- Keep this test independent of local Studio data and pin down the scope seed contract.
INSERT INTO public.studio_catalog_scopes(group_kind, audience, corelia_direction, locale, research_period_days)
VALUES ('skill', 'Fixture skill audience', 'Fixture skill direction', 'vi', 20)
ON CONFLICT (group_kind) DO UPDATE SET audience = EXCLUDED.audience,
  corelia_direction = EXCLUDED.corelia_direction, locale = EXCLUDED.locale, research_period_days = EXCLUDED.research_period_days;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.studio_catalog_scopes WHERE group_kind = 'role' AND locale = 'vi' AND research_period_days = 90) THEN
    RAISE EXCEPTION 'role default scope seed missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.studio_catalog_scopes WHERE group_kind = 'ecosystem' AND locale = 'vi' AND research_period_days = 90) THEN
    RAISE EXCEPTION 'ecosystem default scope seed missing';
  END IF;
END $$;

-- Simulate an admin edit and replay the migration's exact conflict policy.
UPDATE public.studio_catalog_scopes SET audience = 'Human role override' WHERE group_kind = 'role';
INSERT INTO public.studio_catalog_scopes(group_kind, audience, corelia_direction, locale, research_period_days)
VALUES
 ('role','Người muốn theo một vai trò nghề nghiệp trong Web3 và cần lộ trình rõ kỹ năng','Khóa theo vai trò, gom kỹ năng thành lộ trình làm việc được, ưu tiên thực hành','vi',90),
 ('ecosystem','Lập trình viên muốn xây dựng trên một hệ sinh thái cụ thể như Solana hoặc Stellar','Khóa nhập môn và thực hành trên một hệ sinh thái, dẫn tới ứng dụng đầu tiên chạy được','vi',90)
ON CONFLICT (group_kind) DO NOTHING;
DO $$
BEGIN
  IF (SELECT audience FROM public.studio_catalog_scopes WHERE group_kind = 'role') <> 'Human role override' THEN
    RAISE EXCEPTION 'role scope seed overwrote an admin edit';
  END IF;
  IF (SELECT audience FROM public.studio_catalog_scopes WHERE group_kind = 'skill') <> 'Fixture skill audience' THEN
    RAISE EXCEPTION 'scope seed changed the existing skill scope';
  END IF;
END $$;

INSERT INTO public.studio_courses(id,title,status,research_status) VALUES
 ('eeee7777-2222-4000-8000-000000000001','Create new A1 job','idea','idea'),
 ('eeee7777-2222-4000-8000-000000000002','Reuse evidence_ok','idea','evidence_ok'),
 ('eeee7777-2222-4000-8000-000000000003','Reuse needs_more_sources','needs_update','needs_more_sources'),
 ('eeee7777-2222-4000-8000-000000000004','Attach running A1 job','not_passed','idea'),
 ('eeee7777-2222-4000-8000-000000000005','Missing path','idea','idea'),
 ('eeee7777-2222-4000-8000-000000000006','Missing scope','idea','idea'),
 ('eeee7777-2222-4000-8000-000000000007','Expired job','idea','evidence_ok'),
 ('eeee7777-2222-4000-8000-000000000008','Minimum scope TTL','idea','evidence_ok'),
 ('eeee7777-2222-4000-8000-000000000009','Resume step 0','not_passed','evidence_ok'),
 ('eeee7777-2222-4000-8000-000000000010','Published cannot start','published','evidence_ok'),
 ('eeee7777-2222-4000-8000-000000000011','Atomic start event failure','idea','idea');

INSERT INTO public.studio_paths(id,group_kind,slug,title) VALUES
 ('eeee7777-1111-4000-8000-000000000001','ecosystem','fixture-ecosystem','Fixture ecosystem'),
 ('eeee7777-1111-4000-8000-000000000002','skill','fixture-skill','Fixture skill'),
 ('eeee7777-1111-4000-8000-000000000003','role','fixture-role','Fixture role');
INSERT INTO public.studio_course_paths(course_id,path_id) VALUES
 ('eeee7777-2222-4000-8000-000000000001','eeee7777-1111-4000-8000-000000000001'),
 ('eeee7777-2222-4000-8000-000000000002','eeee7777-1111-4000-8000-000000000001'),
 ('eeee7777-2222-4000-8000-000000000003','eeee7777-1111-4000-8000-000000000003'),
 ('eeee7777-2222-4000-8000-000000000004','eeee7777-1111-4000-8000-000000000001'),
 ('eeee7777-2222-4000-8000-000000000006','eeee7777-1111-4000-8000-000000000002'),
 ('eeee7777-2222-4000-8000-000000000007','eeee7777-1111-4000-8000-000000000001'),
 ('eeee7777-2222-4000-8000-000000000008','eeee7777-1111-4000-8000-000000000001'),
 ('eeee7777-2222-4000-8000-000000000008','eeee7777-1111-4000-8000-000000000002'),
 ('eeee7777-2222-4000-8000-000000000002','eeee7777-1111-4000-8000-000000000002'),
 ('eeee7777-2222-4000-8000-000000000011','eeee7777-1111-4000-8000-000000000001'),
 ('eeee7777-2222-4000-8000-000000000009','eeee7777-1111-4000-8000-000000000003'),
 ('eeee7777-2222-4000-8000-000000000010','eeee7777-1111-4000-8000-000000000001');

INSERT INTO public.studio_catalog_jobs(id,course_id,trigger,status,reason,started_at,finished_at) VALUES
 ('eeee7777-4444-4000-8000-000000000002','eeee7777-2222-4000-8000-000000000002','manual','evidence_ok',NULL,now()-interval '2 days',now()-interval '1 day'),
 ('eeee7777-4444-4000-8000-000000000003','eeee7777-2222-4000-8000-000000000003','manual','needs_more_sources','fixture incomplete',now()-interval '2 days',now()-interval '1 day'),
 ('eeee7777-4444-4000-8000-000000000004','eeee7777-2222-4000-8000-000000000004','manual','running',NULL,now(),NULL),
 ('eeee7777-4444-4000-8000-000000000007','eeee7777-2222-4000-8000-000000000007','manual','evidence_ok',NULL,now()-interval '92 days',now()-interval '91 days'),
 ('eeee7777-4444-4000-8000-000000000008','eeee7777-2222-4000-8000-000000000008','manual','evidence_ok',NULL,now()-interval '22 days',now()-interval '21 days'),
 ('eeee7777-4444-4000-8000-000000000009','eeee7777-2222-4000-8000-000000000009','manual','evidence_ok',NULL,now()-interval '121 days',now()-interval '120 days');

-- Step 0 can still resume from its pinned completed A1 result beyond the normal TTL.
INSERT INTO public.studio_runs(id,course_id,status,hold_reason,started_at,finished_at,catalog_job_id) VALUES
 ('eeee7777-3333-4000-8000-000000000009','eeee7777-2222-4000-8000-000000000009','draft_failed','fixture failure',now()-interval '2 days',now()-interval '1 day','eeee7777-4444-4000-8000-000000000009');
INSERT INTO public.studio_run_steps(run_id,step_key,state)
VALUES ('eeee7777-3333-4000-8000-000000000009','catalog_research','done');

SET LOCAL ROLE service_role;
DO $$
DECLARE
  result jsonb;
  got_message text;
  job_id uuid;
BEGIN
  -- With no prior A1 job, start creates one and inserts all ten steps.
  result := public.studio_start_run('eeee7777-2222-4000-8000-000000000001','eeee7777-3333-4000-8000-000000000001',NULL,NULL);
  job_id := (SELECT catalog_job_id FROM public.studio_runs WHERE id='eeee7777-3333-4000-8000-000000000001');
  IF result->>'created' <> 'true' OR job_id IS NULL THEN RAISE EXCEPTION 'start should create and pin an A1 job: %',result; END IF;
  IF (SELECT count(*) FROM public.studio_run_steps WHERE run_id='eeee7777-3333-4000-8000-000000000001') <> 10 THEN
    RAISE EXCEPTION 'new run must create ten steps';
  END IF;
  IF (SELECT state FROM public.studio_run_steps WHERE run_id='eeee7777-3333-4000-8000-000000000001' AND step_key='catalog_research') <> 'pending' THEN
    RAISE EXCEPTION 'new A1 job step 0 must be pending';
  END IF;
  IF (SELECT status FROM public.studio_catalog_jobs WHERE id=job_id) <> 'running' THEN RAISE EXCEPTION 'new A1 job must be running'; END IF;

  -- Idempotent replay remains valid after the course enters queued.
  result := public.studio_start_run('eeee7777-2222-4000-8000-000000000001','eeee7777-3333-4000-8000-000000000001',NULL,NULL);
  IF result->>'created' <> 'false' THEN RAISE EXCEPTION 'same run id must replay: %',result; END IF;

  -- Recent evidence_ok and needs_more_sources jobs both count as step 0 completion.
  result := public.studio_start_run('eeee7777-2222-4000-8000-000000000002','eeee7777-3333-4000-8000-000000000002',NULL,NULL);
  IF (SELECT catalog_job_id FROM public.studio_runs WHERE id='eeee7777-3333-4000-8000-000000000002') <> 'eeee7777-4444-4000-8000-000000000002' THEN
    RAISE EXCEPTION 'recent evidence_ok job was not reused';
  END IF;
  IF (SELECT state FROM public.studio_run_steps WHERE run_id='eeee7777-3333-4000-8000-000000000002' AND step_key='catalog_research') <> 'done' THEN
    RAISE EXCEPTION 'reused evidence_ok job must complete step 0';
  END IF;
  result := public.studio_start_run('eeee7777-2222-4000-8000-000000000003','eeee7777-3333-4000-8000-000000000003',NULL,NULL);
  IF (SELECT catalog_job_id FROM public.studio_runs WHERE id='eeee7777-3333-4000-8000-000000000003') <> 'eeee7777-4444-4000-8000-000000000003' THEN
    RAISE EXCEPTION 'recent needs_more_sources job was not reused';
  END IF;
  IF (SELECT state FROM public.studio_run_steps WHERE run_id='eeee7777-3333-4000-8000-000000000003' AND step_key='catalog_research') <> 'done' THEN
    RAISE EXCEPTION 'needs_more_sources job must complete step 0';
  END IF;

  -- Attach an existing running job; do not hit the one-running-job unique index.
  result := public.studio_start_run('eeee7777-2222-4000-8000-000000000004','eeee7777-3333-4000-8000-000000000004',NULL,NULL);
  IF (SELECT catalog_job_id FROM public.studio_runs WHERE id='eeee7777-3333-4000-8000-000000000004') <> 'eeee7777-4444-4000-8000-000000000004' THEN
    RAISE EXCEPTION 'existing running A1 job was not attached';
  END IF;
  IF (SELECT count(*) FROM public.studio_catalog_jobs WHERE course_id='eeee7777-2222-4000-8000-000000000004') <> 1 THEN
    RAISE EXCEPTION 'start created a duplicate running A1 job';
  END IF;

  -- Expired result and min(period across all attached groups) must create a fresh job.
  result := public.studio_start_run('eeee7777-2222-4000-8000-000000000007','eeee7777-3333-4000-8000-000000000007',NULL,NULL);
  IF (SELECT catalog_job_id FROM public.studio_runs WHERE id='eeee7777-3333-4000-8000-000000000007') = 'eeee7777-4444-4000-8000-000000000007' THEN
    RAISE EXCEPTION 'expired A1 result was reused';
  END IF;
  result := public.studio_start_run('eeee7777-2222-4000-8000-000000000008','eeee7777-3333-4000-8000-000000000008',NULL,NULL);
  IF (SELECT catalog_job_id FROM public.studio_runs WHERE id='eeee7777-3333-4000-8000-000000000008') = 'eeee7777-4444-4000-8000-000000000008' THEN
    RAISE EXCEPTION 'job outside the minimum scope period was reused';
  END IF;

  -- A completed step 0 on the failed source run is pinned and copied on resume even after TTL expiry.
  result := public.studio_start_run('eeee7777-2222-4000-8000-000000000009','eeee7777-3333-4000-8000-000000000010',NULL,'eeee7777-3333-4000-8000-000000000009');
  IF (SELECT catalog_job_id FROM public.studio_runs WHERE id='eeee7777-3333-4000-8000-000000000010') <> 'eeee7777-4444-4000-8000-000000000009' THEN
    RAISE EXCEPTION 'resume did not preserve the source run A1 job';
  END IF;
  IF (SELECT state FROM public.studio_run_steps WHERE run_id='eeee7777-3333-4000-8000-000000000010' AND step_key='catalog_research') <> 'done' OR result->'resume'->>'steps' <> '1' THEN
    RAISE EXCEPTION 'resume did not copy completed step 0: %',result;
  END IF;

  -- Guards reject early and leave no run or job behind.
  DELETE FROM public.studio_catalog_scopes WHERE group_kind = 'skill';
  BEGIN
    PERFORM public.studio_start_run('eeee7777-2222-4000-8000-000000000005','eeee7777-3333-4000-8000-000000000005',NULL,NULL);
    RAISE EXCEPTION 'expected course_has_no_path';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS got_message=MESSAGE_TEXT;
    IF got_message <> 'course_has_no_path' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.studio_start_run('eeee7777-2222-4000-8000-000000000006','eeee7777-3333-4000-8000-000000000006',NULL,NULL);
    RAISE EXCEPTION 'expected scope_missing';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS got_message=MESSAGE_TEXT;
    IF got_message <> 'scope_missing' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.studio_runs WHERE id IN ('eeee7777-3333-4000-8000-000000000005','eeee7777-3333-4000-8000-000000000006')) THEN
    RAISE EXCEPTION 'path/scope preflight failure inserted a run';
  END IF;
  IF EXISTS (SELECT 1 FROM public.studio_catalog_jobs WHERE course_id IN ('eeee7777-2222-4000-8000-000000000005','eeee7777-2222-4000-8000-000000000006')) THEN
    RAISE EXCEPTION 'path/scope preflight failure inserted an A1 job';
  END IF;

  BEGIN
    PERFORM public.studio_start_run('eeee7777-2222-4000-8000-000000000010','eeee7777-3333-4000-8000-000000000020',NULL,NULL);
    RAISE EXCEPTION 'expected course_not_startable';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS got_message=MESSAGE_TEXT;
    IF got_message <> 'course_not_startable' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

-- One step-0 event is recorded for every start case with source and TTL metadata.
DO $$
DECLARE
  sample record;
  event_count integer;
  event_row public.studio_run_events%ROWTYPE;
  expected_job_id uuid;
  expected_finished_at timestamptz;
BEGIN
  FOR sample IN
    SELECT * FROM (VALUES
      ('eeee7777-3333-4000-8000-000000000001'::uuid, 'started', NULL::uuid, 90, 'ecosystem'),
      ('eeee7777-3333-4000-8000-000000000002'::uuid, 'reused', 'eeee7777-4444-4000-8000-000000000002'::uuid, 20, 'skill'),
      ('eeee7777-3333-4000-8000-000000000003'::uuid, 'reused', 'eeee7777-4444-4000-8000-000000000003'::uuid, 90, 'role'),
      ('eeee7777-3333-4000-8000-000000000004'::uuid, 'attached_running', 'eeee7777-4444-4000-8000-000000000004'::uuid, 90, 'ecosystem'),
      ('eeee7777-3333-4000-8000-000000000010'::uuid, 'kept_previous', 'eeee7777-4444-4000-8000-000000000009'::uuid, 90, 'role')
    ) AS cases(run_id, source, job_id, period_days, period_group)
  LOOP
    SELECT count(*) INTO event_count
    FROM public.studio_run_events
    WHERE run_id = sample.run_id AND step_key = 'catalog_research';
    IF event_count <> 1 THEN
      RAISE EXCEPTION 'run % should have exactly one catalog_research event; got %', sample.run_id, event_count;
    END IF;
    SELECT * INTO event_row FROM public.studio_run_events
    WHERE run_id = sample.run_id AND step_key = 'catalog_research';
    expected_job_id := COALESCE(sample.job_id, (SELECT catalog_job_id FROM public.studio_runs WHERE id = sample.run_id));
    IF event_row.attempt <> 0 OR event_row.kind <> 'progress' OR event_row.agent_role <> 'A1'
       OR event_row.payload->>'source' <> sample.source
       OR event_row.payload->>'job_id' <> expected_job_id::text
       OR (event_row.payload->>'period_days')::integer <> sample.period_days
       OR event_row.payload->>'period_group' <> sample.period_group THEN
      RAISE EXCEPTION 'run % has incorrect source event metadata: %', sample.run_id, to_jsonb(event_row);
    END IF;

    IF sample.source IN ('reused', 'kept_previous') THEN
      SELECT finished_at INTO expected_finished_at FROM public.studio_catalog_jobs WHERE id = expected_job_id;
      IF (event_row.payload->>'finished_at')::timestamptz <> expected_finished_at
         OR (event_row.payload->>'expires_at')::timestamptz <> expected_finished_at + make_interval(days => sample.period_days) THEN
        RAISE EXCEPTION 'run % does not record the job completion and expiry: %', sample.run_id, event_row.payload;
      END IF;
      IF event_row.message NOT LIKE '%UTC%' THEN RAISE EXCEPTION 'run % source message must state UTC: %', sample.run_id, event_row.message; END IF;
    ELSE
      IF event_row.payload->>'finished_at' IS NOT NULL OR event_row.payload->>'expires_at' IS NOT NULL THEN
        RAISE EXCEPTION 'run % unexpectedly has a completed-job expiry: %', sample.run_id, event_row.payload;
      END IF;
    END IF;
  END LOOP;

  IF (SELECT payload->>'period_group' FROM public.studio_run_events WHERE run_id='eeee7777-3333-4000-8000-000000000008' AND step_key='catalog_research') <> 'skill'
     OR (SELECT (payload->>'period_days')::integer FROM public.studio_run_events WHERE run_id='eeee7777-3333-4000-8000-000000000008' AND step_key='catalog_research') <> 20 THEN
    RAISE EXCEPTION 'multiple-group event must identify the shortest scope period';
  END IF;
  IF (SELECT message FROM public.studio_run_events WHERE run_id='eeee7777-3333-4000-8000-000000000002' AND step_key='catalog_research') NOT LIKE '%20 ngày của nhóm skill%' THEN
    RAISE EXCEPTION 'reused multiple-group message must identify the shortest scope period';
  END IF;
  IF (SELECT message FROM public.studio_run_events WHERE run_id='eeee7777-3333-4000-8000-000000000010' AND step_key='catalog_research') NOT LIKE '%Giữ nguyên kết quả nghiên cứu của lượt trước dù đã quá hạn%' THEN
    RAISE EXCEPTION 'expired resumed result message is incorrect';
  END IF;
  IF (SELECT message FROM public.studio_run_events WHERE run_id='eeee7777-3333-4000-8000-000000000004' AND step_key='catalog_research') NOT LIKE '%Gắn vào job nghiên cứu đang chạy, bắt đầu%' THEN
    RAISE EXCEPTION 'running-job message is incorrect';
  END IF;
  IF (SELECT message FROM public.studio_run_events WHERE run_id='eeee7777-3333-4000-8000-000000000001' AND step_key='catalog_research') NOT LIKE 'Bắt đầu nghiên cứu mới cho nhóm:%' THEN
    RAISE EXCEPTION 'new-job message is incorrect';
  END IF;
END $$;

-- If event writing fails, the RPC call rolls the run, job, and step back together.
CREATE FUNCTION pg_temp.fail_catalog_research_start_event() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.step_key = 'catalog_research' THEN RAISE EXCEPTION 'forced_start_event_failure'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER studio_test_fail_catalog_research_start_event
BEFORE INSERT ON public.studio_run_events
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_catalog_research_start_event();

SET LOCAL ROLE service_role;
DO $$
DECLARE
  got_message text;
BEGIN
  BEGIN
    PERFORM public.studio_start_run('eeee7777-2222-4000-8000-000000000011','eeee7777-3333-4000-8000-000000000011',NULL,NULL);
    RAISE EXCEPTION 'expected catalog start event failure';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS got_message = MESSAGE_TEXT;
    IF got_message <> 'forced_start_event_failure' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.studio_runs WHERE id='eeee7777-3333-4000-8000-000000000011')
     OR EXISTS (SELECT 1 FROM public.studio_catalog_jobs WHERE course_id='eeee7777-2222-4000-8000-000000000011') THEN
    RAISE EXCEPTION 'failed start event left a run or job behind';
  END IF;
END $$;
RESET ROLE;

ROLLBACK;

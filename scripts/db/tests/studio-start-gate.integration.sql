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
 ('eeee7777-2222-4000-8000-000000000006','Missing audience and direction','idea','idea'),
 ('eeee7777-2222-4000-8000-000000000007','Expired job','idea','evidence_ok'),
 ('eeee7777-2222-4000-8000-000000000008','Course period TTL','idea','evidence_ok'),
 ('eeee7777-2222-4000-8000-000000000009','Resume step 0','not_passed','evidence_ok'),
 ('eeee7777-2222-4000-8000-000000000010','Published cannot start','published','evidence_ok'),
 ('eeee7777-2222-4000-8000-000000000011','Atomic start event failure','idea','idea'),
 ('eeee7777-2222-4000-8000-000000000012','Resume copied generations','idea','idea'),
 ('eeee7777-2222-4000-8000-000000000013','Resume nothing done','idea','idea'),
 ('eeee7777-2222-4000-8000-000000000014','Restart from the curriculum','idea','idea');

-- Audience and direction are chosen per course; only the course without them must be refused.
UPDATE public.studio_courses
SET audience = 'Fixture audience', corelia_direction = 'Fixture direction'
WHERE id::text LIKE 'eeee7777-2222-%' AND id <> 'eeee7777-2222-4000-8000-000000000006';
UPDATE public.studio_courses SET research_period_days = 20
WHERE id IN ('eeee7777-2222-4000-8000-000000000002','eeee7777-2222-4000-8000-000000000008');

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
 ('eeee7777-2222-4000-8000-000000000012','eeee7777-1111-4000-8000-000000000002'),
 ('eeee7777-2222-4000-8000-000000000013','eeee7777-1111-4000-8000-000000000002'),
 ('eeee7777-2222-4000-8000-000000000014','eeee7777-1111-4000-8000-000000000002'),
 ('eeee7777-2222-4000-8000-000000000010','eeee7777-1111-4000-8000-000000000001');

INSERT INTO public.studio_catalog_jobs(id,course_id,trigger,status,reason,started_at,finished_at) VALUES
 ('eeee7777-4444-4000-8000-000000000002','eeee7777-2222-4000-8000-000000000002','manual','evidence_ok',NULL,now()-interval '2 days',now()-interval '1 day'),
 ('eeee7777-4444-4000-8000-000000000003','eeee7777-2222-4000-8000-000000000003','manual','needs_more_sources','fixture incomplete',now()-interval '2 days',now()-interval '1 day'),
 ('eeee7777-4444-4000-8000-000000000004','eeee7777-2222-4000-8000-000000000004','manual','running',NULL,now(),NULL),
 ('eeee7777-4444-4000-8000-000000000007','eeee7777-2222-4000-8000-000000000007','manual','evidence_ok',NULL,now()-interval '92 days',now()-interval '91 days'),
 ('eeee7777-4444-4000-8000-000000000008','eeee7777-2222-4000-8000-000000000008','manual','evidence_ok',NULL,now()-interval '22 days',now()-interval '21 days'),
 ('eeee7777-4444-4000-8000-000000000009','eeee7777-2222-4000-8000-000000000009','manual','evidence_ok',NULL,now()-interval '121 days',now()-interval '120 days'),
 ('eeee7777-4444-4000-8000-000000000012','eeee7777-2222-4000-8000-000000000012','manual','evidence_ok',NULL,now()-interval '10 days',now()-interval '9 days'),
 ('eeee7777-4444-4000-8000-000000000014','eeee7777-2222-4000-8000-000000000014','manual','evidence_ok',NULL,now()-interval '10 days',now()-interval '9 days');

-- Step 0 can still resume from its pinned completed A1 result beyond the normal TTL.
INSERT INTO public.studio_runs(id,course_id,status,hold_reason,started_at,finished_at,catalog_job_id) VALUES
 ('eeee7777-3333-4000-8000-000000000009','eeee7777-2222-4000-8000-000000000009','draft_failed','fixture failure',now()-interval '2 days',now()-interval '1 day','eeee7777-4444-4000-8000-000000000009');
INSERT INTO public.studio_run_steps(run_id,step_key,state)
VALUES ('eeee7777-3333-4000-8000-000000000009','catalog_research','done');

-- A resumed run has four accepted early steps, one completed lesson/review pair, and one draft
-- that is waiting for review. A second failed run has nothing to copy.
INSERT INTO public.studio_runs(id,course_id,status,hold_reason,started_at,finished_at,catalog_job_id) VALUES
 ('eeee7777-3333-4000-8000-000000000012','eeee7777-2222-4000-8000-000000000012','draft_failed','fixture failure',now()-interval '4 days',now()-interval '3 days','eeee7777-4444-4000-8000-000000000012'),
 ('eeee7777-3333-4000-8000-000000000013','eeee7777-2222-4000-8000-000000000013','draft_failed','fixture failure',now()-interval '4 days',now()-interval '3 days',NULL);
INSERT INTO public.studio_run_steps(run_id,step_key,state) VALUES
 ('eeee7777-3333-4000-8000-000000000012','catalog_research','done'),
 ('eeee7777-3333-4000-8000-000000000012','brief','done'),
 ('eeee7777-3333-4000-8000-000000000012','research','done'),
 ('eeee7777-3333-4000-8000-000000000012','curriculum','done'),
 ('eeee7777-3333-4000-8000-000000000012','curriculum_review','done'),
 ('eeee7777-3333-4000-8000-000000000012','lessons','done'),
 ('eeee7777-3333-4000-8000-000000000012','lesson_review','pending');
INSERT INTO public.studio_generations(
  id,run_id,step_key,lesson_id,attempt,agent_role,kind,provider,requested_model_id,model_id,prompt_version,input,status,
  provider_request_id,output,created_at,submitted_at,completed_at
) VALUES
 ('eeee7777-5555-4000-8000-000000000012','eeee7777-3333-4000-8000-000000000012','brief',NULL,0,'A2','text','openai','fixture-model','fixture-model','fixture-v1','{}','completed','resume-brief','{"topic":"fixture"}',now()-interval '4 days',now()-interval '4 days',now()-interval '3 days'),
 ('eeee7777-5555-4000-8000-000000000013','eeee7777-3333-4000-8000-000000000012','research',NULL,0,'A2','research','openai','fixture-model','fixture-model','fixture-v1','{}','completed','resume-research','{"topics":[]}',now()-interval '4 days',now()-interval '4 days',now()-interval '3 days'),
 ('eeee7777-5555-4000-8000-000000000014','eeee7777-3333-4000-8000-000000000012','curriculum',NULL,0,'A3','text','openai','fixture-model','fixture-model','fixture-v1','{}','completed','resume-curriculum','{"modules":[{"lessons":[{"id":"lesson-a"},{"id":"lesson-b"},{"id":"lesson-c"}]}]}',now()-interval '4 days',now()-interval '4 days',now()-interval '3 days'),
 ('eeee7777-5555-4000-8000-000000000015','eeee7777-3333-4000-8000-000000000012','curriculum_review',NULL,0,'A4','review','openai','fixture-model','fixture-model','fixture-v1','{}','completed','resume-curriculum-review','{"issues":[]}',now()-interval '4 days',now()-interval '4 days',now()-interval '3 days'),
 ('eeee7777-5555-4000-8000-000000000016','eeee7777-3333-4000-8000-000000000012','lessons','lesson-a',0,'A5','text','openai','fixture-model','fixture-model','fixture-v1','{}','completed','resume-lesson-a','{}',now()-interval '4 days',now()-interval '4 days',now()-interval '3 days'),
 ('eeee7777-5555-4000-8000-000000000017','eeee7777-3333-4000-8000-000000000012','lesson_review','lesson-a',0,'A6','review','openai','fixture-model','fixture-model','fixture-v1','{}','completed','resume-review-a','{"issues":[]}',now()-interval '4 days',now()-interval '4 days',now()-interval '3 days'),
 ('eeee7777-5555-4000-8000-000000000018','eeee7777-3333-4000-8000-000000000012','lessons','lesson-b',0,'A5','text','openai','fixture-model','fixture-model','fixture-v1','{}','completed','resume-lesson-b','{}',now()-interval '4 days',now()-interval '4 days',now()-interval '3 days');

-- A failed run whose curriculum is the problem: four accepted early steps and a finished lesson.
INSERT INTO public.studio_runs(id,course_id,status,hold_reason,started_at,finished_at,catalog_job_id) VALUES
 ('eeee7777-3333-4000-8000-000000000014','eeee7777-2222-4000-8000-000000000014','draft_failed','fixture failure',now()-interval '4 days',now()-interval '3 days','eeee7777-4444-4000-8000-000000000014');
INSERT INTO public.studio_run_steps(run_id,step_key,state) VALUES
 ('eeee7777-3333-4000-8000-000000000014','catalog_research','done'),
 ('eeee7777-3333-4000-8000-000000000014','brief','done'),
 ('eeee7777-3333-4000-8000-000000000014','research','done'),
 ('eeee7777-3333-4000-8000-000000000014','curriculum','done'),
 ('eeee7777-3333-4000-8000-000000000014','curriculum_review','done'),
 ('eeee7777-3333-4000-8000-000000000014','lessons','done'),
 ('eeee7777-3333-4000-8000-000000000014','lesson_review','pending');
INSERT INTO public.studio_generations(
  id,run_id,step_key,lesson_id,attempt,agent_role,kind,provider,requested_model_id,model_id,prompt_version,input,status,
  provider_request_id,output,created_at,submitted_at,completed_at
) VALUES
 ('eeee7777-5555-4000-8000-000000000030','eeee7777-3333-4000-8000-000000000014','brief',NULL,0,'A2','text','openai','fixture-model','fixture-model','fixture-v1','{}','completed','restart-brief','{"topic":"fixture"}',now()-interval '4 days',now()-interval '4 days',now()-interval '3 days'),
 ('eeee7777-5555-4000-8000-000000000031','eeee7777-3333-4000-8000-000000000014','research',NULL,0,'A2','research','openai','fixture-model','fixture-model','fixture-v1','{}','completed','restart-research','{"topics":[]}',now()-interval '4 days',now()-interval '4 days',now()-interval '3 days'),
 ('eeee7777-5555-4000-8000-000000000032','eeee7777-3333-4000-8000-000000000014','curriculum',NULL,0,'A3','text','openai','fixture-model','fixture-model','fixture-v1','{}','completed','restart-curriculum','{"modules":[{"lessons":[{"id":"lesson-a"},{"id":"lesson-b"}]}]}',now()-interval '4 days',now()-interval '4 days',now()-interval '3 days'),
 ('eeee7777-5555-4000-8000-000000000033','eeee7777-3333-4000-8000-000000000014','curriculum_review',NULL,0,'A4','review','openai','fixture-model','fixture-model','fixture-v1','{}','completed','restart-curriculum-review','{"issues":[]}',now()-interval '4 days',now()-interval '4 days',now()-interval '3 days'),
 ('eeee7777-5555-4000-8000-000000000034','eeee7777-3333-4000-8000-000000000014','lessons','lesson-a',0,'A5','text','openai','fixture-model','fixture-model','fixture-v1','{}','completed','restart-lesson-a','{}',now()-interval '4 days',now()-interval '4 days',now()-interval '3 days'),
 ('eeee7777-5555-4000-8000-000000000035','eeee7777-3333-4000-8000-000000000014','lesson_review','lesson-a',0,'A6','review','openai','fixture-model','fixture-model','fixture-v1','{}','completed','restart-review-a','{"issues":[]}',now()-interval '4 days',now()-interval '4 days',now()-interval '3 days');

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

  -- Resume logs every copied step in the same RPC transaction and keeps the single A1 source event.
  result := public.studio_start_run('eeee7777-2222-4000-8000-000000000012','eeee7777-3333-4000-8000-000000000020',NULL,'eeee7777-3333-4000-8000-000000000012');
  IF result->>'created' <> 'true' OR result->'resume'->>'steps' <> '5'
     OR result->'resume'->>'lessons_copied' <> '1' OR result->'resume'->>'drafts_copied' <> '1'
     OR result->'resume'->>'lessons_total' <> '3' THEN
    RAISE EXCEPTION 'resume counts do not match copied fixture: %', result;
  END IF;
  IF (SELECT count(*) FROM public.studio_run_events WHERE run_id='eeee7777-3333-4000-8000-000000000020') <> 7
     OR (SELECT count(*) FROM public.studio_run_events WHERE run_id='eeee7777-3333-4000-8000-000000000020' AND step_key='catalog_research') <> 1
     OR (SELECT count(*) FROM public.studio_run_events WHERE run_id='eeee7777-3333-4000-8000-000000000020' AND payload->>'source'='resumed') <> 6 THEN
    RAISE EXCEPTION 'resumed run must have one A1 event plus six copied-step events';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('brief','A2','Chuẩn bị brief'),
      ('research','A2','Nghiên cứu'),
      ('curriculum','A3','Curriculum'),
      ('curriculum_review','A4','Kiểm tra curriculum')
    ) expected(step_key, agent_role, label)
    LEFT JOIN public.studio_run_events e
      ON e.run_id='eeee7777-3333-4000-8000-000000000020' AND e.step_key=expected.step_key AND e.payload->>'source'='resumed'
    WHERE e.id IS NULL OR e.attempt <> 0 OR e.kind <> 'result' OR e.agent_role <> expected.agent_role
       OR e.message <> format('Dùng lại từ lượt trước: %s (lượt eeee7777).', expected.label)
       OR e.payload->>'from_run_id' <> 'eeee7777-3333-4000-8000-000000000012'
       OR e.payload->>'step' <> expected.step_key OR (e.payload->>'attempt')::integer <> 0
       OR coalesce(e.payload->>'finished_at' ~ '^\d{4}-\d{2}-\d{2}T.*Z$', false) = false
       OR e.message ~ '(UTC|[0-9]{4}-[0-9]{2}-[0-9]{2})'
  ) THEN
    RAISE EXCEPTION 'copied step source event metadata or message is incorrect';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM (VALUES ('lessons','A5'),('lesson_review','A6')) expected(step_key, agent_role)
    LEFT JOIN public.studio_run_events e
      ON e.run_id='eeee7777-3333-4000-8000-000000000020' AND e.step_key=expected.step_key AND e.payload->>'source'='resumed'
    WHERE e.id IS NULL OR e.attempt <> 0 OR e.kind <> 'result' OR e.agent_role <> expected.agent_role
       OR e.message <> 'Dùng lại từ lượt trước: 1 lesson đã đạt, 1 bản nháp chờ review.'
       OR e.payload->>'from_run_id' <> 'eeee7777-3333-4000-8000-000000000012'
       OR e.payload->>'step' <> expected.step_key OR (e.payload->>'attempt')::integer <> 0
       OR (e.payload->>'completed_lessons')::integer <> 1 OR (e.payload->>'pending_review_drafts')::integer <> 1
       OR coalesce(e.payload->>'finished_at' ~ '^\d{4}-\d{2}-\d{2}T.*Z$', false) = false
       OR e.message ~ '(UTC|[0-9]{4}-[0-9]{2}-[0-9]{2})'
  ) THEN
    RAISE EXCEPTION 'lesson source event counts or metadata are incorrect';
  END IF;
  -- Same run ID replays start without duplicating L1 or resume events.
  result := public.studio_start_run('eeee7777-2222-4000-8000-000000000012','eeee7777-3333-4000-8000-000000000020',NULL,NULL);
  IF result->>'created' <> 'false'
     OR (SELECT count(*) FROM public.studio_run_events WHERE run_id='eeee7777-3333-4000-8000-000000000020') <> 7 THEN
    RAISE EXCEPTION 'same run ID retry duplicated events: %', result;
  END IF;

  -- Restart from the curriculum: the steps before it are copied; it, its review and every lesson are not.
  result := public.studio_start_run('eeee7777-2222-4000-8000-000000000014','eeee7777-3333-4000-8000-000000000040',NULL,'eeee7777-3333-4000-8000-000000000014','curriculum');
  IF result->>'created' <> 'true' OR result->'resume'->>'steps' <> '3'
     OR result->'resume'->>'lessons_copied' <> '0' OR result->'resume'->>'drafts_copied' <> '0' THEN
    RAISE EXCEPTION 'restart from curriculum copied the wrong parts: %', result;
  END IF;
  IF (SELECT count(*) FROM public.studio_generations WHERE run_id='eeee7777-3333-4000-8000-000000000040' AND step_key IN ('brief','research')) <> 2
     OR EXISTS (SELECT 1 FROM public.studio_generations WHERE run_id='eeee7777-3333-4000-8000-000000000040' AND step_key IN ('curriculum','curriculum_review','lessons','lesson_review')) THEN
    RAISE EXCEPTION 'restart from curriculum must copy brief and research only';
  END IF;
  IF (SELECT count(*) FROM public.studio_run_steps WHERE run_id='eeee7777-3333-4000-8000-000000000040' AND state='done') <> 3
     OR EXISTS (SELECT 1 FROM public.studio_run_steps WHERE run_id='eeee7777-3333-4000-8000-000000000040' AND step_key IN ('curriculum','curriculum_review','lessons','lesson_review') AND state <> 'pending') THEN
    RAISE EXCEPTION 'restart from curriculum must leave the curriculum and later steps pending';
  END IF;
  -- A restart needs the run it resumes, and only the research or the curriculum can be restarted from.
  BEGIN
    PERFORM public.studio_start_run('eeee7777-2222-4000-8000-000000000013','eeee7777-3333-4000-8000-000000000041',NULL,NULL,'curriculum');
    RAISE EXCEPTION 'expected restart_requires_resume';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS got_message=MESSAGE_TEXT;
    IF got_message <> 'restart_requires_resume' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.studio_start_run('eeee7777-2222-4000-8000-000000000013','eeee7777-3333-4000-8000-000000000042',NULL,'eeee7777-3333-4000-8000-000000000013','lessons');
    RAISE EXCEPTION 'expected invalid_restart_step';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS got_message=MESSAGE_TEXT;
    IF got_message <> 'invalid_restart_step' THEN RAISE; END IF;
  END;

  -- A source run with no copied generations returns nothing_done and writes no resume events.
  result := public.studio_start_run('eeee7777-2222-4000-8000-000000000013','eeee7777-3333-4000-8000-000000000021',NULL,'eeee7777-3333-4000-8000-000000000013');
  IF result->>'resume_skipped' <> 'nothing_done'
     OR EXISTS (SELECT 1 FROM public.studio_run_events WHERE run_id='eeee7777-3333-4000-8000-000000000021' AND payload->>'source'='resumed')
     OR (SELECT count(*) FROM public.studio_run_events WHERE run_id='eeee7777-3333-4000-8000-000000000021' AND step_key='catalog_research') <> 1 THEN
    RAISE EXCEPTION 'nothing_done resume must not emit copied-step events: %', result;
  END IF;

  -- Guards reject early and leave no run or job behind.
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
    PERFORM public.studio_start_run('eeee7777-2222-4000-8000-000000000010','eeee7777-3333-4000-8000-000000000022',NULL,NULL);
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
  expected_started_at timestamptz;
BEGIN
  FOR sample IN
    SELECT * FROM (VALUES
      ('eeee7777-3333-4000-8000-000000000001'::uuid, 'started', NULL::uuid, 90),
      ('eeee7777-3333-4000-8000-000000000002'::uuid, 'reused', 'eeee7777-4444-4000-8000-000000000002'::uuid, 20),
      ('eeee7777-3333-4000-8000-000000000003'::uuid, 'reused', 'eeee7777-4444-4000-8000-000000000003'::uuid, 90),
      ('eeee7777-3333-4000-8000-000000000004'::uuid, 'attached_running', 'eeee7777-4444-4000-8000-000000000004'::uuid, 90),
      ('eeee7777-3333-4000-8000-000000000010'::uuid, 'kept_previous', 'eeee7777-4444-4000-8000-000000000009'::uuid, 90)
    ) AS cases(run_id, source, job_id, period_days)
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
    SELECT started_at INTO expected_started_at FROM public.studio_catalog_jobs WHERE id = expected_job_id;
    IF event_row.attempt <> 0 OR event_row.kind <> 'progress' OR event_row.agent_role <> 'A1'
       OR event_row.payload->>'source' <> sample.source
       OR event_row.payload->>'job_id' <> expected_job_id::text
       OR (event_row.payload->>'started_at')::timestamptz IS DISTINCT FROM expected_started_at
       OR coalesce(event_row.payload->>'started_at' ~ '^\d{4}-\d{2}-\d{2}T.*Z$', false) = false
       OR (event_row.payload->>'period_days')::integer <> sample.period_days
       OR event_row.payload ? 'period_group' THEN
      RAISE EXCEPTION 'run % has incorrect source event metadata: %', sample.run_id, to_jsonb(event_row);
    END IF;

    IF event_row.message ~ '(UTC|[0-9]{4}-[0-9]{2}-[0-9]{2})' THEN
      RAISE EXCEPTION 'run % source message must not contain an absolute UTC date: %', sample.run_id, event_row.message;
    END IF;

    IF sample.source IN ('reused', 'kept_previous') THEN
      SELECT finished_at INTO expected_finished_at FROM public.studio_catalog_jobs WHERE id = expected_job_id;
      IF (event_row.payload->>'finished_at')::timestamptz IS DISTINCT FROM expected_finished_at
         OR (event_row.payload->>'expires_at')::timestamptz IS DISTINCT FROM expected_finished_at + make_interval(days => sample.period_days) THEN
        RAISE EXCEPTION 'run % does not record the job completion and expiry: %', sample.run_id, event_row.payload;
      END IF;
      IF coalesce(event_row.payload->>'finished_at' ~ '^\d{4}-\d{2}-\d{2}T.*Z$', false) = false
         OR coalesce(event_row.payload->>'expires_at' ~ '^\d{4}-\d{2}-\d{2}T.*Z$', false) = false THEN
        RAISE EXCEPTION 'run % source timestamps are not ISO UTC: %', sample.run_id, event_row.payload;
      END IF;
    ELSE
      IF event_row.payload->>'finished_at' IS NOT NULL OR event_row.payload->>'expires_at' IS NOT NULL THEN
        RAISE EXCEPTION 'run % unexpectedly has a completed-job expiry: %', sample.run_id, event_row.payload;
      END IF;
    END IF;
  END LOOP;

  IF (SELECT (payload->>'period_days')::integer FROM public.studio_run_events WHERE run_id='eeee7777-3333-4000-8000-000000000008' AND step_key='catalog_research') <> 20 THEN
    RAISE EXCEPTION 'multiple-group event must carry the period of the course';
  END IF;
  IF (SELECT message FROM public.studio_run_events WHERE run_id='eeee7777-3333-4000-8000-000000000002' AND step_key='catalog_research') NOT LIKE '%cách đây % ngày, còn hiệu lực % ngày (kỳ 20 ngày của khóa)%' THEN
    RAISE EXCEPTION 'reused multiple-group message must identify the period of the course';
  END IF;
  IF (SELECT message FROM public.studio_run_events WHERE run_id='eeee7777-3333-4000-8000-000000000010' AND step_key='catalog_research') NOT LIKE '%Giữ nguyên kết quả nghiên cứu của lượt trước dù đã quá hạn % ngày%' THEN
    RAISE EXCEPTION 'expired resumed result message is incorrect';
  END IF;
  IF (SELECT message FROM public.studio_run_events WHERE run_id='eeee7777-3333-4000-8000-000000000004' AND step_key='catalog_research') NOT LIKE '%Gắn vào job nghiên cứu đang chạy, đã chạy % phút%' THEN
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

DO $test$
DECLARE
  owner_id uuid := 'b8100000-0000-4000-8000-000000000001';
  reporter uuid := 'b8100000-0000-4000-8000-000000000002';
  staff uuid := 'b8100000-0000-4000-8000-000000000003';
  project uuid := gen_random_uuid();
  draft uuid := gen_random_uuid();
  bad_hash text;
  hidden boolean;
  i integer;
  claimed_fields text[];
BEGIN
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
    (owner_id,'mq-owner@corelia.local','{}'),(reporter,'mq-reporter@corelia.local','{}'),(staff,'mq-staff@corelia.local','{}');
  UPDATE public.profiles SET role='admin' WHERE id=staff;
  INSERT INTO public.projects(id,owner_id,slug,title,summary,description,source_type,visibility) VALUES
    (project,owner_id,'mq-public','Public title','Safe summary','Bad description','standalone','public'),
    (draft,owner_id,'mq-draft','Draft title','Bad description','Story','standalone','private');
  INSERT INTO public.project_locales(project_id,locale,data) VALUES (project,'vi','{"title":"Tiêu đề"}');

  -- Same hash as the Edge (sha256 of trimmed text).
  IF private.moderation_text_hash('hello') <> '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824' THEN
    RAISE EXCEPTION 'SQL text hash differs from the Edge hash';
  END IF;
  bad_hash := private.moderation_text_hash('Bad description');

  PERFORM set_config('role','service_role',true);
  PERFORM public.record_moderation_results(jsonb_build_array(
    jsonb_build_object('hash',private.moderation_text_hash('Public title'),'flagged',false),
    jsonb_build_object('hash',bad_hash,'flagged',true,'categories',jsonb_build_array('harassment')),
    jsonb_build_object('hash','not-a-hash','flagged',true)
  ),'omni-moderation-latest');
  IF (SELECT count(*) FROM private.moderation_results WHERE content_hash IN (bad_hash,'not-a-hash')) <> 1 THEN
    RAISE EXCEPTION 'record_moderation_results accepted an invalid hash';
  END IF;
  IF NOT (SELECT flagged FROM public.project_moderation_verdicts(project,ARRAY[bad_hash])) THEN
    RAISE EXCEPTION 'cached flagged verdict missing';
  END IF;

  -- Debounced queue entries wait; a claimed project returns all texts with cached verdicts.
  PERFORM public.enqueue_project_moderation(project,60);
  IF EXISTS (SELECT 1 FROM public.claim_project_moderation(10) WHERE project_id=project) THEN
    RAISE EXCEPTION 'debounced moderation was claimed early';
  END IF;
  PERFORM public.enqueue_project_moderation(project,0);
  PERFORM public.enqueue_project_moderation(draft,0);
  SELECT array_agg(field ORDER BY field) INTO claimed_fields FROM public.claim_project_moderation(10) WHERE project_id=project AND field IS NOT NULL;
  IF claimed_fields <> ARRAY['description','summary','title','vi.title'] THEN
    RAISE EXCEPTION 'claim returned the wrong texts: %', claimed_fields;
  END IF;
  IF EXISTS (SELECT 1 FROM public.claim_project_moderation(10) WHERE project_id=project) THEN
    RAISE EXCEPTION 'leased project was claimed twice';
  END IF;

  -- Flagged text hides a published project, but only records a private draft.
  hidden := public.finish_project_moderation(project,ARRAY['description']);
  IF NOT hidden OR NOT (SELECT blocked AND visibility='private' FROM public.projects WHERE id=project)
    OR NOT EXISTS (SELECT 1 FROM private.project_moderation_audit WHERE project_id=project AND actor_id IS NULL AND action='block') THEN
    RAISE EXCEPTION 'flagged public project was not hidden';
  END IF;
  hidden := public.finish_project_moderation(draft,ARRAY['summary']);
  IF hidden OR (SELECT blocked FROM public.projects WHERE id=draft) OR EXISTS (SELECT 1 FROM private.project_moderation_queue WHERE project_id IN (project,draft)) THEN
    RAISE EXCEPTION 'private draft was blocked or queue not cleared';
  END IF;

  -- A staff unblock allows the reviewed flagged text for that project only.
  RESET ROLE;
  UPDATE public.projects SET blocked=false, visibility='public' WHERE id=project;
  PERFORM set_config('role','service_role',true);
  PERFORM public.allow_project_moderation_overrides(staff,project);
  IF (SELECT flagged FROM public.project_moderation_verdicts(project,ARRAY[bad_hash]))
    OR NOT (SELECT flagged FROM public.project_moderation_verdicts(draft,ARRAY[bad_hash])) THEN
    RAISE EXCEPTION 'allowlist leaked across projects or was not applied';
  END IF;
  RESET ROLE;

  -- Reports: signed-in non-owners only, one open report each, raises priority, capped per day.
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',reporter,'role','authenticated')::text,true);
  PERFORM public.report_project(project,'spam','Looks like an ad');
  PERFORM public.report_project(project,'spam',NULL);
  BEGIN
    PERFORM public.report_project(draft,'spam',NULL);
    RAISE EXCEPTION 'private project was reportable';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%not_found:project%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.list_reported_projects(20,0);
    RAISE EXCEPTION 'non-staff listed reports';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%forbidden:project_reports%' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM public.project_reports WHERE project_id=project) <> 1 THEN
    RAISE EXCEPTION 'reporter could see or create duplicate open reports';
  END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',owner_id,'role','authenticated')::text,true);
  BEGIN
    PERFORM public.report_project(project,'spam',NULL);
    RAISE EXCEPTION 'owner reported own project';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%project_report_self%' THEN RAISE; END IF; END;
  RESET ROLE;
  IF NOT EXISTS (SELECT 1 FROM private.project_moderation_queue WHERE project_id=project AND priority=1 AND run_after <= clock_timestamp()) THEN
    RAISE EXCEPTION 'report did not queue an immediate check';
  END IF;
  UPDATE public.project_reports SET status='dismissed' WHERE project_id=project;
  INSERT INTO public.project_reports(project_id,reporter_id,reason,status,created_at)
  SELECT project,reporter,'spam','dismissed',clock_timestamp() FROM generate_series(1,19);
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',reporter,'role','authenticated')::text,true);
  BEGIN
    PERFORM public.report_project(project,'hate',NULL);
    RAISE EXCEPTION 'daily report cap not enforced';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%rate_limited:project_report%' THEN RAISE; END IF; END;
  RESET ROLE;

  -- Staff review list and resolution.
  DELETE FROM public.project_reports WHERE project_id=project;
  INSERT INTO public.project_reports(project_id,reporter_id,reason,note) VALUES (project,reporter,'plagiarism','copied');
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',staff,'role','authenticated')::text,true);
  IF (SELECT open_reports FROM public.list_reported_projects(20,0) WHERE project_id=project) <> 1 THEN
    RAISE EXCEPTION 'staff list missing the reported project';
  END IF;
  PERFORM public.resolve_project_reports(project,'dismissed');
  IF EXISTS (SELECT 1 FROM public.list_reported_projects(20,0) WHERE project_id=project) THEN
    RAISE EXCEPTION 'resolved reports still listed';
  END IF;
  BEGIN
    PERFORM public.claim_project_moderation(5);
    RAISE EXCEPTION 'browser role can claim moderation work';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='corelia-project-moderation') THEN
    RAISE EXCEPTION 'moderation worker is not scheduled';
  END IF;
  DELETE FROM public.projects WHERE id IN (project,draft);
  DELETE FROM private.moderation_results WHERE content_hash IN (bad_hash, private.moderation_text_hash('Public title'));
  DELETE FROM auth.users WHERE id IN (owner_id,reporter,staff);
END;
$test$;

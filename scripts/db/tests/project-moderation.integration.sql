DO $test$
DECLARE
 v_owner uuid := 'a7910000-0000-4000-8000-000000000001';
 v_other uuid := 'a7910000-0000-4000-8000-000000000002';
 v_admin uuid := 'a7910000-0000-4000-8000-000000000003';
 v_project uuid := 'a7910000-0000-4000-8000-000000000010';
BEGIN
 BEGIN
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
    (v_owner,'project-owner@corelia.local','{}'),(v_other,'project-other@corelia.local','{}'),(v_admin,'project-admin@corelia.local','{}');
  UPDATE public.profiles SET role='admin' WHERE id=v_admin;
  INSERT INTO public.projects(id,owner_id,title,slug,summary,description,visibility,source_type)
    VALUES(v_project,v_owner,'Moderation QA','moderation-qa','Summary','Detailed story','public','standalone');
  IF has_function_privilege('authenticated','public.manage_project(uuid,uuid,text,text)','EXECUTE') OR
    has_function_privilege('anon','public.manage_project(uuid,uuid,text,text)','EXECUTE') OR
    has_table_privilege('authenticated','public.projects','DELETE') OR
    has_table_privilege('authenticated','public.projects','UPDATE') OR
    has_table_privilege('authenticated','private.project_moderation_audit','SELECT') THEN
    RAISE EXCEPTION 'Client management boundary exposed';
  END IF;
  INSERT INTO public.hackathons(id,document,status) VALUES('moderation-qa-event','{}','draft');
  INSERT INTO public.hackathon_submissions(id,hackathon_id,user_id,project_id) VALUES('moderation-qa-submission','moderation-qa-event',v_owner,v_project);
  SET LOCAL ROLE service_role;
  BEGIN
    PERFORM public.manage_project(v_other,v_project,'delete',NULL);
    RAISE EXCEPTION 'Cross-owner deletion allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'forbidden:project_manage' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.manage_project(v_owner,v_project,'block','Cannot self moderate');
    RAISE EXCEPTION 'Owner moderation allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'forbidden:project_manage' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.manage_project(v_admin,v_project,'block',' ');
    RAISE EXCEPTION 'Missing reason accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'invalid_input:moderation_reason' THEN RAISE; END IF; END;
  PERFORM public.manage_project(v_admin,v_project,'block','Policy violation');
  RESET ROLE;
  IF NOT (SELECT blocked AND visibility='private' FROM public.projects WHERE id=v_project) THEN RAISE EXCEPTION 'Block failed'; END IF;
  SET LOCAL ROLE anon;
  IF EXISTS(SELECT 1 FROM public.projects WHERE id=v_project) THEN RAISE EXCEPTION 'Blocked project exposed to anon'; END IF;
  RESET ROLE;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_other,'role','authenticated')::text,true);
  IF EXISTS(SELECT 1 FROM public.projects WHERE id=v_project) THEN RAISE EXCEPTION 'Blocked project exposed to other user'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_owner,'role','authenticated')::text,true);
  IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id=v_project) THEN RAISE EXCEPTION 'Owner cannot see moderation status'; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims','{}',true);
  SET LOCAL ROLE service_role;
  BEGIN
    UPDATE public.projects SET visibility='public' WHERE id=v_project;
    RAISE EXCEPTION 'Save bypasses block';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'forbidden:project_blocked' THEN RAISE; END IF; END;
  PERFORM public.manage_project(v_admin,v_project,'unblock','Reviewed');
  IF (SELECT visibility FROM public.projects WHERE id=v_project)<>'private' THEN RAISE EXCEPTION 'Unblock republished automatically'; END IF;
  PERFORM public.manage_project(v_admin,v_project,'unlisted','Reviewed');
  PERFORM public.manage_project(v_admin,v_project,'public','Reviewed');
  PERFORM public.manage_project(v_admin,v_project,'private','Reviewed');
  PERFORM public.manage_project(v_owner,v_project,'delete',NULL);
  IF EXISTS(SELECT 1 FROM public.projects WHERE id=v_project) OR EXISTS(SELECT 1 FROM public.hackathon_submissions WHERE id='moderation-qa-submission') THEN RAISE EXCEPTION 'Owner delete/withdrawal failed'; END IF;
  BEGIN
    INSERT INTO public.projects(id,owner_id,title,slug,visibility,source_type) VALUES(v_project,v_owner,'Stale editor','moderation-qa','private','standalone');
    RAISE EXCEPTION 'Deleted ID recreated';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'conflict:project_deleted' THEN RAISE; END IF; END;
  RESET ROLE;
  IF (SELECT count(*) FROM private.project_moderation_audit WHERE project_id=v_project AND actor_id IN (v_owner,v_admin))<>6 THEN RAISE EXCEPTION 'Audit missing'; END IF;
  INSERT INTO public.projects(id,owner_id,title,slug,visibility,source_type) VALUES('a7910000-0000-4000-8000-000000000011',v_other,'Admin delete QA','admin-delete-qa','private','standalone');
  SET LOCAL ROLE service_role;
  PERFORM public.manage_project(v_admin,'a7910000-0000-4000-8000-000000000011','delete','Policy violation');
  RESET ROLE;
  IF EXISTS(SELECT 1 FROM public.projects WHERE id='a7910000-0000-4000-8000-000000000011') THEN RAISE EXCEPTION 'Admin delete failed'; END IF;
  RAISE SQLSTATE 'Z0001' USING MESSAGE='rollback fixtures';
 EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;
 END;
END;
$test$;

DO $transfer$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_project uuid := gen_random_uuid();
  v_conflict uuid := gen_random_uuid();
  v_target jsonb := '{"tracks":[{"id":"track"}],"sectors":[{"id":"sector"}],"tech_stacks":[{"id":"tech"}]}';
BEGIN
  BEGIN
    INSERT INTO auth.users(id,email) VALUES
      (v_owner,'transfer-owner@corelia.local'),
      (v_staff,'transfer-staff@corelia.local'),
      (v_other,'transfer-other@corelia.local');
    UPDATE public.profiles SET role='support_staff' WHERE id=v_staff;
    INSERT INTO public.hackathons(id,status,document) VALUES
      ('transfer-source','ended',v_target||jsonb_build_object('winner_awards',jsonb_build_array(jsonb_build_object('project_id',v_project,'label','Winner')))),
      ('transfer-target','draft',v_target),('transfer-conflict','draft',v_target);
    INSERT INTO public.projects(id,owner_id,slug,title,source_type,visibility)
      VALUES(v_project,v_owner,'transfer-project','Transfer project','standalone','private');
    IF has_function_privilege('authenticated','public.transfer_project_hackathon(uuid,uuid,text,text[],text)','EXECUTE') THEN
      RAISE EXCEPTION 'Transfer RPC exposed to browser';
    END IF;
    SET LOCAL ROLE service_role;
    BEGIN
      PERFORM public.transfer_project_hackathon(v_other,v_project,'transfer-target',ARRAY['track'],'Test');
      RAISE EXCEPTION 'Non-staff moved a project';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM<>'forbidden:project_transfer' THEN RAISE; END IF;
    END;
    PERFORM public.transfer_project_hackathon(v_staff,v_project,'transfer-source',ARRAY['track'],'Import legacy project');
    UPDATE public.hackathon_submissions SET document=document||'{"score":99}'::jsonb WHERE project_id=v_project;
    PERFORM public.transfer_project_hackathon(v_staff,v_project,'transfer-target',ARRAY['track'],'Move between hackathons');
    IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id=v_project AND owner_id=v_owner AND source_id='transfer-target'
      AND source_submission_id='transfer-target_'||v_owner::text AND visibility='private') OR
      NOT EXISTS(SELECT 1 FROM public.hackathon_submissions WHERE project_id=v_project AND hackathon_id='transfer-target') OR
      NOT EXISTS(SELECT 1 FROM public.hackathon_registrations WHERE hackathon_id='transfer-target' AND user_id=v_owner AND document->>'status'='approved') THEN
      RAISE EXCEPTION 'Transfer did not atomically move project and register owner';
    END IF;
    IF EXISTS(SELECT 1 FROM public.hackathon_submissions WHERE hackathon_id='transfer-source' AND project_id=v_project) THEN
      RAISE EXCEPTION 'Old submission remained after moving between hackathons';
    END IF;
    IF EXISTS(SELECT 1 FROM public.hackathon_submissions WHERE project_id=v_project AND document ? 'score') THEN
      RAISE EXCEPTION 'Old scoring metadata copied to destination';
    END IF;
    PERFORM public.transfer_project_hackathon(v_staff,v_project,'transfer-target',ARRAY['track'],'Retry');
    IF (SELECT count(*) FROM public.hackathon_submissions WHERE project_id=v_project)<>1 THEN
      RAISE EXCEPTION 'Transfer retry duplicated submission';
    END IF;
    UPDATE public.projects SET blocked=true,visibility='private' WHERE id=v_project;
    UPDATE public.hackathons SET document=jsonb_set(document,'{submission_deadline}',to_jsonb(clock_timestamp()-interval '1 day'))
      WHERE id='transfer-target';
    BEGIN
      PERFORM public.save_ai_gated_project(v_owner,v_project,'transfer-project','Owner edit');
      RAISE EXCEPTION 'Owner edited a blocked project';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM<>'forbidden:project_blocked' THEN RAISE; END IF;
    END;
    PERFORM public.save_ai_gated_project(v_staff,v_project,'transfer-project','Staff edit',p_visibility=>'public',
      p_track_ids=>ARRAY['track'],p_sector_ids=>ARRAY['sector'],p_tech_stack_ids=>ARRAY['tech']);
    IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id=v_project AND title='Staff edit' AND visibility='private' AND blocked) THEN
      RAISE EXCEPTION 'Staff edit republished a blocked project';
    END IF;
    PERFORM public.save_ai_gated_project_locale(v_staff,v_project,'en','{"title":"Staff translation"}');
    PERFORM public.reserve_project_translation(v_staff,v_project);
    IF NOT EXISTS(SELECT 1 FROM public.project_locales WHERE project_id=v_project AND locale='en' AND data->>'title'='Staff translation') THEN
      RAISE EXCEPTION 'Staff cannot edit translations on blocked project';
    END IF;
    INSERT INTO public.projects(id,owner_id,slug,title,source_type,visibility)
      VALUES(v_conflict,v_owner,'other-transfer-project','Existing project','standalone','private');
    PERFORM public.transfer_project_hackathon(v_staff,v_conflict,'transfer-conflict',ARRAY['track'],'Seed');
    BEGIN
      PERFORM public.transfer_project_hackathon(v_staff,v_project,'transfer-conflict',ARRAY['track'],'Conflict');
      RAISE EXCEPTION 'Existing owner submission was overwritten';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM<>'conflict:hackathon_project_exists' THEN RAISE; END IF;
    END;
    IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id=v_project AND source_id='transfer-target') THEN
      RAISE EXCEPTION 'Conflict partially moved project';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM private.project_moderation_audit WHERE project_id=v_project AND actor_id=v_staff AND action='transfer_hackathon') THEN
      RAISE EXCEPTION 'Transfer audit missing';
    END IF;
    RESET ROLE;
    IF NOT EXISTS(SELECT 1 FROM public.hackathons WHERE id='transfer-source' AND document->'winner_awards'->0->>'project_id'=v_project::text) THEN
      RAISE EXCEPTION 'Historical award was removed';
    END IF;
    RAISE SQLSTATE 'Z0001' USING MESSAGE='rollback transfer fixtures';
  EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;
  END;
END;
$transfer$;

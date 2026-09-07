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

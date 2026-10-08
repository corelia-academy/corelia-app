BEGIN;
DO $test$
DECLARE
  actor uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); staff uuid:=gen_random_uuid(); departing uuid:=gen_random_uuid();
  event text:=gen_random_uuid()::text; project uuid:=gen_random_uuid(); standalone uuid:=gen_random_uuid();
  invitation json; second_invitation json; candidate_count integer;
BEGIN
  INSERT INTO auth.users(id) VALUES(actor),(outsider),(staff),(departing);
  UPDATE public.profiles SET role='admin' WHERE id=staff;
  INSERT INTO public.hackathons(id,status,document) VALUES(event,'published',jsonb_build_object(
    'slug','policy-event','registration_deadline',clock_timestamp()-interval '1 day',
    'submission_deadline',clock_timestamp()+interval '1 day',
    'tracks','[{"id":"track"}]'::jsonb,'sectors','[{"id":"sector","name":"Sector"}]'::jsonb,
    'tech_stacks','[{"id":"tech","name":"Tech"}]'::jsonb));
  IF EXISTS(SELECT 1 FROM public.hackathons WHERE id=event AND (document ? 'registration_deadline'
    OR document->'winners_announced'<>'false'::jsonb OR document->'allow_project_edits_after_deadline'<>'false'::jsonb)) THEN
    RAISE EXCEPTION 'Legacy deadline or non-default policy survived';
  END IF;
  INSERT INTO public.hackathon_registrations(id,hackathon_id,user_id,document)
    VALUES(event||'_'||actor::text,event,actor,'{"status":"registered"}'),
      (event||'_'||departing::text,event,departing,'{"status":"registered"}');
  INSERT INTO public.projects(id,owner_id,slug,title,summary,description,source_type,source_id,
    hackathon_track_ids,hackathon_sector_ids,hackathon_tech_stack_ids)
    VALUES(project,actor,'policy-project','Project','Summary','Story','hackathon',event,ARRAY['track'],ARRAY['sector'],ARRAY['tech']);
  INSERT INTO public.project_collaborators(project_id,user_id,role,show_in_portfolio) VALUES(project,departing,'contributor',true);
  INSERT INTO public.projects(id,owner_id,slug,title,source_type,visibility)
    VALUES(standalone,actor,'policy-standalone','Standalone','standalone','private');
  IF private.is_project_team_candidate(project,outsider) THEN RAISE EXCEPTION 'Unregistered user eligible before deadline'; END IF;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.project_collaborators SET project_id=standalone WHERE project_id=project AND user_id=departing;
    RAISE EXCEPTION 'Membership identity reassigned';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%project_team_identity%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.create_project_collaboration_invite(project,outsider);
    RAISE EXCEPTION 'Unregistered user invited before deadline';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%invitee_not_eligible%' THEN RAISE; END IF; END;
  RESET ROLE;
  UPDATE public.hackathons SET document=jsonb_set(document,'{submission_deadline}',to_jsonb(clock_timestamp()-interval '1 day')) WHERE id=event;
  SET LOCAL ROLE service_role;
  BEGIN
    PERFORM public.assert_project_content_editable(actor,project);
    RAISE EXCEPTION 'Closed media/content guard allowed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%submission_deadline_passed%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.save_ai_gated_project_locale(actor,project,'en','{"title":"Closed translation"}');
    RAISE EXCEPTION 'Closed translation allowed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%submission_deadline_passed%' THEN RAISE; END IF; END;
  PERFORM public.assert_project_content_editable(actor,standalone);
  PERFORM public.assert_project_content_editable(staff,project);
  BEGIN
    PERFORM public.transfer_project_hackathon(staff,standalone,event,ARRAY['track'],'Late transfer');
    RAISE EXCEPTION 'Late transfer allowed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%submission_deadline_passed%' THEN RAISE; END IF; END;

  RESET ROLE;
  DELETE FROM auth.users WHERE id=departing;
  UPDATE public.hackathons SET document=jsonb_set(document,'{allow_project_edits_after_deadline}','true') WHERE id=event;
  SET LOCAL ROLE service_role;
  PERFORM * FROM public.save_ai_gated_project(p_actor_id=>actor,p_project_id=>project,p_slug=>'policy-project',
    p_title=>'Updated',p_summary=>'Summary',p_description=>'Updated story',p_track_ids=>ARRAY['track'],p_sector_ids=>ARRAY['sector'],p_tech_stack_ids=>ARRAY['tech']);
  PERFORM public.save_ai_gated_project_locale(actor,project,'en','{"title":"Reopened translation"}');
  BEGIN
    PERFORM * FROM public.save_ai_gated_project(p_actor_id=>actor,p_project_id=>gen_random_uuid(),p_slug=>'policy-new',
      p_title=>'New',p_summary=>'Summary',p_description=>'Story',p_source_type=>'hackathon',p_source_id=>event,
      p_track_ids=>ARRAY['track'],p_sector_ids=>ARRAY['sector'],p_tech_stack_ids=>ARRAY['tech']);
    RAISE EXCEPTION 'Early edit flag opened new submission';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%submission_deadline_passed%' THEN RAISE; END IF; END;
  RESET ROLE;
  BEGIN
    INSERT INTO public.hackathon_registrations(id,hackathon_id,user_id,document)
      VALUES(event||'_'||outsider::text,event,outsider,'{}');
    RAISE EXCEPTION 'Early edit flag opened registration';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%submission_deadline_passed%' THEN RAISE; END IF; END;
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO candidate_count FROM public.list_project_team_candidates(project,'hackathon',event,'',100) WHERE user_id=outsider;
  IF candidate_count<>1 THEN RAISE EXCEPTION 'Late collaborator missing from candidates'; END IF;
  SELECT public.create_project_collaboration_invite(project,outsider) INTO invitation;
  RESET ROLE;
  UPDATE public.hackathons SET document=jsonb_set(document,'{allow_project_edits_after_deadline}','false') WHERE id=event;
  PERFORM set_config('request.jwt.claim.sub',outsider::text,true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.accept_project_collaboration_invite_by_id((invitation->>'invite_id')::uuid);
    RAISE EXCEPTION 'Accepted invitation while locked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%submission_deadline_passed%' AND SQLERRM NOT LIKE '%invitee_not_eligible%' THEN RAISE; END IF;
  END;
  RESET ROLE;
  UPDATE public.hackathons SET document=jsonb_set(document,'{winners_announced}','true') WHERE id=event;
  SET LOCAL ROLE authenticated;
  PERFORM public.accept_project_collaboration_invite(invitation->>'token');
  RESET ROLE;
  IF NOT EXISTS(SELECT 1 FROM public.project_collaborators WHERE project_id=project AND user_id=outsider)
    OR EXISTS(SELECT 1 FROM public.hackathon_registrations WHERE hackathon_id=event AND user_id=outsider) THEN
    RAISE EXCEPTION 'Late acceptance did not remain project-only';
  END IF;
  UPDATE public.hackathons SET document=jsonb_set(document,'{winners_announced}','false') WHERE id=event;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.remove_project_collaborator(project,outsider);
    RAISE EXCEPTION 'Removed team member while locked';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%submission_deadline_passed%' THEN RAISE; END IF; END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub',outsider::text,true);
  SET LOCAL ROLE authenticated;
  PERFORM public.leave_project(project);
  RESET ROLE;
  UPDATE public.hackathons SET document=jsonb_set(document,'{winners_announced}','true') WHERE id=event;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  SET LOCAL ROLE authenticated;
  SELECT public.create_project_collaboration_invite(project,outsider) INTO second_invitation;
  RESET ROLE;
  UPDATE public.hackathons SET document=jsonb_set(document,'{winners_announced}','false') WHERE id=event;
  SET LOCAL ROLE authenticated;
  PERFORM public.revoke_project_collaboration_invite((second_invitation->>'invite_id')::uuid);
  RESET ROLE;
  SET LOCAL ROLE service_role;
  PERFORM public.manage_project(staff,project,'block','Policy test block');
  RESET ROLE;
  UPDATE public.hackathons SET document=jsonb_set(document,'{winners_announced}','true') WHERE id=event;
  SET LOCAL ROLE service_role;
  BEGIN
    PERFORM public.assert_project_content_editable(actor,project);
    RAISE EXCEPTION 'Announcement bypassed block';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%project_blocked%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.assert_project_content_editable(outsider,project);
    RAISE EXCEPTION 'Announcement bypassed ownership';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%project_update%' THEN RAISE; END IF; END;
  RESET ROLE;
  IF private.hackathon_submission_deadline('{"ends_at":"2026-01-01T00:00:00Z"}')<>'2026-01-01T00:00:00Z'::timestamptz
    OR NOT private.hackathon_project_edits_open('{}')
    OR private.hackathon_project_edits_open('{"submission_deadline":"2020-01-01T00:00:00Z"}') THEN
    RAISE EXCEPTION 'Fallback/default deadline policy differs';
  END IF;
END;
$test$;
ROLLBACK;

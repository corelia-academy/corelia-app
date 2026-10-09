BEGIN;
DO $test$
DECLARE actor uuid:=gen_random_uuid(); project uuid:=gen_random_uuid(); member uuid;
  members uuid[]:='{}'; invitation json; late_invitation json; i integer;
BEGIN
  INSERT INTO auth.users(id) VALUES(actor);
  INSERT INTO public.projects(id,owner_id,slug,title,source_type,visibility)
    VALUES(project,actor,'team-capacity-fixture','Team capacity','standalone','private');
  FOR i IN 1..7 LOOP
    member:=gen_random_uuid(); members:=array_append(members,member);
    INSERT INTO auth.users(id) VALUES(member);
  END LOOP;
  FOR i IN 1..4 LOOP
    PERFORM set_config('request.jwt.claim.sub',actor::text,true); SET LOCAL ROLE authenticated;
    SELECT public.create_project_collaboration_invite(project,members[i]) INTO invitation;
    PERFORM set_config('request.jwt.claim.sub',members[i]::text,true);
    PERFORM public.accept_project_collaboration_invite_by_id((invitation->>'invite_id')::uuid);
    RESET ROLE;
  END LOOP;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true); SET LOCAL ROLE authenticated;
  SELECT public.create_project_collaboration_invite(project,members[5]) INTO invitation;
  SELECT public.create_project_collaboration_invite(project,members[6]) INTO late_invitation;
  PERFORM set_config('request.jwt.claim.sub',members[5]::text,true);
  PERFORM public.accept_project_collaboration_invite_by_id((invitation->>'invite_id')::uuid);
  RESET ROLE;
  IF (SELECT count(*) FROM public.project_collaborators WHERE project_id=project)<>5 THEN
    RAISE EXCEPTION 'Six-person team was not accepted'; END IF;
  -- An owner row is the same person, but replacing that owner cannot add a seventh.
  INSERT INTO public.project_collaborators(project_id,user_id) VALUES(project,actor);
  BEGIN
    UPDATE public.projects SET owner_id=members[7] WHERE id=project;
    RAISE EXCEPTION 'Ownership change added a seventh person';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%project_identity%' THEN RAISE; END IF; END;
  DELETE FROM public.project_collaborators WHERE project_id=project AND user_id=actor;
  -- Existing membership upserts are not new seats.
  INSERT INTO public.project_collaborators(project_id,user_id) VALUES(project,members[5]) ON CONFLICT DO NOTHING;
  PERFORM set_config('request.jwt.claim.sub',members[6]::text,true); SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.accept_project_collaboration_invite(late_invitation->>'token');
    RAISE EXCEPTION 'Seventh person accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%project_team_full%' THEN RAISE; END IF; END;
  RESET ROLE;
  BEGIN
    INSERT INTO public.project_collaborators(project_id,user_id) VALUES(project,members[6]);
    RAISE EXCEPTION 'Direct insertion bypassed capacity';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%project_team_full%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true); SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.create_project_collaboration_invite(project,members[7]);
    RAISE EXCEPTION 'Full team invited another person';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%project_team_full%' THEN RAISE; END IF; END;
  PERFORM public.remove_project_collaborator(project,members[1]);
  PERFORM set_config('request.jwt.claim.sub',members[6]::text,true);
  PERFORM public.accept_project_collaboration_invite_by_id((late_invitation->>'invite_id')::uuid);
  RESET ROLE;
  IF (SELECT count(*) FROM public.project_collaborators WHERE project_id=project)<>5 THEN
    RAISE EXCEPTION 'Freed seat could not be filled'; END IF;

  -- Simulate a pre-migration oversized team. Preserve it; reject new seats.
  ALTER TABLE public.project_collaborators DISABLE TRIGGER trg_project_member_capacity;
  INSERT INTO public.project_collaborators(project_id,user_id) VALUES(project,members[1]);
  ALTER TABLE public.project_collaborators ENABLE TRIGGER trg_project_member_capacity;
  IF (SELECT count(*) FROM public.project_collaborators WHERE project_id=project)<>6 THEN
    RAISE EXCEPTION 'Legacy oversized team was truncated'; END IF;
  BEGIN
    INSERT INTO public.project_collaborators(project_id,user_id) VALUES(project,members[7]);
    RAISE EXCEPTION 'Legacy oversized team added another person';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%project_team_full%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true); SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.create_project_collaboration_invite(project,gen_random_uuid());
    RAISE EXCEPTION 'Oversized team invited invalid account';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%invitee_not_eligible%' THEN RAISE; END IF; END;
  PERFORM public.remove_project_collaborator(project,members[6]);
  BEGIN
    PERFORM public.create_project_collaboration_invite(project,members[6]);
    RAISE EXCEPTION 'Oversized team added another person';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%project_team_full%' THEN RAISE; END IF; END;
  RESET ROLE;
  IF (SELECT count(*) FROM public.project_collaborators WHERE project_id=project)<>5 THEN
    RAISE EXCEPTION 'Legacy members were unexpectedly removed'; END IF;
END;
$test$;
ROLLBACK;

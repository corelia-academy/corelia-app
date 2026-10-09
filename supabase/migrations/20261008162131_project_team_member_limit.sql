-- Six people total: the owner plus five accepted collaborators. Pending invites
-- do not reserve seats; acceptance checks capacity again under the project lock.
CREATE FUNCTION private.enforce_project_team_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_owner uuid; v_user uuid; v_count integer;
BEGIN
  -- Serialize invitations and acceptances, including concurrent last-seat writes.
  SELECT owner_id INTO v_owner FROM public.projects WHERE id=NEW.project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found:project'; END IF;
  IF TG_TABLE_NAME = 'project_collaboration_invites' THEN v_user:=NEW.invitee_user_id;
  ELSE v_user:=NEW.user_id; END IF;
  -- Idempotent membership inserts and an owner row do not add another person.
  IF v_user=v_owner OR EXISTS (SELECT 1 FROM public.project_collaborators
    WHERE project_id=NEW.project_id AND user_id=v_user) THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_count FROM public.project_collaborators
    WHERE project_id=NEW.project_id AND user_id<>v_owner;
  IF v_count+1>=6 THEN RAISE EXCEPTION 'conflict:project_team_full'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enforce_project_team_capacity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_project_member_capacity BEFORE INSERT ON public.project_collaborators
  FOR EACH ROW EXECUTE FUNCTION private.enforce_project_team_capacity();
CREATE TRIGGER trg_project_invite_capacity BEFORE INSERT ON public.project_collaboration_invites
  FOR EACH ROW EXECUTE FUNCTION private.enforce_project_team_capacity();

-- One deadline for registration/new submissions; reopening only affects existing projects.
CREATE FUNCTION private.hackathon_submission_deadline(p_document jsonb)
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT COALESCE(NULLIF(p_document->>'submission_deadline','')::timestamptz,
                  NULLIF(p_document->>'ends_at','')::timestamptz);
$$;
CREATE FUNCTION private.hackathon_project_edits_open(p_document jsonb)
RETURNS boolean LANGUAGE sql VOLATILE SET search_path = '' AS $$
  SELECT p_document IS NOT NULL AND (
    private.hackathon_submission_deadline(p_document) IS NULL
    OR clock_timestamp() <= private.hackathon_submission_deadline(p_document)
    OR COALESCE(p_document->'winners_announced' = 'true'::jsonb,false)
    OR COALESCE(p_document->'allow_project_edits_after_deadline' = 'true'::jsonb,false)
  );
$$;
REVOKE ALL ON FUNCTION private.hackathon_submission_deadline(jsonb),
  private.hackathon_project_edits_open(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.hackathon_submission_deadline(jsonb),
  private.hackathon_project_edits_open(jsonb) TO service_role;

-- Strip the removed field even when an older client submits it again.
CREATE FUNCTION private.normalize_hackathon_edit_policy()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.document := NEW.document - 'registration_deadline';
  IF (NEW.document ? 'winners_announced' AND jsonb_typeof(NEW.document->'winners_announced') <> 'boolean')
    OR (NEW.document ? 'allow_project_edits_after_deadline' AND jsonb_typeof(NEW.document->'allow_project_edits_after_deadline') <> 'boolean') THEN
    RAISE EXCEPTION 'invalid_input:hackathon_edit_policy';
  END IF;
  NEW.document := jsonb_build_object('winners_announced',false,'allow_project_edits_after_deadline',false) || NEW.document;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.normalize_hackathon_edit_policy() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_normalize_hackathon_edit_policy BEFORE INSERT OR UPDATE ON public.hackathons
  FOR EACH ROW EXECUTE FUNCTION private.normalize_hackathon_edit_policy();
UPDATE public.hackathons SET document = document - 'registration_deadline';

CREATE OR REPLACE FUNCTION private.enforce_instant_hackathon_registration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_status text; v_document jsonb; v_deadline timestamptz;
BEGIN
  IF pg_catalog.current_setting('role',true)='service_role'
    AND pg_catalog.current_setting('corelia.project_staff_edit',true)='on'
    AND NEW.document->>'source'='project_transfer' THEN RETURN NEW; END IF;
  SELECT h.status,h.document INTO v_status,v_document FROM public.hackathons h WHERE h.id=NEW.hackathon_id;
  IF v_status IS NULL OR v_status NOT IN ('published','running') THEN RAISE EXCEPTION 'forbidden:registration_closed'; END IF;
  v_deadline := private.hackathon_submission_deadline(v_document);
  IF v_deadline IS NOT NULL AND clock_timestamp()>v_deadline THEN
    RAISE EXCEPTION 'forbidden:submission_deadline_passed';
  END IF;
  NEW.document := (NEW.document-'reviewed_at'-'reviewed_by'-'review_note') ||
    jsonb_build_object('status','registered','updated_at',clock_timestamp());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.assert_project_content_editable(p_actor_id uuid, p_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_project public.projects%ROWTYPE; v_document jsonb; v_staff boolean;
BEGIN
  SELECT * INTO v_project FROM public.projects WHERE id=p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found:project'; END IF;
  SELECT role IN ('admin','support_staff') INTO v_staff FROM public.profiles WHERE id=p_actor_id;
  IF p_actor_id IS NULL OR (v_project.owner_id <> p_actor_id AND NOT COALESCE(v_staff,false)) THEN
    RAISE EXCEPTION 'forbidden:project_update';
  END IF;
  IF v_staff THEN RETURN; END IF;
  IF v_project.blocked THEN RAISE EXCEPTION 'forbidden:project_blocked'; END IF;
  IF v_project.source_type IN ('hackathon','contest') THEN
    SELECT document INTO v_document FROM public.hackathons WHERE id=v_project.source_id;
    IF v_document IS NULL THEN RAISE EXCEPTION 'not_found:hackathon'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.hackathon_registrations WHERE hackathon_id=v_project.source_id
      AND user_id=v_project.owner_id AND document->>'status' IN ('registered','approved')) THEN
      RAISE EXCEPTION 'forbidden:registration_required';
    END IF;
    IF NOT COALESCE(private.hackathon_project_edits_open(v_document),false) THEN
      RAISE EXCEPTION 'forbidden:submission_deadline_passed';
    END IF;
  END IF;
END;
$$;
-- Media preflight uses the same guard as saving/localizing existing content.
CREATE FUNCTION public.assert_project_content_editable(p_actor_id uuid, p_project_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.assert_project_content_editable(p_actor_id,p_project_id);
$$;
REVOKE ALL ON FUNCTION public.assert_project_content_editable(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assert_project_content_editable(uuid,uuid) TO service_role;

-- Preserve the established save signature/validation; replace only its deadline gate.
DO $migration$
DECLARE v_sql text; v_old text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'private.save_ai_gated_project(uuid,uuid,text,text,text,text,text,text,text,text,text[],text,text,text,text[],text[],text[])'::regprocedure
  ) INTO v_sql;
  v_old := 'IF NOT COALESCE(v_is_staff,false) AND v_deadline IS NOT NULL AND v_now > v_deadline THEN';
  IF strpos(v_sql,v_old)=0 THEN RAISE EXCEPTION 'project deadline gate changed upstream'; END IF;
  v_sql := replace(v_sql,v_old,
    'IF v_deadline IS NOT NULL AND clock_timestamp() > v_deadline AND (v_is_new OR (NOT COALESCE(v_is_staff,false) AND NOT COALESCE(private.hackathon_project_edits_open(v_document),false))) THEN');
  EXECUTE v_sql;
END;
$migration$;

CREATE OR REPLACE FUNCTION private.enforce_contest_project_submission_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_document jsonb;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.source_type NOT IN ('contest','hackathon') OR NEW.source_id IS NULL
    OR public.is_admin_or_support() OR pg_catalog.current_setting('corelia.project_staff_edit',true)='on' THEN RETURN NEW; END IF;
  SELECT document INTO v_document FROM public.hackathons WHERE id=NEW.source_id;
  IF NOT COALESCE(private.hackathon_project_edits_open(v_document),false) AND (
    NEW.slug IS DISTINCT FROM OLD.slug OR NEW.title IS DISTINCT FROM OLD.title OR
    NEW.summary IS DISTINCT FROM OLD.summary OR NEW.description IS DISTINCT FROM OLD.description OR
    NEW.progress IS DISTINCT FROM OLD.progress OR NEW.demo_url IS DISTINCT FROM OLD.demo_url OR
    NEW.repo_url IS DISTINCT FROM OLD.repo_url OR NEW.slide_url IS DISTINCT FROM OLD.slide_url OR
    NEW.video_url IS DISTINCT FROM OLD.video_url OR NEW.pitch_video_url IS DISTINCT FROM OLD.pitch_video_url OR
    NEW.logo_path IS DISTINCT FROM OLD.logo_path OR NEW.screenshot_paths IS DISTINCT FROM OLD.screenshot_paths OR
    NEW.hackathon_track_ids IS DISTINCT FROM OLD.hackathon_track_ids OR
    NEW.hackathon_sector_ids IS DISTINCT FROM OLD.hackathon_sector_ids OR
    NEW.hackathon_tech_stack_ids IS DISTINCT FROM OLD.hackathon_tech_stack_ids
  ) THEN RAISE EXCEPTION 'forbidden:submission_deadline_passed'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.is_project_team_candidate(p_project_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN p.source_type IN ('contest','hackathon') THEN
    EXISTS (SELECT 1 FROM public.hackathon_registrations hr WHERE hr.hackathon_id=p.source_id
      AND hr.user_id=p_user_id AND hr.document->>'status' IN ('registered','approved'))
    OR (clock_timestamp()>private.hackathon_submission_deadline(h.document)
      AND private.hackathon_project_edits_open(h.document)
      AND EXISTS (SELECT 1 FROM public.public_profiles pp WHERE pp.id=p_user_id))
  ELSE EXISTS (SELECT 1 FROM public.public_profiles pp WHERE pp.id=p_user_id) END
  FROM public.projects p LEFT JOIN public.hackathons h ON h.id=p.source_id
  WHERE p.id=p_project_id;
$$;

-- Enforce the policy at the table boundary, including direct writes and both accept RPCs.
-- Revoking/declining invites and self-leave remain possible while editing is locked.
CREATE FUNCTION private.enforce_project_team_edit_policy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_project public.projects%ROWTYPE; v_document jsonb; v_project_id uuid; v_staff boolean;
BEGIN
  -- Membership identities are created through invitations, never reassigned by UPDATE.
  IF TG_OP='UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.project_id IS DISTINCT FROM OLD.project_id THEN
      RAISE EXCEPTION 'forbidden:project_team_identity';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN
    IF OLD.user_id=auth.uid() OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id=OLD.user_id) THEN RETURN OLD; END IF;
    v_project_id := OLD.project_id;
  ELSE
    v_project_id := NEW.project_id;
  END IF;
  SELECT * INTO v_project FROM public.projects WHERE id=v_project_id;
  IF NOT FOUND THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'not_found:project';
  END IF;
  SELECT role IN ('admin','support_staff') INTO v_staff FROM public.profiles WHERE id=auth.uid();
  IF NOT COALESCE(v_staff,false) AND pg_catalog.current_setting('corelia.project_staff_edit',true) IS DISTINCT FROM 'on' THEN
    IF v_project.blocked THEN RAISE EXCEPTION 'forbidden:project_blocked'; END IF;
    IF v_project.source_type IN ('hackathon','contest') THEN
      SELECT document INTO v_document FROM public.hackathons WHERE id=v_project.source_id;
      IF NOT COALESCE(private.hackathon_project_edits_open(v_document),false) THEN
        RAISE EXCEPTION 'forbidden:submission_deadline_passed';
      END IF;
    END IF;
  END IF;
  IF TG_OP='INSERT' AND v_project.source_type IN ('hackathon','contest') THEN
    IF TG_TABLE_NAME='project_collaboration_invites' THEN
      IF NOT COALESCE(private.is_project_team_candidate(v_project_id,NEW.invitee_user_id),false) THEN
        RAISE EXCEPTION 'invitee_not_eligible';
      END IF;
    ELSIF NOT COALESCE(private.is_project_team_candidate(v_project_id,NEW.user_id),false) THEN
      RAISE EXCEPTION 'invitee_not_eligible';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enforce_project_team_edit_policy() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_project_invite_edit_policy BEFORE INSERT ON public.project_collaboration_invites
  FOR EACH ROW EXECUTE FUNCTION private.enforce_project_team_edit_policy();
CREATE TRIGGER trg_project_member_edit_policy BEFORE INSERT OR UPDATE OR DELETE ON public.project_collaborators
  FOR EACH ROW EXECUTE FUNCTION private.enforce_project_team_edit_policy();

CREATE OR REPLACE FUNCTION private.list_project_team_candidates(
  p_project_id uuid, p_source_type text, p_source_id text, p_search text DEFAULT '', p_limit integer DEFAULT 50
)
RETURNS TABLE(user_id uuid,username text,full_name text,avatar_url text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid:=auth.uid(); v_q text:=btrim(COALESCE(p_search,''));
  v_source_type text:=COALESCE(NULLIF(btrim(p_source_type),''),'standalone');
  v_source_id text:=NULLIF(btrim(p_source_id),''); v_existing boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.projects WHERE id=p_project_id) INTO v_existing;
  IF v_existing THEN
    IF NOT private.can_manage_project(p_project_id,v_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
    SELECT p.source_type,p.source_id INTO v_source_type,v_source_id FROM public.projects p WHERE p.id=p_project_id;
  ELSIF v_source_type IN ('hackathon','contest') AND NOT EXISTS (
    SELECT 1 FROM public.hackathon_registrations hr WHERE hr.hackathon_id=v_source_id
      AND hr.user_id=v_uid AND hr.document->>'status' IN ('registered','approved')
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT pp.id,pp.username,pp.full_name,pp.avatar_url FROM public.public_profiles pp
  WHERE pp.id <> v_uid AND pp.id IS DISTINCT FROM (SELECT p.owner_id FROM public.projects p WHERE p.id=p_project_id)
    AND (v_source_type NOT IN ('hackathon','contest')
      OR (v_existing AND private.is_project_team_candidate(p_project_id,pp.id))
      OR (NOT v_existing AND EXISTS(SELECT 1 FROM public.hackathon_registrations hr WHERE hr.hackathon_id=v_source_id
        AND hr.user_id=pp.id AND hr.document->>'status' IN ('registered','approved'))))
    AND NOT EXISTS(SELECT 1 FROM public.project_collaborators pc WHERE pc.project_id=p_project_id AND pc.user_id=pp.id)
    AND NOT EXISTS(SELECT 1 FROM public.project_collaboration_invites i WHERE i.project_id=p_project_id
      AND i.invitee_user_id=pp.id AND i.status='pending' AND i.expires_at>now())
    AND (v_q='' OR pp.username ILIKE '%'||v_q||'%' OR pp.full_name ILIKE '%'||v_q||'%')
  ORDER BY COALESCE(pp.full_name,pp.username,pp.id::text)
  LIMIT LEAST(GREATEST(COALESCE(p_limit,50),1),100);
END;
$$;
-- Legacy callers use the same candidate listing and eligibility as the editor.
CREATE OR REPLACE FUNCTION public.list_invitable_hackathon_users(p_project_id uuid,p_search text DEFAULT '',p_limit integer DEFAULT 50)
RETURNS TABLE(user_id uuid,username text,full_name text,avatar_url text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM private.list_project_team_candidates(p_project_id,'hackathon',NULL,p_search,p_limit);
$$;

-- A transfer into a different event is a new entry, even when performed by staff.
DO $migration$
DECLARE v_sql text; v_old text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef('public.transfer_project_hackathon(uuid,uuid,text,text[],text)'::regprocedure) INTO v_sql;
  v_old := E'SELECT * INTO v_target FROM public.hackathons h WHERE h.id=p_target_hackathon_id FOR SHARE;\n  IF NOT FOUND THEN RAISE EXCEPTION ''not_found:hackathon''; END IF;';
  IF strpos(v_sql,v_old)=0 THEN RAISE EXCEPTION 'project transfer target lookup changed upstream'; END IF;
  EXECUTE replace(v_sql,v_old,v_old || E'\n  IF clock_timestamp()>private.hackathon_submission_deadline(v_target.document) THEN\n    RAISE EXCEPTION ''forbidden:submission_deadline_passed'';\n  END IF;');
END;
$migration$;

-- Moderation is independent of owner-controlled publication visibility.
ALTER TABLE public.projects ADD COLUMN blocked boolean NOT NULL DEFAULT false;
ALTER TABLE public.projects ADD CONSTRAINT projects_blocked_private CHECK (NOT blocked OR visibility = 'private');

CREATE TABLE private.project_moderation_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('delete','block','unblock','public','unlisted','private')),
  reason text,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_moderation_audit_project_idx ON private.project_moderation_audit(project_id);
ALTER TABLE private.project_moderation_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.project_moderation_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON private.project_moderation_audit TO service_role;
GRANT USAGE ON SEQUENCE private.project_moderation_audit_id_seq TO service_role;

-- All deletes now use the audited, authenticated API boundary.
REVOKE DELETE ON public.projects FROM anon, authenticated;

CREATE FUNCTION private.guard_project_moderation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' AND EXISTS (
    SELECT 1 FROM private.project_moderation_audit a WHERE a.project_id=NEW.id AND a.action='delete'
  ) THEN RAISE EXCEPTION 'conflict:project_deleted'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      RAISE EXCEPTION 'forbidden:project_identity';
    END IF;
    IF NEW.blocked AND NEW.visibility <> 'private' THEN
      RAISE EXCEPTION 'forbidden:project_blocked';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_project_moderation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_guard_project_moderation BEFORE INSERT OR UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION private.guard_project_moderation();

-- The Edge handler supplies the verified Bearer user, never a body actor ID.
CREATE FUNCTION public.manage_project(p_actor_id uuid, p_project_id uuid, p_action text, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_project public.projects%ROWTYPE;
  v_admin boolean;
  v_reason text := nullif(btrim(p_reason), '');
BEGIN
  SELECT COALESCE(pr.role='admin',false) INTO v_admin FROM public.profiles pr WHERE pr.id=p_actor_id;
  SELECT * INTO v_project FROM public.projects p WHERE p.id=p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found:project'; END IF;
  IF p_actor_id IS NULL OR NOT COALESCE(v_admin,false) AND NOT (p_action='delete' AND v_project.owner_id=p_actor_id) THEN
    RAISE EXCEPTION 'forbidden:project_manage';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('delete','block','unblock','public','unlisted','private') THEN
    RAISE EXCEPTION 'invalid_input:project_action';
  END IF;
  IF char_length(v_reason)>1000 OR (COALESCE(v_admin,false) AND (v_reason IS NULL OR v_reason !~ '[[:alnum:]]')) THEN
    RAISE EXCEPTION 'invalid_input:moderation_reason';
  END IF;
  IF v_project.blocked AND p_action IN ('public','unlisted') THEN
    RAISE EXCEPTION 'forbidden:project_blocked';
  END IF;
  IF p_action IN ('public','unlisted') AND (
    COALESCE(v_project.summary,'') !~ '[[:alnum:]]' OR COALESCE(v_project.description,'') !~ '[[:alnum:]]'
  ) THEN RAISE EXCEPTION 'required_content:description'; END IF;
  IF p_action IN ('public','unlisted') AND v_project.source_type IN ('hackathon','contest') AND (
    COALESCE(v_project.progress,'') !~ '[[:alnum:]]' OR
    COALESCE(v_project.demo_url,v_project.repo_url,v_project.slide_url,v_project.video_url,v_project.pitch_video_url,'') = ''
  ) THEN RAISE EXCEPTION 'required_content:progress'; END IF;

  INSERT INTO private.project_moderation_audit(project_id,actor_id,action,reason,snapshot)
  VALUES(p_project_id,p_actor_id,p_action,v_reason,jsonb_build_object('project',to_jsonb(v_project),'submissions',
    (SELECT jsonb_agg(to_jsonb(s)) FROM public.hackathon_submissions s WHERE s.project_id=p_project_id)));

  IF p_action='delete' THEN
    -- Queue files for the existing expiry cleanup; the transaction first removes
    -- all project references, so retries cannot delete another project's media.
    INSERT INTO public.project_media_uploads(path,owner_id,project_id,expires_at)
    SELECT path,v_project.owner_id,p_project_id,now()
    FROM unnest(array_prepend(v_project.logo_path,v_project.screenshot_paths)) path
    WHERE path IS NOT NULL
    ON CONFLICT(path) DO UPDATE SET expires_at=now();
    DELETE FROM public.hackathon_submissions WHERE project_id=p_project_id;
    DELETE FROM public.projects WHERE id=p_project_id;
  ELSIF p_action='block' THEN
    UPDATE public.projects SET blocked=true,visibility='private' WHERE id=p_project_id;
  ELSIF p_action='unblock' THEN
    UPDATE public.projects SET blocked=false WHERE id=p_project_id;
  ELSE
    UPDATE public.projects SET visibility=p_action WHERE id=p_project_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.manage_project(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_project(uuid,uuid,text,text) TO service_role;

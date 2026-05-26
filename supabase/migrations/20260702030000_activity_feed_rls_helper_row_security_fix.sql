-- Prevent SECURITY DEFINER helper functions from leaking row_security=off into
-- the caller transaction. These helpers run as the migration owner and can read
-- the needed tables without mutating the caller's row_security setting.

CREATE OR REPLACE FUNCTION private.is_project_collaborator(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.project_collaborators pc
    WHERE pc.project_id = p_project_id
      AND pc.user_id = p_user_id
      AND pc.show_in_portfolio = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.can_manage_project(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT owner_id
  INTO v_owner
  FROM public.projects
  WHERE id = p_project_id;

  RETURN (v_owner = p_user_id) OR public.is_admin_or_support();
END;
$$;

CREATE OR REPLACE FUNCTION private.can_read_project_content(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_visibility text;
  v_owner uuid;
BEGIN
  SELECT visibility, owner_id
  INTO v_visibility, v_owner
  FROM public.projects
  WHERE id = p_project_id;

  IF v_visibility IS NULL THEN
    RETURN false;
  END IF;

  IF p_user_id IS NULL THEN
    RETURN v_visibility IN ('public', 'unlisted');
  END IF;

  IF public.is_admin_or_support() THEN
    RETURN true;
  END IF;

  RETURN (
    v_visibility IN ('public', 'unlisted')
    OR v_owner = p_user_id
    OR private.is_project_collaborator(p_project_id, p_user_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.is_followable_subject(
  p_subject_type text,
  p_subject_id text,
  p_follower_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF p_subject_type = 'user' THEN
    IF NOT private.is_uuid_text(p_subject_id) THEN
      RETURN false;
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = p_subject_id::uuid
        AND COALESCE(p.profile_public, false) = true
        AND (p_follower_id IS NULL OR p.id <> p_follower_id)
    );
  END IF;

  IF p_subject_type = 'course' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = p_subject_id
        AND c.published = true
    );
  END IF;

  IF p_subject_type = 'hackathon' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.hackathons h
      WHERE h.id = p_subject_id
        AND h.status IN ('published', 'running', 'ended', 'winners_announced')
    );
  END IF;

  IF p_subject_type = 'project' THEN
    IF NOT private.is_uuid_text(p_subject_id) THEN
      RETURN false;
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = p_subject_id::uuid
        AND p.visibility = 'public'
    );
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION private.can_read_activity_subject(
  p_subject_type text,
  p_subject_id text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF p_subject_type IS NULL OR p_subject_id IS NULL THEN
    RETURN true;
  END IF;

  IF p_subject_type IN ('lesson', 'section') THEN
    RETURN true;
  END IF;

  IF p_subject_type = 'user' THEN
    IF NOT private.is_uuid_text(p_subject_id) THEN
      RETURN false;
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = p_subject_id::uuid
        AND (
          COALESCE(p.profile_public, false) = true
          OR p.id = p_user_id
          OR public.is_admin_or_support()
        )
    );
  END IF;

  IF p_subject_type = 'course' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = p_subject_id
        AND (
          c.published = true
          OR c.instructor_id = p_user_id
          OR public.is_admin_or_support()
          OR COALESCE(c.data->'co_instructor_permissions', '{}'::jsonb) ? COALESCE(p_user_id::text, '')
        )
    );
  END IF;

  IF p_subject_type = 'hackathon' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.hackathons h
      WHERE h.id = p_subject_id
        AND (
          h.status IN ('published', 'running', 'ended', 'winners_announced')
          OR public.is_admin_or_support()
          OR (h.document->>'created_by') = COALESCE(p_user_id::text, '')
        )
    );
  END IF;

  IF p_subject_type = 'project' THEN
    IF NOT private.is_uuid_text(p_subject_id) THEN
      RETURN false;
    END IF;

    RETURN private.can_read_project_content(p_subject_id::uuid, p_user_id);
  END IF;

  IF p_subject_type = 'credential' THEN
    IF NOT private.is_uuid_text(p_subject_id) THEN
      RETURN false;
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM public.credential_issuances ci
      WHERE ci.id = p_subject_id::uuid
        AND (ci.status = 'minted' OR ci.user_id = p_user_id OR public.is_admin_or_support())
    );
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION private.can_read_activity(
  p_event_id bigint,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_event public.activity_events%ROWTYPE;
BEGIN
  SELECT *
  INTO v_event
  FROM public.activity_events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF public.is_admin_or_support() THEN
    RETURN true;
  END IF;

  IF v_event.visibility = 'private' THEN
    RETURN p_user_id IS NOT NULL AND v_event.actor_id = p_user_id;
  END IF;

  IF v_event.visibility = 'followers' THEN
    IF p_user_id IS NULL THEN
      RETURN false;
    END IF;

    IF v_event.actor_id <> p_user_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.follows f
        WHERE f.follower_id = p_user_id
          AND f.subject_type = 'user'
          AND f.subject_id = v_event.actor_id::text
          AND (f.muted_until IS NULL OR f.muted_until < now())
      )
    THEN
      RETURN false;
    END IF;
  END IF;

  RETURN private.can_read_activity_subject(v_event.object_type, v_event.object_id, p_user_id)
    AND private.can_read_activity_subject(v_event.target_type, v_event.target_id, p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION private.follows_adjust_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_delta integer;
  v_follower_id uuid;
  v_subject_type text;
  v_subject_id text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_delta := 1;
    v_follower_id := NEW.follower_id;
    v_subject_type := NEW.subject_type;
    v_subject_id := NEW.subject_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_delta := -1;
    v_follower_id := OLD.follower_id;
    v_subject_type := OLD.subject_type;
    v_subject_id := OLD.subject_id;
  ELSE
    RETURN NULL;
  END IF;

  UPDATE public.profiles
  SET following_count = GREATEST(0, following_count + v_delta)
  WHERE id = v_follower_id;

  IF v_subject_type = 'user' AND private.is_uuid_text(v_subject_id) THEN
    UPDATE public.profiles
    SET follower_count = GREATEST(0, follower_count + v_delta)
    WHERE id = v_subject_id::uuid;
  ELSIF v_subject_type = 'course' THEN
    UPDATE public.courses
    SET follower_count = GREATEST(0, follower_count + v_delta)
    WHERE id = v_subject_id;
  ELSIF v_subject_type = 'hackathon' THEN
    UPDATE public.hackathons
    SET follower_count = GREATEST(0, follower_count + v_delta)
    WHERE id = v_subject_id;
  ELSIF v_subject_type = 'project' AND private.is_uuid_text(v_subject_id) THEN
    UPDATE public.projects
    SET follower_count = GREATEST(0, follower_count + v_delta)
    WHERE id = v_subject_id::uuid;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;

GRANT EXECUTE ON FUNCTION private.is_project_collaborator(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_project(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_read_project_content(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_followable_subject(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_read_activity_subject(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_read_activity(bigint, uuid) TO anon, authenticated;

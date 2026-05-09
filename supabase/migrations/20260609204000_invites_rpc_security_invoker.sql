-- Refactor project collaboration invite RPCs to SECURITY INVOKER (so they no longer trigger
-- Supabase lint 0029) and add RLS policies required for safe operation.
--
-- Affected RPCs:
-- - public.create_project_collaboration_invite(uuid, uuid)
-- - public.accept_project_collaboration_invite(text)
-- - public.decline_project_collaboration_invite(text)
-- - public.accept_project_collaboration_invite_by_id(uuid)
-- - public.decline_project_collaboration_invite_by_id(uuid)
-- - public.revoke_project_collaboration_invite(uuid)
-- - public.remove_project_collaborator(uuid, uuid)
-- - public.list_invitable_hackathon_users(uuid, text, integer)

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) RLS: user_notifications insert for project invites
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS user_notifications_insert_project_invite ON public.user_notifications;
CREATE POLICY user_notifications_insert_project_invite
  ON public.user_notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    type = 'project_collaboration_invite'
    AND (payload ? 'invite_id')
    AND (payload ? 'project_id')
    AND (payload ? 'invited_by')
    AND (payload->>'invited_by')::uuid = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.project_collaboration_invites i
      WHERE i.id = (payload->>'invite_id')::uuid
        AND i.project_id = (payload->>'project_id')::uuid
        AND i.invited_by = (payload->>'invited_by')::uuid
        AND i.invitee_user_id = user_notifications.user_id
        AND private.can_manage_project(i.project_id, (SELECT auth.uid()))
    )
  );

-- -----------------------------------------------------------------------------
-- 2) RLS: project_collaboration_invites insert/update
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS project_collab_invites_insert_manage ON public.project_collaboration_invites;
CREATE POLICY project_collab_invites_insert_manage
  ON public.project_collaboration_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    private.can_manage_project(project_id, (SELECT auth.uid()))
    AND invited_by = (SELECT auth.uid())
    AND status = 'pending'
    AND expires_at > now()
  );

DROP POLICY IF EXISTS project_collab_invites_update_invitee_response ON public.project_collaboration_invites;
CREATE POLICY project_collab_invites_update_invitee_response
  ON public.project_collaboration_invites FOR UPDATE
  TO authenticated
  USING (
    invitee_user_id = (SELECT auth.uid())
    AND status = 'pending'
    AND expires_at > now()
  )
  WITH CHECK (
    invitee_user_id = (SELECT auth.uid())
    AND status IN ('accepted', 'declined')
  );

DROP POLICY IF EXISTS project_collab_invites_update_manager ON public.project_collaboration_invites;
CREATE POLICY project_collab_invites_update_manager
  ON public.project_collaboration_invites FOR UPDATE
  TO authenticated
  USING (
    private.can_manage_project(project_id, (SELECT auth.uid()))
  )
  WITH CHECK (
    private.can_manage_project(project_id, (SELECT auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- 3) RLS: project_collaborators insert via pending invite
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS project_collaborators_insert_from_invite ON public.project_collaborators;
CREATE POLICY project_collaborators_insert_from_invite
  ON public.project_collaborators FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.project_collaboration_invites i
      WHERE i.project_id = project_collaborators.project_id
        AND i.invitee_user_id = (SELECT auth.uid())
        AND i.status = 'pending'
        AND i.expires_at > now()
    )
  );

-- -----------------------------------------------------------------------------
-- 4) RPCs: replace SECURITY DEFINER → SECURITY INVOKER
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_project_collaboration_invite(
  p_project_id uuid,
  p_invitee_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_source_type text;
  v_hackathon_id text;
  v_reg_ok boolean;
  v_token text;
  v_hash text;
  v_invite_id uuid := gen_random_uuid();
  v_expires timestamptz := now() + interval '14 days';
  v_notif_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT p.owner_id, p.source_type, p.source_id
  INTO v_owner, v_source_type, v_hackathon_id
  FROM public.projects p
  WHERE p.id = p_project_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'project_not_found';
  END IF;

  IF v_owner <> v_uid AND NOT public.is_admin_or_support() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_source_type IS DISTINCT FROM 'contest' THEN
    RAISE EXCEPTION 'only_hackathon_projects';
  END IF;

  IF p_invitee_user_id = v_owner THEN
    RAISE EXCEPTION 'cannot_invite_owner';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.hackathon_registrations hr
    WHERE hr.hackathon_id = v_hackathon_id
      AND hr.user_id = p_invitee_user_id
      AND hr.document->>'status' = 'approved'
  )
  INTO v_reg_ok;

  IF NOT v_reg_ok THEN
    RAISE EXCEPTION 'invitee_not_approved';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.project_collaborators pc
    WHERE pc.project_id = p_project_id
      AND pc.user_id = p_invitee_user_id
  ) THEN
    RAISE EXCEPTION 'already_collaborator';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.project_collaboration_invites i
    WHERE i.project_id = p_project_id
      AND i.invitee_user_id = p_invitee_user_id
      AND i.status = 'pending'
      AND i.expires_at > now()
  ) THEN
    RAISE EXCEPTION 'pending_invite_exists';
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public.project_collaboration_invites (
    id,
    project_id,
    invitee_user_id,
    invited_by,
    status,
    token_hash,
    expires_at
  )
  VALUES (
    v_invite_id,
    p_project_id,
    p_invitee_user_id,
    v_uid,
    'pending',
    v_hash,
    v_expires
  );

  INSERT INTO public.user_notifications (id, user_id, type, payload)
  VALUES (
    gen_random_uuid(),
    p_invitee_user_id,
    'project_collaboration_invite',
    jsonb_build_object(
      'invite_id', v_invite_id,
      'project_id', p_project_id,
      'invited_by', v_uid
    )
  )
  RETURNING id INTO v_notif_id;

  UPDATE public.project_collaboration_invites
  SET notification_id = v_notif_id
  WHERE id = v_invite_id;

  RETURN json_build_object(
    'invite_id', v_invite_id,
    'token', v_token,
    'expires_at', v_expires
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_project_collaboration_invite(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hash text;
  r public.project_collaboration_invites%ROWTYPE;
  v_hackathon_id text;
  v_reg_ok boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  v_hash := encode(extensions.digest(convert_to(trim(p_token), 'UTF8'), 'sha256'), 'hex');

  SELECT *
  INTO r
  FROM public.project_collaboration_invites i
  WHERE i.token_hash = v_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  IF r.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'invite_not_pending';
  END IF;

  IF r.expires_at <= now() THEN
    UPDATE public.project_collaboration_invites
    SET status = 'expired', resolved_at = now()
    WHERE id = r.id;
    RAISE EXCEPTION 'invite_expired';
  END IF;

  IF r.invitee_user_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT p.source_id
  INTO v_hackathon_id
  FROM public.projects p
  WHERE p.id = r.project_id;

  SELECT EXISTS (
    SELECT 1
    FROM public.hackathon_registrations hr
    WHERE hr.hackathon_id = v_hackathon_id
      AND hr.user_id = v_uid
      AND hr.document->>'status' = 'approved'
  )
  INTO v_reg_ok;

  IF NOT v_reg_ok THEN
    RAISE EXCEPTION 'registration_not_approved';
  END IF;

  INSERT INTO public.project_collaborators (project_id, user_id, role, show_in_portfolio)
  VALUES (r.project_id, v_uid, 'contributor', true)
  ON CONFLICT (project_id, user_id) DO NOTHING;

  UPDATE public.project_collaboration_invites
  SET status = 'accepted', resolved_at = now()
  WHERE id = r.id;

  UPDATE public.user_notifications
  SET resolved_at = now()
  WHERE id = r.notification_id;

  RETURN json_build_object('ok', true, 'project_id', r.project_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_project_collaboration_invite(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hash text;
  r public.project_collaboration_invites%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_hash := encode(extensions.digest(convert_to(trim(p_token), 'UTF8'), 'sha256'), 'hex');

  SELECT *
  INTO r
  FROM public.project_collaboration_invites i
  WHERE i.token_hash = v_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  IF r.invitee_user_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF r.status IS DISTINCT FROM 'pending' THEN
    RETURN json_build_object('ok', false, 'reason', 'not_pending');
  END IF;

  UPDATE public.project_collaboration_invites
  SET status = 'declined', resolved_at = now()
  WHERE id = r.id;

  UPDATE public.user_notifications
  SET resolved_at = now()
  WHERE id = r.notification_id;

  RETURN json_build_object('ok', true);
END;
$$;

-- The remaining RPCs are permission-checked internally and rely on existing helper functions.
-- Keep behavior, only change to SECURITY INVOKER.

CREATE OR REPLACE FUNCTION public.accept_project_collaboration_invite_by_id(p_invite_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  r public.project_collaboration_invites%ROWTYPE;
  v_hackathon_id text;
  v_reg_ok boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT *
  INTO r
  FROM public.project_collaboration_invites i
  WHERE i.id = p_invite_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  IF r.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'invite_not_pending';
  END IF;

  IF r.expires_at <= now() THEN
    UPDATE public.project_collaboration_invites
    SET status = 'expired', resolved_at = now()
    WHERE id = r.id;
    RAISE EXCEPTION 'invite_expired';
  END IF;

  IF r.invitee_user_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT p.source_id
  INTO v_hackathon_id
  FROM public.projects p
  WHERE p.id = r.project_id;

  SELECT EXISTS (
    SELECT 1
    FROM public.hackathon_registrations hr
    WHERE hr.hackathon_id = v_hackathon_id
      AND hr.user_id = v_uid
      AND hr.document->>'status' = 'approved'
  )
  INTO v_reg_ok;

  IF NOT v_reg_ok THEN
    RAISE EXCEPTION 'registration_not_approved';
  END IF;

  INSERT INTO public.project_collaborators (project_id, user_id, role, show_in_portfolio)
  VALUES (r.project_id, v_uid, 'contributor', true)
  ON CONFLICT (project_id, user_id) DO NOTHING;

  UPDATE public.project_collaboration_invites
  SET status = 'accepted', resolved_at = now()
  WHERE id = r.id;

  UPDATE public.user_notifications
  SET resolved_at = now()
  WHERE id = r.notification_id;

  RETURN json_build_object('ok', true, 'project_id', r.project_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_project_collaboration_invite_by_id(p_invite_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  r public.project_collaboration_invites%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT *
  INTO r
  FROM public.project_collaboration_invites i
  WHERE i.id = p_invite_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  IF r.invitee_user_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF r.status IS DISTINCT FROM 'pending' THEN
    RETURN json_build_object('ok', false, 'reason', 'not_pending');
  END IF;

  UPDATE public.project_collaboration_invites
  SET status = 'declined', resolved_at = now()
  WHERE id = r.id;

  UPDATE public.user_notifications
  SET resolved_at = now()
  WHERE id = r.notification_id;

  RETURN json_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_project_collaboration_invite(p_invite_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  r public.project_collaboration_invites%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT *
  INTO r
  FROM public.project_collaboration_invites i
  WHERE i.id = p_invite_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  IF NOT private.can_manage_project(r.project_id, v_uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF r.status IS DISTINCT FROM 'pending' THEN
    RETURN json_build_object('ok', false, 'reason', 'not_pending');
  END IF;

  UPDATE public.project_collaboration_invites
  SET status = 'revoked', resolved_at = now()
  WHERE id = r.id;

  UPDATE public.user_notifications
  SET resolved_at = now()
  WHERE id = r.notification_id;

  RETURN json_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_project_collaborator(p_project_id uuid, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT private.can_manage_project(p_project_id, v_uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM public.project_collaborators pc
  WHERE pc.project_id = p_project_id
    AND pc.user_id = p_user_id;

  RETURN json_build_object('ok', true);
END;
$$;

-- NOTE: must preserve return type to avoid 42P13.
CREATE OR REPLACE FUNCTION public.list_invitable_hackathon_users(
  p_project_id uuid,
  p_search text DEFAULT '',
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  user_id uuid,
  username text,
  full_name text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hackathon_id text;
  v_q text := trim(coalesce(p_search, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT private.can_manage_project(p_project_id, v_uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT p.source_id
  INTO v_hackathon_id
  FROM public.projects p
  WHERE p.id = p_project_id
    AND p.source_type = 'contest';

  IF v_hackathon_id IS NULL THEN
    RAISE EXCEPTION 'invalid_project';
  END IF;

  RETURN QUERY
  SELECT hr.user_id,
    pp.username,
    pp.full_name,
    pp.avatar_url
  FROM public.hackathon_registrations hr
  LEFT JOIN public.public_profiles pp ON pp.id = hr.user_id
  WHERE hr.hackathon_id = v_hackathon_id
    AND hr.document->>'status' = 'approved'
    AND hr.user_id IS DISTINCT FROM (
      SELECT p2.owner_id FROM public.projects p2 WHERE p2.id = p_project_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.project_collaborators pc
      WHERE pc.project_id = p_project_id
        AND pc.user_id = hr.user_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.project_collaboration_invites i
      WHERE i.project_id = p_project_id
        AND i.invitee_user_id = hr.user_id
        AND i.status = 'pending'
        AND i.expires_at > now()
    )
    AND (
      v_q = ''
      OR pp.username ILIKE '%' || v_q || '%'
      OR pp.full_name ILIKE '%' || v_q || '%'
      OR hr.user_id::text ILIKE '%' || v_q || '%'
    )
  ORDER BY COALESCE(pp.full_name, pp.username, hr.user_id::text)
  LIMIT LEAST(coalesce(p_limit, 50), 100);
END;
$$;

-- -----------------------------------------------------------------------------
-- 5) Grants (ensure still executable by authenticated; anon revoked elsewhere)
-- -----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.create_project_collaboration_invite(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_project_collaboration_invite(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.accept_project_collaboration_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_project_collaboration_invite(text) TO authenticated;

REVOKE ALL ON FUNCTION public.decline_project_collaboration_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decline_project_collaboration_invite(text) TO authenticated;

REVOKE ALL ON FUNCTION public.accept_project_collaboration_invite_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_project_collaboration_invite_by_id(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.decline_project_collaboration_invite_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decline_project_collaboration_invite_by_id(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.revoke_project_collaboration_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_project_collaboration_invite(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.remove_project_collaborator(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_project_collaborator(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.list_invitable_hackathon_users(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_invitable_hackathon_users(uuid, text, int) TO authenticated;

COMMIT;


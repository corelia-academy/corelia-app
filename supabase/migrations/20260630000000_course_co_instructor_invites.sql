-- Course co-instructor invite flow:
--   * Table `course_co_instructor_invites` with hashed token + expiry
--   * RLS: invitee + course manager can SELECT; all writes via SECURITY DEFINER RPCs
--   * RPCs: create / accept(by token & id) / decline(by token & id) / revoke / peek
--   * Accept writes co_instructor_permissions + co_instructors snapshot into courses.data
--   * Companion edge function (separate file) builds Resend email with deeplink

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- 1) Table + indexes + RLS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.course_co_instructor_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id text NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  invitee_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  notification_id uuid REFERENCES public.user_notifications (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS course_co_instr_invites_token_hash_uidx
  ON public.course_co_instructor_invites (token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS course_co_instr_invites_pending_uidx
  ON public.course_co_instructor_invites (course_id, invitee_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS course_co_instr_invites_invitee_idx
  ON public.course_co_instructor_invites (invitee_user_id, status);

ALTER TABLE public.course_co_instructor_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_co_instr_invites_select ON public.course_co_instructor_invites;
CREATE POLICY course_co_instr_invites_select
  ON public.course_co_instructor_invites FOR SELECT
  TO authenticated
  USING (
    invitee_user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = course_id
        AND c.instructor_id = (SELECT auth.uid())
    )
    OR public.is_admin_or_support()
  );

-- -----------------------------------------------------------------------------
-- 2) Helper: build co_instructor snapshot from a profile row
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.build_co_instructor_snapshot(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object('id', p.id::text, 'name', COALESCE(p.full_name, ''))
         || jsonb_strip_nulls(jsonb_build_object(
              'avatar_url', p.avatar_url,
              'headline', p.instructor_headline,
              'organization', p.instructor_organization,
              'website', p.instructor_website,
              'bio', COALESCE(p.instructor_bio, p.bio)
            ))
  FROM public.profiles p
  WHERE p.id = p_user_id;
$$;

REVOKE ALL ON FUNCTION private.build_co_instructor_snapshot(uuid) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- 3) RPC: create invite
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_course_co_instructor_invite(
  p_course_id text,
  p_invitee_user_id uuid,
  p_permissions jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_instructor uuid;
  v_course_title text;
  v_perms jsonb := COALESCE(p_permissions, '{}'::jsonb);
  v_token text;
  v_hash text;
  v_invite_id uuid := gen_random_uuid();
  v_expires timestamptz := now() + interval '14 days';
  v_notif_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF jsonb_typeof(v_perms) <> 'object' THEN
    RAISE EXCEPTION 'invalid_permissions';
  END IF;

  SELECT c.instructor_id, c.data->>'title'
    INTO v_instructor, v_course_title
  FROM public.courses c
  WHERE c.id = p_course_id;

  IF v_instructor IS NULL THEN
    RAISE EXCEPTION 'course_not_found';
  END IF;

  IF v_instructor <> v_uid AND NOT public.is_admin_or_support() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_invitee_user_id = v_instructor THEN
    RAISE EXCEPTION 'cannot_invite_main_instructor';
  END IF;

  -- Already a co-instructor (accepted)?
  IF (
    SELECT (c.data->'co_instructor_permissions') ? (p_invitee_user_id::text)
    FROM public.courses c WHERE c.id = p_course_id
  ) THEN
    RAISE EXCEPTION 'already_co_instructor';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.course_co_instructor_invites i
    WHERE i.course_id = p_course_id
      AND i.invitee_user_id = p_invitee_user_id
      AND i.status = 'pending'
      AND i.expires_at > now()
  ) THEN
    RAISE EXCEPTION 'pending_invite_exists';
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public.user_notifications (id, user_id, type, payload)
  VALUES (
    gen_random_uuid(),
    p_invitee_user_id,
    'co_instructor_invite',
    jsonb_build_object(
      'invite_id', v_invite_id,
      'course_id', p_course_id,
      'course_title', COALESCE(v_course_title, ''),
      'invited_by', v_uid,
      'permissions', v_perms,
      'expires_at', v_expires
    )
  )
  RETURNING id INTO v_notif_id;

  INSERT INTO public.course_co_instructor_invites (
    id, course_id, invitee_user_id, invited_by,
    permissions, status, token_hash, expires_at, notification_id
  )
  VALUES (
    v_invite_id, p_course_id, p_invitee_user_id, v_uid,
    v_perms, 'pending', v_hash, v_expires, v_notif_id
  );

  RETURN json_build_object(
    'invite_id', v_invite_id,
    'token', v_token,
    'expires_at', v_expires,
    'course_title', COALESCE(v_course_title, '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_course_co_instructor_invite(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_course_co_instructor_invite(text, uuid, jsonb) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4) Internal helper: apply accept side-effects to courses.data
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.apply_co_instructor_accept(
  p_course_id text,
  p_invitee uuid,
  p_permissions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing jsonb;
  v_snapshot jsonb;
  v_co_perms jsonb;
  v_co_list jsonb;
  v_already boolean;
BEGIN
  SELECT c.data INTO v_existing FROM public.courses c WHERE c.id = p_course_id FOR UPDATE;
  IF v_existing IS NULL THEN
    RAISE EXCEPTION 'course_not_found';
  END IF;

  v_co_perms := COALESCE(v_existing->'co_instructor_permissions', '{}'::jsonb)
                || jsonb_build_object(p_invitee::text, COALESCE(p_permissions, '{}'::jsonb));

  v_snapshot := private.build_co_instructor_snapshot(p_invitee);
  IF v_snapshot IS NULL THEN
    v_snapshot := jsonb_build_object('id', p_invitee::text, 'name', '');
  END IF;

  v_co_list := COALESCE(v_existing->'co_instructors', '[]'::jsonb);

  -- Replace existing entry by id if present, otherwise append
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_co_list) e WHERE e->>'id' = p_invitee::text
  ) INTO v_already;

  IF v_already THEN
    v_co_list := (
      SELECT COALESCE(jsonb_agg(
        CASE WHEN e->>'id' = p_invitee::text THEN v_snapshot ELSE e END
      ), '[]'::jsonb)
      FROM jsonb_array_elements(v_co_list) e
    );
  ELSE
    v_co_list := v_co_list || jsonb_build_array(v_snapshot);
  END IF;

  UPDATE public.courses
  SET data = v_existing
             || jsonb_build_object('co_instructor_permissions', v_co_perms)
             || jsonb_build_object('co_instructors', v_co_list),
      updated_at = now()
  WHERE id = p_course_id;
END;
$$;

REVOKE ALL ON FUNCTION private.apply_co_instructor_accept(text, uuid, jsonb) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- 5) RPC: accept by token
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accept_course_co_instructor_invite_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hash text;
  r public.course_co_instructor_invites%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  v_hash := encode(extensions.digest(convert_to(trim(p_token), 'UTF8'), 'sha256'), 'hex');

  SELECT * INTO r
  FROM public.course_co_instructor_invites i
  WHERE i.token_hash = v_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  IF r.invitee_user_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF r.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'invite_not_pending';
  END IF;

  IF r.expires_at <= now() THEN
    UPDATE public.course_co_instructor_invites
    SET status = 'expired', resolved_at = now()
    WHERE id = r.id;
    RAISE EXCEPTION 'invite_expired';
  END IF;

  PERFORM private.apply_co_instructor_accept(r.course_id, r.invitee_user_id, r.permissions);

  UPDATE public.course_co_instructor_invites
  SET status = 'accepted', resolved_at = now()
  WHERE id = r.id;

  UPDATE public.user_notifications
  SET resolved_at = now()
  WHERE id = r.notification_id;

  RETURN json_build_object('ok', true, 'course_id', r.course_id);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_course_co_instructor_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_course_co_instructor_invite_by_token(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6) RPC: accept by invite id (in-app)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accept_course_co_instructor_invite_by_id(p_invite_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  r public.course_co_instructor_invites%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO r
  FROM public.course_co_instructor_invites i
  WHERE i.id = p_invite_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  IF r.invitee_user_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF r.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'invite_not_pending';
  END IF;

  IF r.expires_at <= now() THEN
    UPDATE public.course_co_instructor_invites
    SET status = 'expired', resolved_at = now()
    WHERE id = r.id;
    RAISE EXCEPTION 'invite_expired';
  END IF;

  PERFORM private.apply_co_instructor_accept(r.course_id, r.invitee_user_id, r.permissions);

  UPDATE public.course_co_instructor_invites
  SET status = 'accepted', resolved_at = now()
  WHERE id = r.id;

  UPDATE public.user_notifications
  SET resolved_at = now()
  WHERE id = r.notification_id;

  RETURN json_build_object('ok', true, 'course_id', r.course_id);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_course_co_instructor_invite_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_course_co_instructor_invite_by_id(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7) RPC: decline by token / by id
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.decline_course_co_instructor_invite_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hash text;
  r public.course_co_instructor_invites%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  v_hash := encode(extensions.digest(convert_to(trim(p_token), 'UTF8'), 'sha256'), 'hex');

  SELECT * INTO r
  FROM public.course_co_instructor_invites i
  WHERE i.token_hash = v_hash
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'invite_not_found'; END IF;
  IF r.invitee_user_id <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF r.status IS DISTINCT FROM 'pending' THEN
    RETURN json_build_object('ok', false, 'reason', 'not_pending');
  END IF;

  UPDATE public.course_co_instructor_invites
  SET status = 'declined', resolved_at = now()
  WHERE id = r.id;

  UPDATE public.user_notifications
  SET resolved_at = now()
  WHERE id = r.notification_id;

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.decline_course_co_instructor_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decline_course_co_instructor_invite_by_token(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_course_co_instructor_invite_by_id(p_invite_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  r public.course_co_instructor_invites%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO r
  FROM public.course_co_instructor_invites i
  WHERE i.id = p_invite_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'invite_not_found'; END IF;
  IF r.invitee_user_id <> v_uid THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF r.status IS DISTINCT FROM 'pending' THEN
    RETURN json_build_object('ok', false, 'reason', 'not_pending');
  END IF;

  UPDATE public.course_co_instructor_invites
  SET status = 'declined', resolved_at = now()
  WHERE id = r.id;

  UPDATE public.user_notifications
  SET resolved_at = now()
  WHERE id = r.notification_id;

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.decline_course_co_instructor_invite_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decline_course_co_instructor_invite_by_id(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 8) RPC: revoke (manager-only)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.revoke_course_co_instructor_invite(p_invite_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  r public.course_co_instructor_invites%ROWTYPE;
  v_instructor uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO r
  FROM public.course_co_instructor_invites i
  WHERE i.id = p_invite_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'invite_not_found'; END IF;

  SELECT c.instructor_id INTO v_instructor
  FROM public.courses c WHERE c.id = r.course_id;

  IF v_instructor <> v_uid AND NOT public.is_admin_or_support() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF r.status IS DISTINCT FROM 'pending' THEN
    RETURN json_build_object('ok', false, 'reason', 'not_pending');
  END IF;

  UPDATE public.course_co_instructor_invites
  SET status = 'revoked', resolved_at = now()
  WHERE id = r.id;

  UPDATE public.user_notifications
  SET resolved_at = now()
  WHERE id = r.notification_id;

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_course_co_instructor_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_course_co_instructor_invite(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 9) RPC: peek invite by token (deeplink preview)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.peek_course_co_instructor_invite_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hash text;
  r public.course_co_instructor_invites%ROWTYPE;
  v_course_title text;
  v_inviter_name text;
  v_inviter_avatar text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  v_hash := encode(extensions.digest(convert_to(trim(p_token), 'UTF8'), 'sha256'), 'hex');

  SELECT * INTO r
  FROM public.course_co_instructor_invites i
  WHERE i.token_hash = v_hash;

  IF NOT FOUND THEN RAISE EXCEPTION 'invite_not_found'; END IF;

  IF r.invitee_user_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT c.data->>'title' INTO v_course_title
  FROM public.courses c WHERE c.id = r.course_id;

  SELECT p.full_name, p.avatar_url INTO v_inviter_name, v_inviter_avatar
  FROM public.profiles p WHERE p.id = r.invited_by;

  RETURN json_build_object(
    'invite_id', r.id,
    'course_id', r.course_id,
    'course_title', COALESCE(v_course_title, ''),
    'invited_by', r.invited_by,
    'inviter_name', COALESCE(v_inviter_name, ''),
    'inviter_avatar', v_inviter_avatar,
    'permissions', r.permissions,
    'status', r.status,
    'expires_at', r.expires_at,
    'is_expired', r.expires_at <= now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.peek_course_co_instructor_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peek_course_co_instructor_invite_by_token(text) TO authenticated;

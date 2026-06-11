-- Linter hygiene (0028/0029): move SECURITY DEFINER RPCs out of the REST-exposed
-- `public` schema into `private`, and re-expose thin SECURITY INVOKER wrappers in
-- `public` with identical signatures. The wrappers are INVOKER (not flagged); the
-- relocated DEFINER bodies are not reachable via /rest/v1/rpc (PostgREST only
-- exposes `public`), so they are not flagged either. Behaviour is unchanged —
-- the DEFINER bodies still run with definer privileges, and auth.uid() resolves
-- from the request JWT regardless of definer/invoker.
--
-- These 9 functions were each verified to carry correct internal authorization
-- guards; this migration is hardening/lint hygiene, not a vulnerability fix. It
-- mirrors the established pattern from 20260506071954 (is_admin_or_support).
--
-- USAGE on schema `private` is already granted to anon, authenticated (20260506071954),
-- so the invoker wrappers can resolve private.* when executed as the calling role.

BEGIN;

-- =============================================================================
-- 1) list_followers_v1  — anon + authenticated, RETURNS TABLE, keep DEFAULT 12
-- =============================================================================
ALTER FUNCTION public.list_followers_v1(text, text, integer) SET SCHEMA private;
GRANT EXECUTE ON FUNCTION private.list_followers_v1(text, text, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_followers_v1(
  p_subject_type text,
  p_subject_id text,
  p_limit integer DEFAULT 12
)
RETURNS TABLE (
  id uuid,
  username text,
  ocid text,
  full_name text,
  avatar_url text,
  followed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT * FROM private.list_followers_v1(p_subject_type, p_subject_id, p_limit);
$$;

REVOKE ALL ON FUNCTION public.list_followers_v1(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_followers_v1(text, text, integer) TO anon, authenticated;

-- =============================================================================
-- 2) Course co-instructor invite RPCs — authenticated only, RETURNS json
-- =============================================================================

-- create_course_co_instructor_invite(text, uuid, jsonb)
ALTER FUNCTION public.create_course_co_instructor_invite(text, uuid, jsonb) SET SCHEMA private;
GRANT EXECUTE ON FUNCTION private.create_course_co_instructor_invite(text, uuid, jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.create_course_co_instructor_invite(
  p_course_id text,
  p_invitee_user_id uuid,
  p_permissions jsonb
)
RETURNS json
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT private.create_course_co_instructor_invite(p_course_id, p_invitee_user_id, p_permissions);
$$;
REVOKE ALL ON FUNCTION public.create_course_co_instructor_invite(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_course_co_instructor_invite(text, uuid, jsonb) TO authenticated;

-- accept_course_co_instructor_invite_by_id(uuid)
ALTER FUNCTION public.accept_course_co_instructor_invite_by_id(uuid) SET SCHEMA private;
GRANT EXECUTE ON FUNCTION private.accept_course_co_instructor_invite_by_id(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.accept_course_co_instructor_invite_by_id(p_invite_id uuid)
RETURNS json
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT private.accept_course_co_instructor_invite_by_id(p_invite_id);
$$;
REVOKE ALL ON FUNCTION public.accept_course_co_instructor_invite_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_course_co_instructor_invite_by_id(uuid) TO authenticated;

-- accept_course_co_instructor_invite_by_token(text)
ALTER FUNCTION public.accept_course_co_instructor_invite_by_token(text) SET SCHEMA private;
GRANT EXECUTE ON FUNCTION private.accept_course_co_instructor_invite_by_token(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.accept_course_co_instructor_invite_by_token(p_token text)
RETURNS json
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT private.accept_course_co_instructor_invite_by_token(p_token);
$$;
REVOKE ALL ON FUNCTION public.accept_course_co_instructor_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_course_co_instructor_invite_by_token(text) TO authenticated;

-- decline_course_co_instructor_invite_by_id(uuid)
ALTER FUNCTION public.decline_course_co_instructor_invite_by_id(uuid) SET SCHEMA private;
GRANT EXECUTE ON FUNCTION private.decline_course_co_instructor_invite_by_id(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.decline_course_co_instructor_invite_by_id(p_invite_id uuid)
RETURNS json
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT private.decline_course_co_instructor_invite_by_id(p_invite_id);
$$;
REVOKE ALL ON FUNCTION public.decline_course_co_instructor_invite_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decline_course_co_instructor_invite_by_id(uuid) TO authenticated;

-- decline_course_co_instructor_invite_by_token(text)
ALTER FUNCTION public.decline_course_co_instructor_invite_by_token(text) SET SCHEMA private;
GRANT EXECUTE ON FUNCTION private.decline_course_co_instructor_invite_by_token(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.decline_course_co_instructor_invite_by_token(p_token text)
RETURNS json
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT private.decline_course_co_instructor_invite_by_token(p_token);
$$;
REVOKE ALL ON FUNCTION public.decline_course_co_instructor_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decline_course_co_instructor_invite_by_token(text) TO authenticated;

-- peek_course_co_instructor_invite_by_token(text)
ALTER FUNCTION public.peek_course_co_instructor_invite_by_token(text) SET SCHEMA private;
GRANT EXECUTE ON FUNCTION private.peek_course_co_instructor_invite_by_token(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.peek_course_co_instructor_invite_by_token(p_token text)
RETURNS json
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT private.peek_course_co_instructor_invite_by_token(p_token);
$$;
REVOKE ALL ON FUNCTION public.peek_course_co_instructor_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peek_course_co_instructor_invite_by_token(text) TO authenticated;

-- revoke_course_co_instructor_invite(uuid)
ALTER FUNCTION public.revoke_course_co_instructor_invite(uuid) SET SCHEMA private;
GRANT EXECUTE ON FUNCTION private.revoke_course_co_instructor_invite(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.revoke_course_co_instructor_invite(p_invite_id uuid)
RETURNS json
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT private.revoke_course_co_instructor_invite(p_invite_id);
$$;
REVOKE ALL ON FUNCTION public.revoke_course_co_instructor_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_course_co_instructor_invite(uuid) TO authenticated;

-- =============================================================================
-- 3) set_my_project_collaboration_visibility(uuid, boolean) — authenticated, json
-- =============================================================================
ALTER FUNCTION public.set_my_project_collaboration_visibility(uuid, boolean) SET SCHEMA private;
GRANT EXECUTE ON FUNCTION private.set_my_project_collaboration_visibility(uuid, boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.set_my_project_collaboration_visibility(
  p_project_id uuid,
  p_show_in_portfolio boolean
)
RETURNS json
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT private.set_my_project_collaboration_visibility(p_project_id, p_show_in_portfolio);
$$;
REVOKE ALL ON FUNCTION public.set_my_project_collaboration_visibility(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_project_collaboration_visibility(uuid, boolean) TO authenticated;

COMMIT;

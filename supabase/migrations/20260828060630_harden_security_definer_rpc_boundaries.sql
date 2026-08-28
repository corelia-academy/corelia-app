-- Keep privileged implementations outside the exposed public API schema.
-- Public RPC names remain stable through SECURITY INVOKER wrappers with an
-- explicit ACL.  This removes direct REST access to SECURITY DEFINER code.

-- The activity helper is internal-only and must not inherit a mutable path.
ALTER FUNCTION private.credential_template_activity_payload(uuid, jsonb)
  SET search_path = '';
REVOKE ALL ON FUNCTION private.credential_template_activity_payload(uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

-- Move client-facing privileged implementations without recreating their
-- bodies. ALTER ... SET SCHEMA preserves the function OID, owner and logic.
ALTER FUNCTION public.create_project_collaboration_invite(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.enroll_in_course(text, uuid) SET SCHEMA private;
ALTER FUNCTION public.get_learning_reminder_candidates() SET SCHEMA private;
ALTER FUNCTION public.list_course_co_instructor_candidates(text) SET SCHEMA private;
ALTER FUNCTION public.list_invitable_hackathon_users(uuid, text, integer) SET SCHEMA private;
ALTER FUNCTION public.list_profile_course_skills(uuid) SET SCHEMA private;
ALTER FUNCTION public.patch_hackathon_metrics_snapshot(text, jsonb) SET SCHEMA private;
ALTER FUNCTION public.refresh_course_total_duration(text) SET SCHEMA private;
ALTER FUNCTION public.submit_quiz_attempt(text, text, text, text, integer) SET SCHEMA private;
ALTER FUNCTION public.submit_quiz_attempts(jsonb) SET SCHEMA private;

-- Trigger functions are not RPCs. Moving them preserves trigger dependencies
-- while removing the accidentally exposed public functions entirely.
ALTER FUNCTION public.guard_course_enrollment_access() SET SCHEMA private;
ALTER FUNCTION public.sync_ai_chat_session_message_count() SET SCHEMA private;

-- Reset privileges inherited from the old public functions before selectively
-- granting access required by the invoker wrappers below.
REVOKE ALL ON FUNCTION private.create_project_collaboration_invite(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.enroll_in_course(text, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.get_learning_reminder_candidates() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.list_course_co_instructor_candidates(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.list_invitable_hackathon_users(uuid, text, integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.list_profile_course_skills(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.patch_hackathon_metrics_snapshot(text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.refresh_course_total_duration(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.submit_quiz_attempt(text, text, text, text, integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.submit_quiz_attempts(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.guard_course_enrollment_access() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.sync_ai_chat_session_message_count() FROM PUBLIC, anon, authenticated, service_role;

-- Wrappers execute as the caller, but the caller needs narrowly scoped access
-- to the private implementation selected for that RPC.
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.list_profile_course_skills(uuid)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.create_project_collaboration_invite(uuid, uuid),
  private.enroll_in_course(text, uuid),
  private.list_course_co_instructor_candidates(text),
  private.list_invitable_hackathon_users(uuid, text, integer),
  private.patch_hackathon_metrics_snapshot(text, jsonb),
  private.refresh_course_total_duration(text),
  private.submit_quiz_attempt(text, text, text, text, integer),
  private.submit_quiz_attempts(jsonb)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.get_learning_reminder_candidates()
  TO service_role;

CREATE FUNCTION public.create_project_collaboration_invite(
  p_project_id uuid,
  p_invitee_user_id uuid
)
RETURNS json
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.create_project_collaboration_invite(p_project_id, p_invitee_user_id);
$$;

CREATE FUNCTION public.enroll_in_course(
  p_course_id text,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.enroll_in_course(p_course_id, p_user_id);
$$;

CREATE FUNCTION public.get_learning_reminder_candidates()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  locale text,
  days_inactive integer,
  stage smallint,
  last_active_at timestamptz,
  in_progress_courses jsonb
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT * FROM private.get_learning_reminder_candidates();
$$;

CREATE FUNCTION public.list_course_co_instructor_candidates(p_course_id text)
RETURNS TABLE (
  id uuid,
  role text,
  username text,
  full_name text,
  avatar_url text,
  email text,
  instructor_origin text,
  instructor_headline text,
  instructor_organization text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT * FROM private.list_course_co_instructor_candidates(p_course_id);
$$;

CREATE FUNCTION public.list_invitable_hackathon_users(
  p_project_id uuid,
  p_search text DEFAULT ''::text,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  user_id uuid,
  username text,
  full_name text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT * FROM private.list_invitable_hackathon_users(p_project_id, p_search, p_limit);
$$;

CREATE FUNCTION public.list_profile_course_skills(p_profile_id uuid)
RETURNS TABLE (skill text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT * FROM private.list_profile_course_skills(p_profile_id);
$$;

CREATE FUNCTION public.patch_hackathon_metrics_snapshot(
  p_hackathon_id text,
  p_metrics_snapshot jsonb
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.patch_hackathon_metrics_snapshot(p_hackathon_id, p_metrics_snapshot);
$$;

CREATE FUNCTION public.refresh_course_total_duration(p_course_id text)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.refresh_course_total_duration(p_course_id);
$$;

CREATE FUNCTION public.submit_quiz_attempt(
  p_course_id text,
  p_section_id text DEFAULT NULL::text,
  p_lesson_id text DEFAULT NULL::text,
  p_question_id text DEFAULT NULL::text,
  p_selected_index integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.submit_quiz_attempt(
    p_course_id,
    p_section_id,
    p_lesson_id,
    p_question_id,
    p_selected_index
  );
$$;

CREATE FUNCTION public.submit_quiz_attempts(p_attempts jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.submit_quiz_attempts(p_attempts);
$$;

-- New functions may receive direct grants from project default privileges, so
-- always clear every client role before restoring the intended API matrix.
REVOKE ALL ON FUNCTION public.create_project_collaboration_invite(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.enroll_in_course(text, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_learning_reminder_candidates() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.list_course_co_instructor_candidates(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.list_invitable_hackathon_users(uuid, text, integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.list_profile_course_skills(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.patch_hackathon_metrics_snapshot(text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.refresh_course_total_duration(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.submit_quiz_attempt(text, text, text, text, integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.submit_quiz_attempts(jsonb) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.list_profile_course_skills(uuid)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.create_project_collaboration_invite(uuid, uuid),
  public.enroll_in_course(text, uuid),
  public.list_course_co_instructor_candidates(text),
  public.list_invitable_hackathon_users(uuid, text, integer),
  public.patch_hackathon_metrics_snapshot(text, jsonb),
  public.refresh_course_total_duration(text),
  public.submit_quiz_attempt(text, text, text, text, integer),
  public.submit_quiz_attempts(jsonb)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_learning_reminder_candidates()
  TO service_role;

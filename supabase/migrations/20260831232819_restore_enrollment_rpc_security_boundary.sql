-- Restore the hardened RPC boundary after the free-enrollment implementation
-- replaced the public SECURITY INVOKER wrapper in the previous migration.

CREATE OR REPLACE FUNCTION private.enroll_in_course(
  p_course_id text,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_user_id uuid := COALESCE(p_user_id, v_caller);
  v_enrollment_id text;
  v_now timestamptz := now();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Must be logged in to enroll.' USING ERRCODE = '42501';
  END IF;
  IF v_caller IS NOT NULL AND v_caller <> v_user_id AND NOT public.is_admin_or_support() THEN
    RAISE EXCEPTION 'ENROLLMENT_USER_MISMATCH' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.courses WHERE id = p_course_id) THEN
    RAISE EXCEPTION 'COURSE_NOT_FOUND: %', p_course_id USING ERRCODE = 'P0002';
  END IF;

  v_enrollment_id := v_user_id::text || '_' || p_course_id;
  INSERT INTO public.enrollments (id, user_id, course_id, enrolled_at, last_accessed_at)
  VALUES (v_enrollment_id, v_user_id, p_course_id, v_now, v_now)
  ON CONFLICT (user_id, course_id) DO UPDATE
    SET last_accessed_at = GREATEST(public.enrollments.last_accessed_at, EXCLUDED.last_accessed_at)
  RETURNING id INTO v_enrollment_id;

  RETURN jsonb_build_object('ok', true, 'enrollment_id', v_enrollment_id);
END;
$$;

REVOKE ALL ON FUNCTION private.enroll_in_course(text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.enroll_in_course(text, uuid)
  TO authenticated, service_role;

DROP FUNCTION public.enroll_in_course(text, uuid);
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

REVOKE ALL ON FUNCTION public.enroll_in_course(text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enroll_in_course(text, uuid)
  TO authenticated, service_role;

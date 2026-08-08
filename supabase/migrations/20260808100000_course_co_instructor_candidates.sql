-- Authorized course managers need a small, private directory to invite
-- instructors. Direct SELECT on public.profiles is intentionally restricted
-- to self/admin/support, so the client cannot use it for this workflow.

CREATE OR REPLACE FUNCTION public.list_course_co_instructor_candidates(
  p_course_id text
)
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL OR NOT private.can_manage_course(p_course_id, v_user_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.role,
    p.username,
    p.full_name,
    p.avatar_url,
    p.email,
    p.instructor_origin,
    p.instructor_headline,
    p.instructor_organization,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.role = 'instructor'
  ORDER BY lower(coalesce(nullif(p.full_name, ''), nullif(p.username, ''), nullif(p.email, ''), p.id::text)), p.id
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.list_course_co_instructor_candidates(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_course_co_instructor_candidates(text) TO authenticated;

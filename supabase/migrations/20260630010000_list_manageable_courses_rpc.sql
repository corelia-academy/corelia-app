-- Returns courses the caller can manage: primary instructor OR co-instructor
-- (uid present in `data.co_instructor_permissions` JSON object).
--
-- Used by the instructor dashboard so co-instructors who accepted an invite
-- can see and edit the course inside `/instructor/courses`.

CREATE OR REPLACE FUNCTION public.list_manageable_courses()
RETURNS SETOF public.courses
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT *
  FROM public.courses c
  WHERE c.instructor_id = (SELECT auth.uid())
     OR (c.data->'co_instructor_permissions') ? ((SELECT auth.uid())::text)
  ORDER BY c.updated_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_manageable_courses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_manageable_courses() TO authenticated;

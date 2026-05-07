-- Performance: indexes and batch RPC
-- Fixes:
--   1. Composite index for listCoreliaInstructorProfiles (role + instructor_origin)
--   2. Composite index for public_profiles handle lookup (username + ocid)
--   3. batch_update_lesson_orders RPC to replace N+1 loop in reorderCourseLessons

-- 1. Composite index: speeds up listCoreliaInstructorProfiles
--    Current queries: .eq("role","instructor").eq("instructor_origin","corelia")
--    Existing separate indexes (profiles_role_idx, profiles_instructor_origin_idx) are
--    less efficient than a single composite scan.
CREATE INDEX IF NOT EXISTS profiles_role_origin_idx
  ON public.profiles (role, instructor_origin);

-- 2. Composite index: speeds up getPublicProfileByHandle OR query
--    Query: .or("username.ilike.X,ocid.eq.X")
--    Both columns already have separate unique indexes; this covering index
--    lets Postgres satisfy the OR with a single bitmap index scan.
DO $$
BEGIN
  -- `username` was introduced later in 20260606143900_public_user_profiles.sql.
  -- Make this migration resilient when applied to older DBs.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'username'
  ) THEN
    CREATE INDEX IF NOT EXISTS public_profiles_handle_idx
      ON public.profiles (lower(username), ocid)
      WHERE username IS NOT NULL OR ocid IS NOT NULL;
  END IF;
END;
$$;

-- 3. batch_update_lesson_orders: replaces O(n) UPDATE loop with a single statement
--    Called from reorderCourseLessons() in src/lib/courses.ts
--    p_updates: [{id, sort_order, section_id}, ...]
--
--    SECURITY INVOKER (not DEFINER) so the UPDATE runs under the caller's role
--    and Postgres applies RLS on course_lessons normally.
--    anon users are blocked by RLS on course_lessons (no UPDATE policy for anon).
CREATE OR REPLACE FUNCTION public.batch_update_lesson_orders(
  p_course_id text,
  p_updates    jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE course_lessons AS cl
  SET
    sort_order = (u.value->>'sort_order')::int,
    section_id = u.value->>'section_id'
  FROM jsonb_array_elements(p_updates) AS u
  WHERE cl.id        = u.value->>'id'
    AND cl.course_id = p_course_id;
END;
$$;

-- Revoke from public (anon); authenticated inherits execute via SECURITY INVOKER + RLS
REVOKE ALL ON FUNCTION public.batch_update_lesson_orders(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.batch_update_lesson_orders(text, jsonb) TO authenticated;

-- 4. Covering indexes for getCourseSections / getCourseLessons
--    Queries: WHERE course_id = ? ORDER BY sort_order ASC
--    PK (course_id, id) covers the WHERE but not the ORDER BY.
--    These indexes allow an index-only scan that returns rows pre-sorted,
--    eliminating the filesort step.
CREATE INDEX IF NOT EXISTS course_sections_course_order_idx
  ON public.course_sections (course_id, sort_order);

CREATE INDEX IF NOT EXISTS course_lessons_course_order_idx
  ON public.course_lessons (course_id, sort_order);

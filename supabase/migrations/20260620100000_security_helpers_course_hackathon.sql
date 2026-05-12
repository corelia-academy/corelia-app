-- Shared authorization helpers for course/hackathon RLS and storage policies.

CREATE OR REPLACE FUNCTION private.is_corelia_instructor(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND p.role = 'instructor'
      AND p.instructor_origin = 'corelia'
  );
$$;

CREATE OR REPLACE FUNCTION private.can_manage_course(p_course_id text, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = p_course_id
      AND (
        c.instructor_id = p_user_id
        OR public.is_admin_or_support()
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.can_manage_course_feature(
  p_course_id text,
  p_user_id uuid,
  p_feature text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = p_course_id
      AND (
        private.can_manage_course(p_course_id, p_user_id)
        OR COALESCE(
          (c.data->'co_instructor_permissions'->(p_user_id::text)->>p_feature)::boolean,
          false
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.can_manage_corelia_course_ocb(
  p_course_id text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = p_course_id
      AND COALESCE(c.data->>'owner_type', 'corelia') = 'corelia'
      AND (
        public.is_admin_or_support()
        OR private.is_corelia_instructor(p_user_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.can_manage_hackathon(p_hackathon_id text, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.hackathons h
    WHERE h.id = p_hackathon_id
      AND (
        public.is_admin_or_support()
        OR (h.document->>'created_by') = (p_user_id::text)
      )
  );
$$;

GRANT EXECUTE ON FUNCTION private.is_corelia_instructor(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_course(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_course_feature(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_corelia_course_ocb(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_hackathon(text, uuid) TO anon, authenticated;

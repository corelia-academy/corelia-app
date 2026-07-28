-- Public preview of the user profiles a public profile follows.
-- Direct SELECT on follows intentionally remains restricted to the owner/staff.

CREATE OR REPLACE FUNCTION private.list_user_following_v1(
  p_user_id uuid,
  p_limit integer DEFAULT 50
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
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT
    pp.id,
    pp.username,
    pp.ocid,
    pp.full_name,
    pp.avatar_url,
    f.created_at AS followed_at
  FROM public.follows f
  JOIN public.public_profiles pp
    ON pp.id::text = f.subject_id
  WHERE private.is_followable_subject('user', p_user_id::text, NULL)
    AND f.follower_id = p_user_id
    AND f.subject_type = 'user'
  ORDER BY f.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 50);
$$;

REVOKE ALL ON FUNCTION private.list_user_following_v1(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.list_user_following_v1(uuid, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_user_following_v1(
  p_user_id uuid,
  p_limit integer DEFAULT 50
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
  SELECT * FROM private.list_user_following_v1(p_user_id, p_limit);
$$;

REVOKE ALL ON FUNCTION public.list_user_following_v1(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_user_following_v1(uuid, integer) TO anon, authenticated;

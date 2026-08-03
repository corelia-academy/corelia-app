-- `profiles.following_count` intentionally includes every followable subject
-- (users, courses, hackathons, and projects). This RPC exposes the user-profile
-- subset for the profile UI, where the accompanying dialog lists profiles only.

CREATE OR REPLACE FUNCTION private.get_user_following_profile_count_v1(
  p_user_id uuid
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT count(*)
  FROM public.follows AS f
  JOIN public.public_profiles AS pp
    ON pp.id::text = f.subject_id
  WHERE private.is_followable_subject('user', p_user_id::text, NULL)
    AND f.follower_id = p_user_id
    AND f.subject_type = 'user';
$$;

REVOKE ALL ON FUNCTION private.get_user_following_profile_count_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_user_following_profile_count_v1(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_user_following_profile_count_v1(
  p_user_id uuid
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.get_user_following_profile_count_v1(p_user_id);
$$;

REVOKE ALL ON FUNCTION public.get_user_following_profile_count_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_following_profile_count_v1(uuid) TO anon, authenticated;

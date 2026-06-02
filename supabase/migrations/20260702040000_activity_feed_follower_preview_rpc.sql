-- Public follower previews for followable subjects.
-- Keeps direct follows table SELECT restricted while allowing UI to show public
-- profile followers for public/followable entities.

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
    ON pp.id = f.follower_id
  WHERE p_subject_type IN ('user', 'course', 'hackathon', 'project')
    AND private.is_followable_subject(p_subject_type, p_subject_id, NULL)
    AND f.subject_type = p_subject_type
    AND f.subject_id = p_subject_id
  ORDER BY f.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 12), 1), 50);
$$;

GRANT EXECUTE ON FUNCTION public.list_followers_v1(text, text, integer) TO anon, authenticated;

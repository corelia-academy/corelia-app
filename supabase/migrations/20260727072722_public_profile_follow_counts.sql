-- Public profile pages read from public.public_profiles, while follow counters
-- are maintained on public.profiles by private.follows_adjust_counts(). Keep
-- the safe public projection in sync so counts do not silently become zero.

ALTER TABLE public.public_profiles
  ADD COLUMN IF NOT EXISTS follower_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION internal.sync_public_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.public_profiles (
    id,
    username,
    ocid,
    role,
    full_name,
    avatar_url,
    bio,
    website,
    instructor_origin,
    instructor_headline,
    instructor_bio,
    instructor_organization,
    instructor_website,
    instructor_social_links,
    profile_public,
    follower_count,
    following_count,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NULLIF(NEW.username, ''),
    NULLIF(NEW.ocid, ''),
    COALESCE(NULLIF(NEW.role, ''), 'student'),
    NEW.full_name,
    NEW.avatar_url,
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.bio ELSE NULL END,
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.website ELSE NULL END,
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.instructor_origin ELSE NULL END,
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.instructor_headline ELSE NULL END,
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.instructor_bio ELSE NULL END,
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.instructor_organization ELSE NULL END,
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.instructor_website ELSE NULL END,
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.instructor_social_links ELSE NULL END,
    COALESCE(NEW.profile_public, true),
    GREATEST(COALESCE(NEW.follower_count, 0), 0),
    GREATEST(COALESCE(NEW.following_count, 0), 0),
    COALESCE(NEW.created_at, now()),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    ocid = EXCLUDED.ocid,
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    bio = EXCLUDED.bio,
    website = EXCLUDED.website,
    instructor_origin = EXCLUDED.instructor_origin,
    instructor_headline = EXCLUDED.instructor_headline,
    instructor_bio = EXCLUDED.instructor_bio,
    instructor_organization = EXCLUDED.instructor_organization,
    instructor_website = EXCLUDED.instructor_website,
    instructor_social_links = EXCLUDED.instructor_social_links,
    profile_public = EXCLUDED.profile_public,
    follower_count = EXCLUDED.follower_count,
    following_count = EXCLUDED.following_count,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$;

UPDATE public.public_profiles AS pp
SET
  follower_count = GREATEST(COALESCE(p.follower_count, 0), 0),
  following_count = GREATEST(COALESCE(p.following_count, 0), 0),
  updated_at = now()
FROM public.profiles AS p
WHERE p.id = pp.id;

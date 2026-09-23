ALTER TABLE public.profiles
  ADD COLUMN avatar_config jsonb NOT NULL DEFAULT '{"selections":{},"colors":{}}'::jsonb;

ALTER TABLE public.public_profiles
  ADD COLUMN avatar_config jsonb NOT NULL DEFAULT '{"selections":{},"colors":{}}'::jsonb;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_avatar_config_shape CHECK (
    jsonb_typeof(avatar_config) = 'object'
    AND jsonb_typeof(avatar_config -> 'selections') = 'object'
    AND jsonb_typeof(avatar_config -> 'colors') = 'object'
    AND octet_length(avatar_config::text) <= 4096
  );

ALTER TABLE public.public_profiles
  ADD CONSTRAINT public_profiles_avatar_config_shape CHECK (
    jsonb_typeof(avatar_config) = 'object'
    AND jsonb_typeof(avatar_config -> 'selections') = 'object'
    AND jsonb_typeof(avatar_config -> 'colors') = 'object'
    AND octet_length(avatar_config::text) <= 4096
  );

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
    avatar_seed,
    avatar_config,
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
    NEW.avatar_seed,
    NEW.avatar_config,
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
    avatar_seed = EXCLUDED.avatar_seed,
    avatar_config = EXCLUDED.avatar_config,
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
SET avatar_config = p.avatar_config
FROM public.profiles AS p
WHERE p.id = pp.id;

-- Add instructor_social_links to profiles and public_profiles, and update sync trigger

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS instructor_social_links jsonb DEFAULT NULL;

ALTER TABLE public.public_profiles
  ADD COLUMN IF NOT EXISTS instructor_social_links jsonb DEFAULT NULL;

-- Update sync trigger to include instructor_social_links
CREATE OR REPLACE FUNCTION internal.sync_public_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    NEW.bio,
    NEW.website,
    NEW.instructor_origin,
    NEW.instructor_headline,
    NEW.instructor_bio,
    NEW.instructor_organization,
    NEW.instructor_website,
    NEW.instructor_social_links,
    COALESCE(NEW.profile_public, true),
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
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$;

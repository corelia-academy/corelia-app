-- Fix sync_public_profile trigger to properly scrub data when profile_public is false.
-- This was previously applied in 20260702214400 but was overwritten by 20260705000000_instructor_social_links.sql.

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
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.bio ELSE NULL END,
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.website ELSE NULL END,
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.instructor_origin ELSE NULL END,
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.instructor_headline ELSE NULL END,
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.instructor_bio ELSE NULL END,
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.instructor_organization ELSE NULL END,
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.instructor_website ELSE NULL END,
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.instructor_social_links ELSE NULL END,
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

-- Run backfill specifically to clean up any scrubbed fields that were leaked
UPDATE public.profiles
SET updated_at = now()
WHERE profile_public = false;

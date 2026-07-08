-- Repair public profile synchronization after production migration-history drift.
-- This migration intentionally recreates the trigger functions and triggers, then
-- refreshes every public profile so stale values such as full_name are corrected.

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

CREATE OR REPLACE FUNCTION internal.delete_public_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.public_profiles
  WHERE id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS sync_public_profile_on_profiles ON public.profiles;
CREATE TRIGGER sync_public_profile_on_profiles
  AFTER INSERT OR UPDATE
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION internal.sync_public_profile();

DROP TRIGGER IF EXISTS delete_public_profile_on_profiles ON public.profiles;
CREATE TRIGGER delete_public_profile_on_profiles
  AFTER DELETE
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION internal.delete_public_profile();

-- Insert missing public profiles and refresh existing rows from the canonical source.
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
SELECT
  id,
  NULLIF(username, ''),
  NULLIF(ocid, ''),
  COALESCE(NULLIF(role, ''), 'student'),
  full_name,
  avatar_url,
  CASE WHEN COALESCE(profile_public, true) THEN bio ELSE NULL END,
  CASE WHEN COALESCE(profile_public, true) THEN website ELSE NULL END,
  CASE WHEN COALESCE(profile_public, true) THEN instructor_origin ELSE NULL END,
  CASE WHEN COALESCE(profile_public, true) THEN instructor_headline ELSE NULL END,
  CASE WHEN COALESCE(profile_public, true) THEN instructor_bio ELSE NULL END,
  CASE WHEN COALESCE(profile_public, true) THEN instructor_organization ELSE NULL END,
  CASE WHEN COALESCE(profile_public, true) THEN instructor_website ELSE NULL END,
  CASE WHEN COALESCE(profile_public, true) THEN instructor_social_links ELSE NULL END,
  COALESCE(profile_public, true),
  COALESCE(created_at, now()),
  now()
FROM public.profiles
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

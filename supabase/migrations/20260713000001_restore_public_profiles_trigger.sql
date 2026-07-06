-- Restore the missing triggers for public.public_profiles sync.
-- 20260707000001_security_lint_fixes.sql dropped the legacy public.sync_public_profile()/
-- public.delete_public_profile() duplicates, but the DROP TRIGGER IF EXISTS statements there
-- were unqualified by schema and collaterally dropped the real triggers bound to
-- internal.sync_public_profile()/internal.delete_public_profile() -- they were never recreated.
-- As a result, profiles.profile_public updates stopped propagating to public_profiles at all,
-- which is also why the scrub-logic fix in 20260712000000_fix_sync_public_profile_scrubbing.sql
-- (and its "touch to re-trigger" backfill) had no effect: there was no trigger left to fire.

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

-- Backfill missing public profiles and sync out-of-date profiles.
-- We use ON CONFLICT DO UPDATE to ensure existing but out-of-sync profiles are fully updated.
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

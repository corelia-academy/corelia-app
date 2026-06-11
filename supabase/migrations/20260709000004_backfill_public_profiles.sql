-- Backfill / re-sync public.public_profiles from public.profiles for ALL users.
--
-- public_profiles is normally kept in sync by the AFTER INSERT/UPDATE trigger
-- internal.sync_public_profile(). If any profile predates the trigger (or its
-- row was never updated after the table was introduced), it can be missing from
-- public_profiles, which makes the public profile page return "User not found".
--
-- This statement upserts every profile using the exact same column mapping as
-- the current trigger (incl. instructor_social_links). It is idempotent — safe
-- to re-run; existing rows are refreshed, missing rows are inserted.

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
  p.id,
  NULLIF(p.username, ''),
  NULLIF(p.ocid, ''),
  COALESCE(NULLIF(p.role, ''), 'student'),
  p.full_name,
  p.avatar_url,
  p.bio,
  p.website,
  p.instructor_origin,
  p.instructor_headline,
  p.instructor_bio,
  p.instructor_organization,
  p.instructor_website,
  p.instructor_social_links,
  COALESCE(p.profile_public, true),
  COALESCE(p.created_at, now()),
  now()
FROM public.profiles p
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

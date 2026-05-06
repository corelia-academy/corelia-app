-- Public user profiles (GitHub-like profile pages)
-- - Add `username` + generic `bio`/`website` + `profile_public` to `public.profiles`
-- - Create a safe `public.public_profiles` table that contains ONLY public fields
-- - Keep `public.public_profiles` in sync via triggers (no direct client writes)

-- 1) Extend canonical profile table with public fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS profile_public boolean NOT NULL DEFAULT true;

-- Case-insensitive uniqueness for usernames.
-- (No citext dependency; use a partial unique index on lower(username))
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL AND username <> '';

-- OCID should be unique if present (handle-style)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_ocid_key
  ON public.profiles (ocid)
  WHERE ocid IS NOT NULL AND ocid <> '';

-- 2) Safe public projection table (no email/phone/bank docs)
CREATE TABLE IF NOT EXISTS public.public_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  username text,
  ocid text,
  role text NOT NULL DEFAULT 'student',
  full_name text,
  avatar_url text,
  bio text,
  website text,
  instructor_origin text,
  instructor_headline text,
  instructor_bio text,
  instructor_organization text,
  instructor_website text,
  profile_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS public_profiles_username_lower_key
  ON public.public_profiles (lower(username))
  WHERE username IS NOT NULL AND username <> '';

CREATE UNIQUE INDEX IF NOT EXISTS public_profiles_ocid_key
  ON public.public_profiles (ocid)
  WHERE ocid IS NOT NULL AND ocid <> '';

CREATE INDEX IF NOT EXISTS public_profiles_role_idx
  ON public.public_profiles (role);

ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;

-- Public can read public profiles only when opted-in
DROP POLICY IF EXISTS public_profiles_select_public ON public.public_profiles;
CREATE POLICY public_profiles_select_public
  ON public.public_profiles FOR SELECT
  TO anon, authenticated
  USING (profile_public = true);

-- No direct client writes (kept in sync by triggers / service role)
REVOKE INSERT, UPDATE, DELETE ON public.public_profiles FROM anon, authenticated;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 3) Sync triggers (source of truth = public.profiles)
-- Drop legacy triggers/functions in exposed schema to avoid RPC exposure.
DROP TRIGGER IF EXISTS sync_public_profile_on_profiles ON public.profiles;
DROP TRIGGER IF EXISTS delete_public_profile_on_profiles ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_public_profile();
DROP FUNCTION IF EXISTS public.delete_public_profile();

-- Keep privileged trigger functions out of exposed schemas.
CREATE SCHEMA IF NOT EXISTS internal;
REVOKE ALL ON SCHEMA internal FROM PUBLIC;

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
  DELETE FROM public.public_profiles WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER sync_public_profile_on_profiles
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION internal.sync_public_profile();

CREATE TRIGGER delete_public_profile_on_profiles
  AFTER DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION internal.delete_public_profile();

-- 4) Backfill existing users (only public fields)
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
  profile_public,
  created_at,
  updated_at
)
SELECT
  p.id,
  NULLIF(p.username, ''),
  NULLIF(p.ocid, ''),
  p.role,
  p.full_name,
  p.avatar_url,
  p.bio,
  p.website,
  p.instructor_origin,
  p.instructor_headline,
  p.instructor_bio,
  p.instructor_organization,
  p.instructor_website,
  COALESCE(p.profile_public, true),
  p.created_at,
  now()
FROM public.profiles p
ON CONFLICT (id) DO NOTHING;


-- 1. Modify RLS for public_profiles to ALWAYS allow reading.
DROP POLICY IF EXISTS public_profiles_select_public ON public.public_profiles;
CREATE POLICY public_profiles_select_public
  ON public.public_profiles FOR SELECT
  TO anon, authenticated
  USING (true);

-- 2. Update trigger to scrub data if profile_public is false.
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
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.bio ELSE NULL END,
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.website ELSE NULL END,
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.instructor_origin ELSE NULL END,
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.instructor_headline ELSE NULL END,
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.instructor_bio ELSE NULL END,
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.instructor_organization ELSE NULL END,
    CASE WHEN COALESCE(NEW.profile_public, true) THEN NEW.instructor_website ELSE NULL END,
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

-- 3. Update existing data by forcing the trigger to run for private profiles
UPDATE public.profiles
SET updated_at = now()
WHERE profile_public = false;

-- 4. Open read access for public OCC data
DROP POLICY IF EXISTS credential_issuances_select_public_minted ON public.credential_issuances;
CREATE POLICY credential_issuances_select_public_minted
  ON public.credential_issuances FOR SELECT
  TO anon, authenticated
  USING (status = 'minted');

DROP POLICY IF EXISTS enrollments_select_public_certificates ON public.enrollments;
CREATE POLICY enrollments_select_public_certificates
  ON public.enrollments FOR SELECT
  TO anon, authenticated
  USING (certificate_issued_at IS NOT NULL);

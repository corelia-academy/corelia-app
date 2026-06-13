-- Creator course v1:
-- - Any authenticated user can create their own draft courses.
-- - Publishing marks the profile as a creator.
-- - Draft/published course quotas are tier-aware and enforced in the database.
-- - public_profiles exposes safe creator metadata for profile pages.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_creator boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS creator_first_published_at timestamptz;

ALTER TABLE public.public_profiles
  ADD COLUMN IF NOT EXISTS is_creator boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS creator_first_published_at timestamptz;

ALTER TABLE public.tier_limits
  ADD COLUMN IF NOT EXISTS draft_course_limit int,
  ADD COLUMN IF NOT EXISTS published_course_limit int,
  ADD COLUMN IF NOT EXISTS course_create_hourly_limit int,
  ADD COLUMN IF NOT EXISTS course_create_daily_limit int,
  ADD COLUMN IF NOT EXISTS course_lessons_per_course_limit int,
  ADD COLUMN IF NOT EXISTS course_playlist_video_limit int;

UPDATE public.tier_limits SET
  draft_course_limit = 3,
  published_course_limit = 1,
  course_create_hourly_limit = 2,
  course_create_daily_limit = 5,
  course_lessons_per_course_limit = 30,
  course_playlist_video_limit = 30,
  updated_at = now()
WHERE tier = 'free';

UPDATE public.tier_limits SET
  draft_course_limit = 10,
  published_course_limit = 5,
  course_create_hourly_limit = 5,
  course_create_daily_limit = 15,
  course_lessons_per_course_limit = 100,
  course_playlist_video_limit = 50,
  updated_at = now()
WHERE tier = 'student';

UPDATE public.tier_limits SET
  draft_course_limit = 30,
  published_course_limit = 20,
  course_create_hourly_limit = 10,
  course_create_daily_limit = 50,
  course_lessons_per_course_limit = 200,
  course_playlist_video_limit = 100,
  updated_at = now()
WHERE tier = 'pro';

UPDATE public.tier_limits SET
  draft_course_limit = 100,
  published_course_limit = NULL,
  course_create_hourly_limit = 20,
  course_create_daily_limit = 200,
  course_lessons_per_course_limit = 500,
  course_playlist_video_limit = 200,
  updated_at = now()
WHERE tier = 'bootcamp';

CREATE OR REPLACE FUNCTION private.current_creator_tier(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT COALESCE(
    (
      SELECT s.tier
      FROM public.ai_subscriptions s
      WHERE s.user_id = p_user_id
        AND s.status = 'active'
        AND s.expires_at > now()
      ORDER BY s.expires_at DESC
      LIMIT 1
    ),
    (
      SELECT p.tier
      FROM public.profiles p
      WHERE p.id = p_user_id
    ),
    'free'
  );
$$;

CREATE OR REPLACE FUNCTION private.user_course_count(p_user_id uuid, p_status text)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT count(*)::int
  FROM public.courses c
  WHERE c.instructor_id = p_user_id
    AND COALESCE(c.data->>'deleted_at', '') = ''
    AND (
      (p_status = 'draft' AND c.published = false)
      OR (p_status = 'published' AND c.published = true)
      OR p_status = 'all'
    );
$$;

CREATE OR REPLACE FUNCTION private.check_course_quota_impl(p_action text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tier text;
  v_limit int;
  v_current int;
  v_hourly_limit int;
  v_daily_limit int;
  v_hourly_current int;
  v_daily_current int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'unauthenticated',
      'current', 0,
      'limit', 0
    );
  END IF;

  IF public.is_admin_or_support() THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', null,
      'tier', 'staff',
      'current', 0,
      'limit', null
    );
  END IF;

  v_tier := private.current_creator_tier(v_user_id);

  IF p_action = 'publish_course' THEN
    SELECT published_course_limit INTO v_limit
    FROM public.tier_limits
    WHERE tier = v_tier;

    v_current := private.user_course_count(v_user_id, 'published');

    RETURN jsonb_build_object(
      'allowed', v_limit IS NULL OR v_current < v_limit,
      'reason', CASE WHEN v_limit IS NOT NULL AND v_current >= v_limit THEN 'published_course_limit' ELSE null END,
      'tier', v_tier,
      'current', v_current,
      'limit', v_limit
    );
  END IF;

  IF p_action = 'create_course' THEN
    SELECT draft_course_limit, course_create_hourly_limit, course_create_daily_limit
    INTO v_limit, v_hourly_limit, v_daily_limit
    FROM public.tier_limits
    WHERE tier = v_tier;

    v_current := private.user_course_count(v_user_id, 'draft');

    SELECT count(*)::int INTO v_hourly_current
    FROM public.courses c
    WHERE c.instructor_id = v_user_id
      AND c.created_at >= now() - interval '1 hour';

    SELECT count(*)::int INTO v_daily_current
    FROM public.courses c
    WHERE c.instructor_id = v_user_id
      AND c.created_at >= now() - interval '24 hours';

    IF v_limit IS NOT NULL AND v_current >= v_limit THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'draft_course_limit',
        'tier', v_tier,
        'current', v_current,
        'limit', v_limit
      );
    END IF;

    IF v_hourly_limit IS NOT NULL AND v_hourly_current >= v_hourly_limit THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'course_create_hourly_limit',
        'tier', v_tier,
        'current', v_hourly_current,
        'limit', v_hourly_limit,
        'retry_after_seconds', 3600
      );
    END IF;

    IF v_daily_limit IS NOT NULL AND v_daily_current >= v_daily_limit THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'course_create_daily_limit',
        'tier', v_tier,
        'current', v_daily_current,
        'limit', v_daily_limit,
        'retry_after_seconds', 86400
      );
    END IF;

    RETURN jsonb_build_object(
      'allowed', true,
      'reason', null,
      'tier', v_tier,
      'current', v_current,
      'limit', v_limit
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', false,
    'reason', 'unknown_action',
    'tier', v_tier,
    'current', 0,
    'limit', 0
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_course_quota(p_action text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT private.check_course_quota_impl(p_action);
$$;

CREATE OR REPLACE FUNCTION private.enforce_creator_course_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_quota jsonb;
BEGIN
  IF v_user_id IS NULL OR public.is_admin_or_support() THEN
    RETURN NEW;
  END IF;

  IF NEW.instructor_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'course_owner_must_match_current_user'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.published = true THEN
      RAISE EXCEPTION 'new_courses_must_start_as_draft'
        USING ERRCODE = '42501';
    END IF;

    v_quota := public.check_course_quota('create_course');
    IF COALESCE((v_quota->>'allowed')::boolean, false) = false THEN
      RAISE EXCEPTION 'course_quota_exceeded:%', COALESCE(v_quota->>'reason', 'unknown')
        USING ERRCODE = '23514';
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.published IS DISTINCT FROM true AND NEW.published = true THEN
    v_quota := public.check_course_quota('publish_course');
    IF COALESCE((v_quota->>'allowed')::boolean, false) = false THEN
      RAISE EXCEPTION 'course_quota_exceeded:%', COALESCE(v_quota->>'reason', 'unknown')
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_creator_course_write ON public.courses;
CREATE TRIGGER trg_enforce_creator_course_write
  BEFORE INSERT OR UPDATE OF instructor_id, published ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_creator_course_write();

CREATE OR REPLACE FUNCTION private.mark_profile_creator_on_course_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NEW.published = true AND (TG_OP = 'INSERT' OR OLD.published IS DISTINCT FROM true) THEN
    UPDATE public.profiles
    SET
      is_creator = true,
      creator_first_published_at = COALESCE(creator_first_published_at, now()),
      updated_at = now()
    WHERE id = NEW.instructor_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_profile_creator_on_course_publish ON public.courses;
CREATE TRIGGER trg_mark_profile_creator_on_course_publish
  AFTER INSERT OR UPDATE OF published ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION private.mark_profile_creator_on_course_publish();

DROP POLICY IF EXISTS courses_insert_manager ON public.courses;
CREATE POLICY courses_insert_manager
  ON public.courses FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (
      public.is_admin_or_support()
      OR (
        instructor_id = (SELECT auth.uid())
        AND published = false
      )
    )
  );

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
    is_creator,
    creator_first_published_at,
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
    COALESCE(NEW.is_creator, false),
    NEW.creator_first_published_at,
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
    is_creator = EXCLUDED.is_creator,
    creator_first_published_at = EXCLUDED.creator_first_published_at,
    profile_public = EXCLUDED.profile_public,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$;

UPDATE public.profiles p
SET
  is_creator = true,
  creator_first_published_at = COALESCE(
    p.creator_first_published_at,
    first_publish.first_published_at
  ),
  updated_at = now()
FROM (
  SELECT instructor_id, min(updated_at) AS first_published_at
  FROM public.courses
  WHERE published = true
  GROUP BY instructor_id
) first_publish
WHERE p.id = first_publish.instructor_id;

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
  is_creator,
  creator_first_published_at,
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
  COALESCE(p.is_creator, false),
  p.creator_first_published_at,
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
  is_creator = EXCLUDED.is_creator,
  creator_first_published_at = EXCLUDED.creator_first_published_at,
  profile_public = EXCLUDED.profile_public,
  updated_at = EXCLUDED.updated_at;

GRANT EXECUTE ON FUNCTION private.current_creator_tier(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.user_course_count(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.check_course_quota_impl(text) TO authenticated;
REVOKE ALL ON FUNCTION public.check_course_quota(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_course_quota(text) TO authenticated;

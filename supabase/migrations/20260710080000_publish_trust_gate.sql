-- Publish trust gate for the open creator model.
-- Keeps draft creation open, but requires a minimally trusted account before
-- a course can become public.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trust_score smallint NOT NULL DEFAULT 0 CHECK (trust_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS spam_strikes smallint NOT NULL DEFAULT 0 CHECK (spam_strikes >= 0),
  ADD COLUMN IF NOT EXISTS publishing_blocked_until timestamptz;

CREATE OR REPLACE FUNCTION private.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_privileged boolean := (v_uid IS NULL) OR public.is_admin_or_support();
  v_role_changed boolean := TG_OP = 'INSERT' OR NEW.role IS DISTINCT FROM OLD.role;
  v_tier_changed boolean := TG_OP = 'INSERT' OR NEW.tier IS DISTINCT FROM OLD.tier;
BEGIN
  IF TG_OP = 'INSERT' AND NOT v_is_privileged THEN
    IF NEW.role IS DISTINCT FROM 'student' OR NEW.tier IS DISTINCT FROM 'free' THEN
      INSERT INTO private.profile_privilege_audit
        (target_id, actor_id, old_role, new_role, old_tier, new_tier, was_admin_caller, blocked)
      VALUES
        (NEW.id, v_uid, NULL, NEW.role, NULL, NEW.tier, v_is_privileged, true);
    END IF;

    NEW.role := 'student';
    NEW.tier := 'free';
    NEW.trust_score := 0;
    NEW.spam_strikes := 0;
    NEW.publishing_blocked_until := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (v_role_changed OR v_tier_changed) THEN
    INSERT INTO private.profile_privilege_audit
      (target_id, actor_id, old_role, new_role, old_tier, new_tier, was_admin_caller, blocked)
    VALUES
      (OLD.id, v_uid, OLD.role, NEW.role, OLD.tier, NEW.tier, v_is_privileged, NOT v_is_privileged);
  END IF;

  -- Non-privileged callers may edit public profile fields, but never plan,
  -- role, or trust/safety controls used by publish gates.
  IF NOT v_is_privileged THEN
    NEW.role := OLD.role;
    NEW.tier := OLD.tier;
    NEW.trust_score := OLD.trust_score;
    NEW.spam_strikes := OLD.spam_strikes;
    NEW.publishing_blocked_until := OLD.publishing_blocked_until;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER guard_profile_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_profile_privileged_columns();

CREATE OR REPLACE FUNCTION private.can_user_publish_course(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_tier text;
  v_email_confirmed_at timestamptz;
  v_created_at timestamptz;
  v_trust_score int := 0;
  v_spam_strikes int := 0;
  v_blocked_until timestamptz;
  v_effective_trust int := 0;
  v_retry_after int;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  END IF;

  IF public.is_admin_or_support() THEN
    RETURN jsonb_build_object('allowed', true, 'reason', null, 'tier', 'staff');
  END IF;

  SELECT u.email_confirmed_at, u.created_at
    INTO v_email_confirmed_at, v_created_at
  FROM auth.users u
  WHERE u.id = p_user_id;

  IF v_created_at IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'auth_user_missing');
  END IF;

  SELECT
    COALESCE(p.trust_score, 0),
    COALESCE(p.spam_strikes, 0),
    p.publishing_blocked_until
    INTO v_trust_score, v_spam_strikes, v_blocked_until
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_email_confirmed_at IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'email_unverified');
  END IF;

  IF v_blocked_until IS NOT NULL AND v_blocked_until > now() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'publishing_blocked',
      'blocked_until', v_blocked_until,
      'retry_after_seconds', greatest(0, floor(extract(epoch FROM (v_blocked_until - now())))::int)
    );
  END IF;

  IF v_spam_strikes >= 3 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'spam_strikes',
      'current', v_spam_strikes,
      'limit', 3
    );
  END IF;

  v_tier := private.current_creator_tier(p_user_id);

  IF v_tier = 'free' AND v_created_at > now() - interval '24 hours' THEN
    v_retry_after := greatest(0, floor(extract(epoch FROM ((v_created_at + interval '24 hours') - now())))::int);
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'account_too_new',
      'tier', v_tier,
      'retry_after_seconds', v_retry_after
    );
  END IF;

  v_effective_trust := v_trust_score;
  IF v_email_confirmed_at IS NOT NULL THEN
    v_effective_trust := v_effective_trust + 10;
  END IF;
  IF v_created_at <= now() - interval '7 days' THEN
    v_effective_trust := v_effective_trust + 5;
  END IF;
  IF v_created_at <= now() - interval '30 days' THEN
    v_effective_trust := v_effective_trust + 10;
  END IF;

  IF v_effective_trust < 10 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'trust_score_too_low',
      'current', v_effective_trust,
      'limit', 10
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', null,
    'tier', v_tier,
    'trust_score', v_effective_trust
  );
END;
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
  v_publish_gate jsonb;
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
    v_publish_gate := private.can_user_publish_course(v_user_id);
    IF COALESCE((v_publish_gate->>'allowed')::boolean, false) = false THEN
      RETURN v_publish_gate || jsonb_build_object('tier', v_tier);
    END IF;

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

  IF p_action = 'generate_course' THEN
    SELECT course_create_hourly_limit, course_create_daily_limit
    INTO v_hourly_limit, v_daily_limit
    FROM public.tier_limits
    WHERE tier = v_tier;

    SELECT count(*)::int INTO v_hourly_current
    FROM public.ai_course_generations g
    WHERE g.user_id = v_user_id
      AND g.created_at >= now() - interval '1 hour'
      AND g.status <> 'failed';

    SELECT count(*)::int INTO v_daily_current
    FROM public.ai_course_generations g
    WHERE g.user_id = v_user_id
      AND g.created_at >= now() - interval '24 hours'
      AND g.status <> 'failed';

    IF v_hourly_limit IS NOT NULL AND v_hourly_current >= v_hourly_limit THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'course_generate_hourly_limit',
        'tier', v_tier,
        'current', v_hourly_current,
        'limit', v_hourly_limit,
        'retry_after_seconds', 3600
      );
    END IF;

    IF v_daily_limit IS NOT NULL AND v_daily_current >= v_daily_limit THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'course_generate_daily_limit',
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
      'current', v_daily_current,
      'limit', v_daily_limit
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

REVOKE ALL ON FUNCTION private.can_user_publish_course(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_user_publish_course(uuid) TO authenticated;

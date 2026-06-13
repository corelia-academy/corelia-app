-- Extend creator quota checks with an explicit AI generation action.
-- This complements monthly Cora message accounting with burst/rate limits.

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

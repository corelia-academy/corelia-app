-- Harden AI course-generation reservation so cost/rate limits are enforced
-- server-side even if a caller bypasses the frontend.

CREATE OR REPLACE FUNCTION public.reserve_course_generation(
  p_mode text,
  p_videos_count int DEFAULT 0,
  p_sections_count int DEFAULT 6,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
  v_quote jsonb;
  v_generation_quota jsonb;
  v_generation_id bigint;
  v_month text := private.month_key();
  v_now timestamptz := now();
  v_cost int;
  v_model text;
  v_tier text;
  v_video_limit int;
  v_videos_count int;
  v_sections_count int;
  v_payload_max_videos int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('reserved', false, 'reason', 'unauthenticated');
  END IF;

  IF p_mode NOT IN ('prompt', 'youtube_playlist', 'youtube_video_list') THEN
    RETURN jsonb_build_object('reserved', false, 'reason', 'invalid_mode');
  END IF;

  -- Serialize reservations per user/month to avoid double-spending message quota.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || v_month, 0));

  v_generation_quota := private.check_course_quota_impl('generate_course');
  IF COALESCE((v_generation_quota->>'allowed')::boolean, false) = false THEN
    RETURN v_generation_quota || jsonb_build_object(
      'reserved', false,
      'reason', COALESCE(v_generation_quota->>'reason', 'rate_limited')
    );
  END IF;

  v_tier := private.current_creator_tier(v_user_id);
  SELECT course_playlist_video_limit INTO v_video_limit
  FROM public.tier_limits
  WHERE tier = v_tier;

  v_sections_count := greatest(3, least(12, COALESCE(p_sections_count, 6)));

  IF p_mode = 'youtube_video_list' THEN
    v_videos_count := CASE
      WHEN jsonb_typeof(v_payload->'videoUrls') = 'array'
        THEN jsonb_array_length(v_payload->'videoUrls')
      ELSE greatest(0, COALESCE(p_videos_count, 0))
    END;
  ELSIF p_mode = 'youtube_playlist' THEN
    v_payload_max_videos := CASE
      WHEN COALESCE(v_payload->>'maxVideos', '') ~ '^[0-9]+$'
        THEN (v_payload->>'maxVideos')::int
      ELSE NULL
    END;
    v_videos_count := greatest(1, least(200, COALESCE(v_payload_max_videos, p_videos_count, 12)));
  ELSE
    v_videos_count := 0;
  END IF;

  IF v_video_limit IS NOT NULL AND v_videos_count > v_video_limit THEN
    RETURN jsonb_build_object(
      'reserved', false,
      'reason', 'course_playlist_video_limit',
      'tier', v_tier,
      'current', v_videos_count,
      'limit', v_video_limit
    );
  END IF;

  v_quote := private.quote_course_generation_cost_impl(v_user_id, p_mode, v_videos_count, v_sections_count);
  IF COALESCE((v_quote->>'available')::boolean, false) = false THEN
    RETURN v_quote || jsonb_build_object('reserved', false, 'reason', COALESCE(v_quote->>'reason', 'quota_exceeded'));
  END IF;

  v_cost := (v_quote->>'estimated_cost')::int;
  v_model := v_quote->>'model';

  INSERT INTO public.ai_course_generations (
    user_id,
    mode,
    tier_at_use,
    model_used,
    videos_count,
    sections_count,
    estimated_cost,
    status,
    payload
  )
  VALUES (
    v_user_id,
    p_mode,
    v_tier,
    v_model,
    v_videos_count,
    v_sections_count,
    v_cost,
    'pending',
    v_payload
  )
  RETURNING id INTO v_generation_id;

  INSERT INTO public.ai_usage_monthly (
    user_id,
    month,
    message_count,
    tokens_used,
    cost_usd,
    created_at,
    updated_at
  )
  VALUES (v_user_id, v_month, v_cost, 0, 0, v_now, v_now)
  ON CONFLICT (user_id, month) DO UPDATE SET
    message_count = public.ai_usage_monthly.message_count + EXCLUDED.message_count,
    updated_at = EXCLUDED.updated_at;

  RETURN v_quote || jsonb_build_object(
    'reserved', true,
    'generation_id', v_generation_id,
    'reserved_cost', v_cost,
    'videos_count', v_videos_count,
    'sections_count', v_sections_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_course_generation(text, int, int, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_course_generation(text, int, int, jsonb) TO authenticated;

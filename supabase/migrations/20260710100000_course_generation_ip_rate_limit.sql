-- Per-IP burst guard for AI course generation.
-- The Edge Function stores only a salted hash in ai_course_generations.payload.

CREATE OR REPLACE FUNCTION public.attach_course_generation_ip_and_check(
  p_generation_id bigint,
  p_ip_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_generation record;
  v_existing_count int := 0;
  v_limit int := 10;
BEGIN
  IF p_generation_id IS NULL OR p_generation_id <= 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_generation_id');
  END IF;

  IF p_ip_hash IS NULL OR char_length(p_ip_hash) < 32 OR char_length(p_ip_hash) > 128 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_ip_hash');
  END IF;

  SELECT *
    INTO v_generation
  FROM public.ai_course_generations
  WHERE id = p_generation_id
  FOR UPDATE;

  IF v_generation.id IS NULL OR v_generation.status <> 'pending' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_generation_reservation');
  END IF;

  SELECT count(*)::int
    INTO v_existing_count
  FROM public.ai_course_generations
  WHERE payload->>'ip_hash' = p_ip_hash
    AND created_at >= now() - interval '1 hour'
    AND status <> 'failed'
    AND id <> p_generation_id;

  IF v_existing_count >= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'ip_generation_hourly_limit',
      'current', v_existing_count,
      'limit', v_limit,
      'retry_after_seconds', 3600
    );
  END IF;

  UPDATE public.ai_course_generations
  SET payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object('ip_hash', p_ip_hash)
  WHERE id = p_generation_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', null,
    'current', v_existing_count,
    'limit', v_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.attach_course_generation_ip_and_check(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_course_generation_ip_and_check(bigint, text) TO service_role;

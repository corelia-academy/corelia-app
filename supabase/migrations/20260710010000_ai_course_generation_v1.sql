-- AI course generation v1 foundations:
-- quote/reserve/settle message-unit costs and keep an audit trail for prompt,
-- YouTube playlist, and pasted YouTube video-list generation modes.

CREATE TABLE IF NOT EXISTS public.course_generation_costs (
  component text PRIMARY KEY,
  cost_msg int NOT NULL CHECK (cost_msg >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id)
);

INSERT INTO public.course_generation_costs (component, cost_msg)
VALUES
  ('base', 3),
  ('per_video', 1),
  ('per_section', 2),
  ('output_generation', 2)
ON CONFLICT (component) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.course_generation_model_multipliers (
  model text PRIMARY KEY,
  multiplier numeric(4,2) NOT NULL CHECK (multiplier > 0)
);

INSERT INTO public.course_generation_model_multipliers (model, multiplier)
VALUES
  ('gpt-5.4-mini', 1.00),
  ('gpt-5.4', 2.00)
ON CONFLICT (model) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ai_course_generations (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('prompt', 'youtube_playlist', 'youtube_video_list')),
  course_id text REFERENCES public.courses (id) ON DELETE SET NULL,
  tier_at_use text NOT NULL CHECK (tier_at_use IN ('free', 'student', 'pro', 'bootcamp')),
  model_used text NOT NULL,
  videos_count int NOT NULL DEFAULT 0 CHECK (videos_count >= 0),
  sections_count int NOT NULL DEFAULT 0 CHECK (sections_count >= 0),
  estimated_cost int NOT NULL CHECK (estimated_cost >= 0),
  actual_cost int CHECK (actual_cost IS NULL OR actual_cost >= 0),
  input_tokens int,
  output_tokens int,
  status text NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS ai_course_generations_user_time_idx
  ON public.ai_course_generations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_course_generations_pending_idx
  ON public.ai_course_generations (created_at)
  WHERE status = 'pending';

ALTER TABLE public.ai_course_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_course_generations_select_own ON public.ai_course_generations;
CREATE POLICY ai_course_generations_select_own
  ON public.ai_course_generations FOR SELECT
  USING (user_id = (SELECT auth.uid()) OR public.is_admin_or_support());

DROP POLICY IF EXISTS ai_course_generations_insert_own ON public.ai_course_generations;
CREATE POLICY ai_course_generations_insert_own
  ON public.ai_course_generations FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin_or_support());

DROP POLICY IF EXISTS ai_course_generations_update_staff ON public.ai_course_generations;
CREATE POLICY ai_course_generations_update_staff
  ON public.ai_course_generations FOR UPDATE
  USING (public.is_admin_or_support())
  WITH CHECK (public.is_admin_or_support());

CREATE OR REPLACE FUNCTION private.month_key(p_now timestamptz DEFAULT now())
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, private
AS $$
  SELECT to_char(p_now AT TIME ZONE 'UTC', 'YYYY-MM');
$$;

CREATE OR REPLACE FUNCTION private.course_generation_model_for_tier(p_tier text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, private
AS $$
  SELECT CASE WHEN p_tier IN ('pro', 'bootcamp') THEN 'gpt-5.4' ELSE 'gpt-5.4-mini' END;
$$;

CREATE OR REPLACE FUNCTION private.quote_course_generation_cost_impl(
  p_user_id uuid,
  p_mode text,
  p_videos_count int DEFAULT 0,
  p_sections_count int DEFAULT 6
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_tier text;
  v_model text;
  v_multiplier numeric(4,2);
  v_base int;
  v_per_video int;
  v_per_section int;
  v_output int;
  v_videos int := greatest(0, COALESCE(p_videos_count, 0));
  v_sections int := greatest(1, COALESCE(p_sections_count, 6));
  v_estimated int;
  v_month text := private.month_key();
  v_used int;
  v_limit int;
  v_available int;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('available', false, 'reason', 'unauthenticated');
  END IF;

  IF p_mode NOT IN ('prompt', 'youtube_playlist', 'youtube_video_list') THEN
    RETURN jsonb_build_object('available', false, 'reason', 'invalid_mode');
  END IF;

  v_tier := private.current_creator_tier(p_user_id);
  v_model := private.course_generation_model_for_tier(v_tier);

  SELECT multiplier INTO v_multiplier
  FROM public.course_generation_model_multipliers
  WHERE model = v_model;

  SELECT cost_msg INTO v_base FROM public.course_generation_costs WHERE component = 'base';
  SELECT cost_msg INTO v_per_video FROM public.course_generation_costs WHERE component = 'per_video';
  SELECT cost_msg INTO v_per_section FROM public.course_generation_costs WHERE component = 'per_section';
  SELECT cost_msg INTO v_output FROM public.course_generation_costs WHERE component = 'output_generation';

  v_estimated := ceil((
    COALESCE(v_base, 3)
    + CASE WHEN p_mode = 'prompt' THEN v_sections * COALESCE(v_per_section, 2) ELSE v_videos * COALESCE(v_per_video, 1) END
    + COALESCE(v_output, 2)
  ) * COALESCE(v_multiplier, 1.0))::int;

  SELECT message_count INTO v_used
  FROM public.ai_usage_monthly
  WHERE user_id = p_user_id
    AND month = v_month;

  SELECT monthly_messages INTO v_limit
  FROM public.tier_limits
  WHERE tier = v_tier;

  v_used := COALESCE(v_used, 0);
  v_available := CASE WHEN v_limit IS NULL THEN NULL ELSE greatest(0, v_limit - v_used) END;

  RETURN jsonb_build_object(
    'estimated_cost', v_estimated,
    'model', v_model,
    'tier', v_tier,
    'message_balance', v_available,
    'available', v_limit IS NULL OR v_estimated <= v_available,
    'would_exceed', v_limit IS NOT NULL AND v_estimated > v_available,
    'balance_after', CASE WHEN v_limit IS NULL THEN NULL ELSE v_available - v_estimated END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.quote_course_generation_cost(
  p_mode text,
  p_videos_count int DEFAULT 0,
  p_sections_count int DEFAULT 6
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT private.quote_course_generation_cost_impl(
    (SELECT auth.uid()),
    p_mode,
    p_videos_count,
    p_sections_count
  );
$$;

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
  v_quote jsonb;
  v_generation_id bigint;
  v_month text := private.month_key();
  v_now timestamptz := now();
  v_cost int;
  v_model text;
  v_tier text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('reserved', false, 'reason', 'unauthenticated');
  END IF;

  v_quote := private.quote_course_generation_cost_impl(v_user_id, p_mode, p_videos_count, p_sections_count);
  IF COALESCE((v_quote->>'available')::boolean, false) = false THEN
    RETURN v_quote || jsonb_build_object('reserved', false, 'reason', COALESCE(v_quote->>'reason', 'quota_exceeded'));
  END IF;

  v_cost := (v_quote->>'estimated_cost')::int;
  v_model := v_quote->>'model';
  v_tier := v_quote->>'tier';

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
    greatest(0, COALESCE(p_videos_count, 0)),
    greatest(1, COALESCE(p_sections_count, 6)),
    v_cost,
    'pending',
    COALESCE(p_payload, '{}'::jsonb)
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
    'reserved_cost', v_cost
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_course_generation(
  p_generation_id bigint,
  p_status text,
  p_course_id text DEFAULT NULL,
  p_input_tokens int DEFAULT NULL,
  p_output_tokens int DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_row public.ai_course_generations%ROWTYPE;
  v_month text;
  v_actual int;
  v_refund int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin_or_support() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.ai_course_generations
  WHERE id = p_generation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('settled', false, 'reason', 'not_found');
  END IF;

  IF v_row.status <> 'pending' THEN
    RETURN jsonb_build_object('settled', true, 'reason', 'already_settled', 'status', v_row.status);
  END IF;

  v_month := private.month_key(v_row.created_at);

  IF p_status = 'succeeded' THEN
    v_actual := least(
      v_row.estimated_cost,
      greatest(1, ceil((COALESCE(p_input_tokens, 0) + COALESCE(p_output_tokens, 0)) / 2000.0)::int)
    );
    v_refund := greatest(0, v_row.estimated_cost - v_actual);

    UPDATE public.ai_course_generations
    SET
      status = 'succeeded',
      course_id = p_course_id,
      actual_cost = v_actual,
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      completed_at = now()
    WHERE id = p_generation_id;
  ELSE
    v_actual := 0;
    v_refund := v_row.estimated_cost;

    UPDATE public.ai_course_generations
    SET
      status = 'refunded',
      actual_cost = 0,
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      error = p_error,
      completed_at = now()
    WHERE id = p_generation_id;
  END IF;

  IF v_refund > 0 THEN
    UPDATE public.ai_usage_monthly
    SET
      message_count = greatest(0, message_count - v_refund),
      updated_at = now()
    WHERE user_id = v_row.user_id
      AND month = v_month;
  END IF;

  RETURN jsonb_build_object(
    'settled', true,
    'refunded', v_refund,
    'final_cost', v_actual
  );
END;
$$;

REVOKE ALL ON FUNCTION public.quote_course_generation_cost(text, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_course_generation(text, int, int, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_course_generation(bigint, text, text, int, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quote_course_generation_cost(text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_course_generation(text, int, int, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_course_generation(bigint, text, text, int, int, text) TO service_role;

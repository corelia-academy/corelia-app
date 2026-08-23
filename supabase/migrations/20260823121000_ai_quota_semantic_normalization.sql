-- C-08: Separate successful message quota, request-attempt soft limits and token telemetry.
-- This is additive/forward-only. Existing aggregate data remains valid as historical
-- successful-usage data; new writes are recorded atomically from the provider-success boundary.

ALTER TABLE public.ai_usage_log
  ADD COLUMN IF NOT EXISTS usage_kind text NOT NULL DEFAULT 'successful_message';

ALTER TABLE public.ai_usage_log
  DROP CONSTRAINT IF EXISTS ai_usage_log_usage_kind_check;

ALTER TABLE public.ai_usage_log
  ADD CONSTRAINT ai_usage_log_usage_kind_check
  CHECK (usage_kind IN ('successful_message'));

COMMENT ON COLUMN public.ai_usage_log.usage_kind IS
  'Canonical semantic: this row is a completed provider response. Failed attempts are not usage rows.';

COMMENT ON COLUMN public.tier_limits.quota_unit IS
  'Legacy rollout field. Cora business quota is message-based; token columns are telemetry only.';

UPDATE public.tier_limits
SET quota_unit = 'message'
WHERE quota_unit IS DISTINCT FROM 'message';

CREATE UNIQUE INDEX IF NOT EXISTS ai_usage_log_successful_conversation_uniq
  ON public.ai_usage_log (feature, conversation_id)
  WHERE usage_kind = 'successful_message' AND conversation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_ai_successful_usage(
  p_user_id uuid,
  p_feature text,
  p_conversation_id uuid,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cost_usd numeric,
  p_estimated boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recorded boolean := false;
  v_date date := (now() AT TIME ZONE 'UTC')::date;
  v_month text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
BEGIN
  INSERT INTO public.ai_usage_log (
    user_id,
    feature,
    conversation_id,
    model,
    input_tokens,
    output_tokens,
    cost_usd,
    estimated,
    usage_kind
  )
  VALUES (
    p_user_id,
    p_feature,
    p_conversation_id,
    p_model,
    p_input_tokens,
    p_output_tokens,
    p_cost_usd,
    p_estimated,
    'successful_message'
  )
  ON CONFLICT (feature, conversation_id)
    WHERE usage_kind = 'successful_message' AND conversation_id IS NOT NULL
    DO NOTHING
  RETURNING true INTO v_recorded;

  IF NOT v_recorded THEN
    RETURN false;
  END IF;

  INSERT INTO public.ai_usage_daily (
    user_id, date, message_count, tokens_used, input_tokens, output_tokens, cost_usd
  )
  VALUES (
    p_user_id, v_date, 1, p_input_tokens + p_output_tokens, p_input_tokens, p_output_tokens, p_cost_usd
  )
  ON CONFLICT (user_id, date) DO UPDATE
  SET
    message_count = public.ai_usage_daily.message_count + 1,
    tokens_used = public.ai_usage_daily.tokens_used + EXCLUDED.tokens_used,
    input_tokens = public.ai_usage_daily.input_tokens + EXCLUDED.input_tokens,
    output_tokens = public.ai_usage_daily.output_tokens + EXCLUDED.output_tokens,
    cost_usd = public.ai_usage_daily.cost_usd + EXCLUDED.cost_usd,
    updated_at = now();

  INSERT INTO public.ai_usage_monthly (
    user_id, month, message_count, tokens_used, input_tokens, output_tokens, cost_usd
  )
  VALUES (
    p_user_id, v_month, 1, p_input_tokens + p_output_tokens, p_input_tokens, p_output_tokens, p_cost_usd
  )
  ON CONFLICT (user_id, month) DO UPDATE
  SET
    message_count = public.ai_usage_monthly.message_count + 1,
    tokens_used = public.ai_usage_monthly.tokens_used + EXCLUDED.tokens_used,
    input_tokens = public.ai_usage_monthly.input_tokens + EXCLUDED.input_tokens,
    output_tokens = public.ai_usage_monthly.output_tokens + EXCLUDED.output_tokens,
    cost_usd = public.ai_usage_monthly.cost_usd + EXCLUDED.cost_usd,
    updated_at = now();

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_ai_successful_usage(
  uuid, text, uuid, text, integer, integer, numeric, boolean
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_ai_successful_usage(
  uuid, text, uuid, text, integer, integer, numeric, boolean
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_successful_usage(
  uuid, text, uuid, text, integer, integer, numeric, boolean
) TO service_role;

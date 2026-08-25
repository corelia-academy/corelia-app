-- R4.1: make live RLS state reproducible from the canonical migration chain.
-- These retained AI tables remain readable for historical/accounting purposes,
-- but client writes must stay denied while the subsystem is retired.

BEGIN;

ALTER TABLE public.ai_model_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tier_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_model_pricing_read_authenticated ON public.ai_model_pricing;
CREATE POLICY ai_model_pricing_read_authenticated
  ON public.ai_model_pricing
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS ai_usage_log_read_own ON public.ai_usage_log;
CREATE POLICY ai_usage_log_read_own
  ON public.ai_usage_log
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS tier_limits_read_all ON public.tier_limits;
CREATE POLICY tier_limits_read_all
  ON public.tier_limits
  FOR SELECT
  TO anon, authenticated
  USING (true);

DO $$
DECLARE
  v_disabled text[];
BEGIN
  SELECT array_agg(c.relname ORDER BY c.relname)
  INTO v_disabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('ai_model_pricing', 'ai_usage_log', 'tier_limits')
    AND NOT c.relrowsecurity;

  IF v_disabled IS NOT NULL THEN
    RAISE EXCEPTION 'R4_RLS_ENABLE_FAILED: %', v_disabled;
  END IF;
END;
$$;

COMMIT;

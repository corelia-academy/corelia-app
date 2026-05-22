-- Token-based AI Quota Refactor — Phase 1
-- Adds token tracking infrastructure. quota_unit defaults to 'message' so
-- enforcement is unchanged until explicitly flipped in tier_limits.

-- A.1: Token columns + rollout control flag on tier_limits
ALTER TABLE public.tier_limits
  ADD COLUMN IF NOT EXISTS monthly_tokens    int,
  ADD COLUMN IF NOT EXISTS rolling_3h_tokens int,
  ADD COLUMN IF NOT EXISTS quota_unit        text NOT NULL DEFAULT 'message'
    CHECK (quota_unit IN ('message', 'token', 'both'));

-- A.1b: Seed token budgets (msg_limit × 2000) — calibrate after 2-week dual-write
UPDATE public.tier_limits SET
  monthly_tokens    = CASE tier
    WHEN 'free'      THEN 100000
    WHEN 'student'   THEN 1400000
    WHEN 'pro'       THEN 2000000
    WHEN 'bootcamp'  THEN 4000000
  END,
  rolling_3h_tokens = CASE tier
    WHEN 'free'      THEN 10000
    WHEN 'student'   THEN 140000
    WHEN 'pro'       THEN 200000
    WHEN 'bootcamp'  THEN 400000
  END,
  quota_unit = 'message';

-- A.2: Per-request usage log (actual tokens from API, not estimates)
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id              bigserial PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature         text NOT NULL,          -- 'cora_chat' | 'course_gen' | 'description_gen' | 'question_gen'
  conversation_id uuid,                   -- nullable; FK to ai_conversations for chat
  model           text NOT NULL,
  input_tokens    int NOT NULL CHECK (input_tokens >= 0),
  output_tokens   int NOT NULL CHECK (output_tokens >= 0),
  total_tokens    int GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  cost_usd        numeric(10,6),
  estimated       boolean NOT NULL DEFAULT false,  -- true when fallback estimator used
  request_id      text,                            -- OpenAI request_id for tracing
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_log_user_time_idx ON public.ai_usage_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_log_feature_idx   ON public.ai_usage_log (feature, created_at DESC);

-- A.3: Split input/output in aggregate tables (total already in tokens_used)
ALTER TABLE public.ai_usage_monthly
  ADD COLUMN IF NOT EXISTS input_tokens  int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens int NOT NULL DEFAULT 0;

ALTER TABLE public.ai_usage_daily
  ADD COLUMN IF NOT EXISTS input_tokens  int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens int NOT NULL DEFAULT 0;

-- F: Model pricing table — replaces hardcoded rates in usageAccounting.ts (wired in v2)
CREATE TABLE IF NOT EXISTS public.ai_model_pricing (
  model             text PRIMARY KEY,
  input_per_1m_usd  numeric(10,4) NOT NULL,
  output_per_1m_usd numeric(10,4) NOT NULL,
  active            boolean NOT NULL DEFAULT true,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.ai_model_pricing (model, input_per_1m_usd, output_per_1m_usd, active, updated_at) VALUES
  ('gpt-5.4-mini', 0.75,  4.50, true, now()),
  ('gpt-5.4',      2.50, 15.00, true, now())
ON CONFLICT (model) DO NOTHING;

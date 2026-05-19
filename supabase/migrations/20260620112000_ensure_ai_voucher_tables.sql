-- Idempotent recovery: create voucher tables if they were not created by
-- 20260519101719_ai_vouchers.sql (migration was recorded but SQL never ran),
-- and add plan-targeting columns if the tables already exist without them.

-- ai_voucher_batches
CREATE TABLE IF NOT EXISTS public.ai_voucher_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  percent_off int NOT NULL CHECK (percent_off BETWEEN 1 AND 100),
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  target_tier text CHECK (target_tier IN ('student', 'pro', 'bootcamp')),
  target_duration_months int CHECK (target_duration_months IN (1, 12)),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT ai_voucher_batches_name_len_chk CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT ai_voucher_batches_window_chk CHECK (
    starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at
  )
);

-- Add plan-targeting columns if the table already existed without them
ALTER TABLE public.ai_voucher_batches
  ADD COLUMN IF NOT EXISTS target_tier text
    CHECK (target_tier IN ('student', 'pro', 'bootcamp')),
  ADD COLUMN IF NOT EXISTS target_duration_months int
    CHECK (target_duration_months IN (1, 12));

-- ai_vouchers
CREATE TABLE IF NOT EXISTS public.ai_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.ai_voucher_batches (id) ON DELETE CASCADE,
  code text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT ai_vouchers_code_format_chk CHECK (code = upper(btrim(code))),
  CONSTRAINT ai_vouchers_code_len_chk CHECK (char_length(code) BETWEEN 4 AND 32)
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_vouchers_code_key ON public.ai_vouchers (code);
CREATE INDEX IF NOT EXISTS ai_vouchers_batch_idx ON public.ai_vouchers (batch_id, created_at DESC);

-- ai_voucher_redemptions
CREATE TABLE IF NOT EXISTS public.ai_voucher_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES public.ai_vouchers (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  payment_transaction_id text NOT NULL REFERENCES public.payment_transactions (id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('reserved', 'paid', 'released')),
  base_amount_vnd int NOT NULL CHECK (base_amount_vnd >= 0),
  discount_amount_vnd int NOT NULL CHECK (discount_amount_vnd >= 0),
  final_amount_vnd int NOT NULL CHECK (final_amount_vnd >= 0),
  reserved_until timestamptz,
  paid_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_voucher_redemptions_reserved_window_chk CHECK (
    status <> 'reserved' OR reserved_until IS NOT NULL
  ),
  CONSTRAINT ai_voucher_redemptions_paid_time_chk CHECK (
    status <> 'paid' OR paid_at IS NOT NULL
  ),
  CONSTRAINT ai_voucher_redemptions_release_time_chk CHECK (
    status <> 'released' OR released_at IS NOT NULL
  ),
  CONSTRAINT ai_voucher_redemptions_discount_chk CHECK (
    final_amount_vnd = base_amount_vnd - discount_amount_vnd
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_voucher_redemptions_payment_tx_key
  ON public.ai_voucher_redemptions (payment_transaction_id);

CREATE UNIQUE INDEX IF NOT EXISTS ai_voucher_redemptions_one_paid_per_voucher
  ON public.ai_voucher_redemptions (voucher_id)
  WHERE status = 'paid';

CREATE INDEX IF NOT EXISTS ai_voucher_redemptions_voucher_status_idx
  ON public.ai_voucher_redemptions (voucher_id, status, reserved_until DESC, paid_at DESC);

CREATE INDEX IF NOT EXISTS ai_voucher_redemptions_user_idx
  ON public.ai_voucher_redemptions (user_id, created_at DESC);

-- RLS
ALTER TABLE public.ai_voucher_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_voucher_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_voucher_batches_admin_select ON public.ai_voucher_batches;
CREATE POLICY ai_voucher_batches_admin_select
  ON public.ai_voucher_batches FOR SELECT
  USING (public.is_admin_or_support());

DROP POLICY IF EXISTS ai_voucher_batches_admin_insert ON public.ai_voucher_batches;
CREATE POLICY ai_voucher_batches_admin_insert
  ON public.ai_voucher_batches FOR INSERT
  WITH CHECK (public.is_admin_or_support());

DROP POLICY IF EXISTS ai_voucher_batches_admin_update ON public.ai_voucher_batches;
CREATE POLICY ai_voucher_batches_admin_update
  ON public.ai_voucher_batches FOR UPDATE
  USING (public.is_admin_or_support())
  WITH CHECK (public.is_admin_or_support());

DROP POLICY IF EXISTS ai_vouchers_admin_select ON public.ai_vouchers;
CREATE POLICY ai_vouchers_admin_select
  ON public.ai_vouchers FOR SELECT
  USING (public.is_admin_or_support());

DROP POLICY IF EXISTS ai_vouchers_admin_insert ON public.ai_vouchers;
CREATE POLICY ai_vouchers_admin_insert
  ON public.ai_vouchers FOR INSERT
  WITH CHECK (public.is_admin_or_support());

DROP POLICY IF EXISTS ai_vouchers_admin_update ON public.ai_vouchers;
CREATE POLICY ai_vouchers_admin_update
  ON public.ai_vouchers FOR UPDATE
  USING (public.is_admin_or_support())
  WITH CHECK (public.is_admin_or_support());

DROP POLICY IF EXISTS ai_voucher_redemptions_admin_select ON public.ai_voucher_redemptions;
CREATE POLICY ai_voucher_redemptions_admin_select
  ON public.ai_voucher_redemptions FOR SELECT
  USING (public.is_admin_or_support());

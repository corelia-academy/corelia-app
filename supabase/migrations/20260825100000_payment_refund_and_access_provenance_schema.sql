-- Master Wave Migration 1: Payment, Refund, and Course Access Provenance Schema
-- Forward-only, data-preserving schema expansion implementing:
-- 1. Expanded payment_transactions statuses (refund_requested, refunded, partially_refunded)
-- 2. New public.payment_refunds table with full audit lifecycle
-- 3. Course access provenance and lifecycle fields (source, status, source_transaction_id, granted_at, revoked_at, revoked_reason)
-- 4. Expanded ai_subscriptions status to include 'refunded'
-- 5. Tightened indexes and RLS policies

-- 1. Expand payment_transactions status check
ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_status_check;

ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_status_check
  CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refund_requested', 'refunded', 'partially_refunded'));

-- 2. Create public.payment_refunds table
CREATE TABLE IF NOT EXISTS public.payment_refunds (
  id text PRIMARY KEY,
  payment_transaction_id text NOT NULL REFERENCES public.payment_transactions (id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  amount_vnd int NOT NULL CHECK (amount_vnd > 0),
  status text NOT NULL CHECK (status IN ('requested', 'approved', 'processing', 'completed', 'rejected', 'failed', 'cancelled')) DEFAULT 'requested',
  reason text NOT NULL,
  requested_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  processed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  provider_refund_id text,
  provider_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Performance & foreign key indexes
CREATE INDEX IF NOT EXISTS payment_refunds_tx_id_idx
  ON public.payment_refunds (payment_transaction_id);

CREATE INDEX IF NOT EXISTS payment_refunds_user_id_idx
  ON public.payment_refunds (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_refunds_status_idx
  ON public.payment_refunds (status);

-- Enable RLS on payment_refunds
ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_refunds_select_own_or_staff ON public.payment_refunds;
CREATE POLICY payment_refunds_select_own_or_staff
  ON public.payment_refunds FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_admin_or_support()
  );

-- Mutating refunds: service role (API/RPC) only — no INSERT/UPDATE/DELETE policy for anon/authenticated

-- 3. Enhance course_payment_access with provenance and lifecycle state
ALTER TABLE public.course_payment_access
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS source_transaction_id text REFERENCES public.payment_transactions (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS granted_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS revoked_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS granted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.course_payment_access
  DROP CONSTRAINT IF EXISTS course_payment_access_source_check;

ALTER TABLE public.course_payment_access
  ADD CONSTRAINT course_payment_access_source_check
  CHECK (source IN ('payment', 'admin_grant', 'voucher', 'free_enrollment', 'legacy'));

ALTER TABLE public.course_payment_access
  DROP CONSTRAINT IF EXISTS course_payment_access_status_check;

ALTER TABLE public.course_payment_access
  ADD CONSTRAINT course_payment_access_status_check
  CHECK (status IN ('active', 'revoked', 'expired'));

CREATE INDEX IF NOT EXISTS course_payment_access_user_status_idx
  ON public.course_payment_access (user_id, course_id, status);

CREATE INDEX IF NOT EXISTS course_payment_access_tx_id_idx
  ON public.course_payment_access (source_transaction_id);

-- 4. Expand ai_subscriptions status check to include 'refunded'
ALTER TABLE public.ai_subscriptions
  DROP CONSTRAINT IF EXISTS ai_subscriptions_status_check;

ALTER TABLE public.ai_subscriptions
  ADD CONSTRAINT ai_subscriptions_status_check
  CHECK (status IN ('active', 'expired', 'cancelled', 'superseded', 'refunded'));

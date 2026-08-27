-- R5: enforce AI retirement at the database write boundary.
--
-- Historical AI payment, subscription, voucher, and redemption rows remain
-- readable and may transition only toward non-entitled terminal states. New or
-- reactivated AI entitlements are rejected even for service-role callers.

CREATE OR REPLACE FUNCTION public.guard_retired_ai_subscription_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'AI_SUBSCRIPTION_RETIRED: New AI subscriptions are disabled.'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.payment_transaction_id IS DISTINCT FROM OLD.payment_transaction_id
     OR NEW.tier IS DISTINCT FROM OLD.tier
     OR NEW.duration_months IS DISTINCT FROM OLD.duration_months
     OR NEW.price_vnd IS DISTINCT FROM OLD.price_vnd
     OR NEW.started_at IS DISTINCT FROM OLD.started_at
     OR NEW.expires_at > OLD.expires_at
     OR (NEW.status = 'active' AND OLD.status <> 'active') THEN
    RAISE EXCEPTION 'AI_SUBSCRIPTION_RETIRED: AI entitlement reactivation or extension is disabled.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_retired_ai_subscription_writes
  ON public.ai_subscriptions;

CREATE TRIGGER trg_guard_retired_ai_subscription_writes
BEFORE INSERT OR UPDATE ON public.ai_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.guard_retired_ai_subscription_writes();

CREATE OR REPLACE FUNCTION public.guard_retired_ai_voucher_redemption_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'AI_VOUCHER_REDEMPTION_RETIRED: New AI voucher redemptions are disabled.'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.status IN ('reserved', 'paid') AND (
       NEW.status IS DISTINCT FROM OLD.status
       OR NEW.voucher_id IS DISTINCT FROM OLD.voucher_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.payment_transaction_id IS DISTINCT FROM OLD.payment_transaction_id
       OR NEW.reserved_until IS DISTINCT FROM OLD.reserved_until
       OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
       OR NEW.discount_amount_vnd IS DISTINCT FROM OLD.discount_amount_vnd
       OR NEW.final_amount_vnd IS DISTINCT FROM OLD.final_amount_vnd
     ) THEN
    RAISE EXCEPTION 'AI_VOUCHER_REDEMPTION_RETIRED: AI voucher reservation or payment is disabled.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_retired_ai_voucher_redemption_writes
  ON public.ai_voucher_redemptions;

CREATE TRIGGER trg_guard_retired_ai_voucher_redemption_writes
BEFORE INSERT OR UPDATE ON public.ai_voucher_redemptions
FOR EACH ROW
EXECUTE FUNCTION public.guard_retired_ai_voucher_redemption_writes();

REVOKE ALL ON FUNCTION public.guard_retired_ai_subscription_writes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_retired_ai_subscription_writes() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_retired_ai_voucher_redemption_writes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_retired_ai_voucher_redemption_writes() FROM anon, authenticated;

COMMENT ON FUNCTION public.guard_retired_ai_subscription_writes() IS
  'R5 retirement guard: preserves historical rows but rejects new/reactivated/extended AI entitlements.';
COMMENT ON FUNCTION public.guard_retired_ai_voucher_redemption_writes() IS
  'R5 retirement guard: preserves historical rows but rejects new voucher reservations/redemptions.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.ai_subscriptions'::regclass
      AND tgname = 'trg_guard_retired_ai_subscription_writes'
      AND NOT tgisinternal
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.ai_voucher_redemptions'::regclass
      AND tgname = 'trg_guard_retired_ai_voucher_redemption_writes'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'R5_AI_RETIREMENT_GUARD_INSTALL_FAILED';
  END IF;
END;
$$;

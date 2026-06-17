-- Fix race condition in AI voucher reservations (#193)

BEGIN;

CREATE OR REPLACE FUNCTION public.reserve_ai_voucher_atomically(
  p_voucher_id uuid,
  p_payment_tx_id text,
  p_user_id uuid,
  p_base_amount int,
  p_discount_amount int,
  p_final_amount int,
  p_reserved_until timestamptz
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lock_key bigint := hashtext(p_voucher_id::text);
  v_conflict boolean;
BEGIN
  -- 1. Acquire transaction-level advisory lock for this voucher
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- 2. Clean up any expired reservations for this voucher
  UPDATE public.ai_voucher_redemptions
  SET status = 'released', released_at = now(), updated_at = now()
  WHERE voucher_id = p_voucher_id AND status = 'reserved' AND reserved_until <= now();

  -- 3. Check for conflict: is there an active reservation or paid redemption for another transaction?
  SELECT EXISTS (
    SELECT 1 FROM public.ai_voucher_redemptions
    WHERE voucher_id = p_voucher_id
      AND (
        status = 'paid'
        OR (status = 'reserved' AND payment_transaction_id <> p_payment_tx_id)
      )
  ) INTO v_conflict;

  IF v_conflict THEN
    RETURN false;
  END IF;

  -- 4. Reserve (upsert to handle our own existing reservation gracefully)
  INSERT INTO public.ai_voucher_redemptions (
    voucher_id, user_id, payment_transaction_id, status,
    base_amount_vnd, discount_amount_vnd, final_amount_vnd,
    reserved_until, updated_at
  ) VALUES (
    p_voucher_id, p_user_id, p_payment_tx_id, 'reserved',
    p_base_amount, p_discount_amount, p_final_amount,
    p_reserved_until, now()
  )
  ON CONFLICT (payment_transaction_id) DO UPDATE SET
    status = 'reserved',
    reserved_until = EXCLUDED.reserved_until,
    updated_at = EXCLUDED.updated_at;

  RETURN true;
END;
$$;

COMMIT;

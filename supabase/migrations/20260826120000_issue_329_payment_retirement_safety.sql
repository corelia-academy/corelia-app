-- Issue #329: preserve historical AI financial reconciliation while keeping
-- retired entitlements closed, make terminal callbacks monotonic, and dedupe
-- provider refund events. Forward-only and data-preserving.

DO $issue_329_provider_refund_id_preflight$
DECLARE
  v_duplicate_provider_refund_id text;
  v_duplicate_count bigint;
  v_transaction_ids text;
BEGIN
  SELECT
    provider_refund_id,
    count(*),
    string_agg(DISTINCT payment_transaction_id, ', ' ORDER BY payment_transaction_id)
  INTO
    v_duplicate_provider_refund_id,
    v_duplicate_count,
    v_transaction_ids
  FROM public.payment_refunds
  WHERE provider_refund_id IS NOT NULL
  GROUP BY provider_refund_id
  HAVING count(*) > 1
  ORDER BY provider_refund_id
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'ISSUE_329_PROVIDER_REFUND_ID_DUPLICATE_PREFLIGHT: provider_refund_id "%" appears on % refund rows (transaction_ids: %). Resolve duplicate provider refund/event IDs before applying global uniqueness.',
      v_duplicate_provider_refund_id,
      v_duplicate_count,
      v_transaction_ids
      USING ERRCODE = '23505';
  END IF;
END
$issue_329_provider_refund_id_preflight$;

CREATE UNIQUE INDEX payment_refunds_provider_refund_id_uidx
  ON public.payment_refunds (provider_refund_id)
  WHERE provider_refund_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reconcile_historical_ai_payment(
  p_payment_transaction_id text,
  p_provider_payload jsonb,
  p_settled_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx public.payment_transactions%ROWTYPE;
  v_cutoff constant timestamptz := '2026-08-25 15:00:00+00'::timestamptz;
  v_effective_settled_at timestamptz := COALESCE(p_settled_at, now());
  v_is_ipn_provenance boolean := false;
  v_is_lookup_provenance boolean := false;
  v_ipn_amount text;
  v_lookup_amount text;
  v_lookup_marker text;
BEGIN
  SELECT *
  INTO v_tx
  FROM public.payment_transactions
  WHERE id = p_payment_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_TRANSACTION_NOT_FOUND: %', p_payment_transaction_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_tx.purpose <> 'ai_subscription'
     OR v_tx.provider <> 'sepay'
     OR v_tx.created_at >= v_cutoff THEN
    RAISE EXCEPTION 'AI_HISTORICAL_RECONCILIATION_NOT_ELIGIBLE: %', p_payment_transaction_id
      USING ERRCODE = '22023';
  END IF;

  IF v_tx.status NOT IN ('pending', 'paid') THEN
    RAISE EXCEPTION 'INVALID_AI_HISTORICAL_PAYMENT_STATUS: %', v_tx.status
      USING ERRCODE = '22000';
  END IF;

  v_ipn_amount := p_provider_payload #>> '{order,order_amount}';
  v_is_ipn_provenance :=
    p_provider_payload->>'notification_type' = 'ORDER_PAID'
    AND p_provider_payload #>> '{order,order_invoice_number}' = v_tx.id
    AND COALESCE(p_provider_payload #>> '{transaction,id}', '') <> ''
    AND v_ipn_amount ~ '^[0-9]+([.][0-9]+)?$'
    AND round(v_ipn_amount::numeric) = v_tx.amount_vnd;

  v_lookup_amount := p_provider_payload #>> '{sepay_transaction,amount_in}';
  v_lookup_marker := lower(concat_ws(
    ' ',
    p_provider_payload #>> '{sepay_transaction,reference_number}',
    p_provider_payload #>> '{sepay_transaction,code}',
    p_provider_payload #>> '{sepay_transaction,transaction_content}'
  ));
  v_is_lookup_provenance :=
    p_provider_payload->>'source' = 'verify_endpoint_sepay_lookup'
    AND COALESCE(p_provider_payload #>> '{sepay_transaction,id}', '') <> ''
    AND lower(COALESCE(p_provider_payload #>> '{sepay_transaction,transfer_type}', 'in')) = 'in'
    AND v_lookup_amount ~ '^[0-9]+([.][0-9]+)?$'
    AND round(v_lookup_amount::numeric) = v_tx.amount_vnd
    AND position(lower(v_tx.id) IN v_lookup_marker) > 0;

  IF NOT (v_is_ipn_provenance OR v_is_lookup_provenance) THEN
    RAISE EXCEPTION 'UNVERIFIED_AI_PAYMENT_PROVIDER_PROVENANCE: %', p_payment_transaction_id
      USING ERRCODE = '22023';
  END IF;

  IF v_tx.status = 'paid' THEN
    UPDATE public.payment_transactions
    SET provider_payload = COALESCE(provider_payload, p_provider_payload),
        settled_at = COALESCE(settled_at, v_effective_settled_at)
    WHERE id = p_payment_transaction_id;

    RETURN jsonb_build_object(
      'ok', true,
      'status', 'already_paid_ai_historical',
      'transaction_id', v_tx.id,
      'settled_at', COALESCE(v_tx.settled_at, v_effective_settled_at)
    );
  END IF;

  -- Deliberately transaction-only: no subscription, voucher, profile, access,
  -- enrollment, quota, or entitlement table is read or written by this path.
  UPDATE public.payment_transactions
  SET status = 'paid',
      provider_payload = p_provider_payload,
      settled_at = v_effective_settled_at
  WHERE id = p_payment_transaction_id
    AND status = 'pending';

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'paid_ai_historical_transaction_only',
    'transaction_id', v_tx.id,
    'settled_at', v_effective_settled_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_unsuccessful_payment_callback(
  p_payment_transaction_id text,
  p_next_status text,
  p_provider_payload jsonb DEFAULT NULL,
  p_updated_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx public.payment_transactions%ROWTYPE;
  v_effective_updated_at timestamptz := COALESCE(p_updated_at, now());
BEGIN
  IF p_next_status NOT IN ('failed', 'cancelled') THEN
    RAISE EXCEPTION 'INVALID_UNSUCCESSFUL_PAYMENT_STATUS: %', p_next_status
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_tx
  FROM public.payment_transactions
  WHERE id = p_payment_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_TRANSACTION_NOT_FOUND: %', p_payment_transaction_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_tx.status <> 'pending' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'transitioned', false,
      'status', v_tx.status,
      'transaction_id', v_tx.id
    );
  END IF;

  UPDATE public.payment_transactions
  SET status = p_next_status,
      provider_payload = COALESCE(p_provider_payload, provider_payload),
      updated_at = v_effective_updated_at
  WHERE id = p_payment_transaction_id
    AND status = 'pending';

  UPDATE public.ai_voucher_redemptions
  SET status = 'released',
      released_at = v_effective_updated_at,
      reserved_until = NULL,
      updated_at = v_effective_updated_at
  WHERE payment_transaction_id = p_payment_transaction_id
    AND status = 'reserved';

  RETURN jsonb_build_object(
    'ok', true,
    'transitioned', true,
    'status', p_next_status,
    'transaction_id', v_tx.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_provider_payment_refund(
  p_payment_transaction_id text,
  p_refund_amount_vnd int,
  p_reason text,
  p_provider_refund_id text,
  p_actor_user_id uuid DEFAULT NULL,
  p_provider_refund_payload jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx public.payment_transactions%ROWTYPE;
  v_existing public.payment_refunds%ROWTYPE;
  v_result jsonb;
  v_refunded_total bigint;
  v_normalized_provider_refund_id text := NULLIF(trim(p_provider_refund_id), '');
BEGIN
  IF v_normalized_provider_refund_id IS NULL THEN
    RAISE EXCEPTION 'MISSING_PROVIDER_REFUND_ID: Provider refund/event id is required.'
      USING ERRCODE = '22023';
  END IF;

  -- Serialize provider event IDs independently of transaction IDs so concurrent
  -- cross-transaction replays deterministically reach the mismatch check below.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('payment_refund_provider_refund_id:' || v_normalized_provider_refund_id, 0)
  );

  SELECT *
  INTO v_tx
  FROM public.payment_transactions
  WHERE id = p_payment_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_TRANSACTION_NOT_FOUND: %', p_payment_transaction_id
      USING ERRCODE = 'P0002';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.payment_refunds
  WHERE provider_refund_id = v_normalized_provider_refund_id
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.payment_transaction_id <> p_payment_transaction_id THEN
      RAISE EXCEPTION
        'PROVIDER_REFUND_ID_TRANSACTION_MISMATCH: provider_refund_id "%" already belongs to transaction "%", not "%".',
        v_normalized_provider_refund_id,
        v_existing.payment_transaction_id,
        p_payment_transaction_id
        USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(sum(amount_vnd), 0)
    INTO v_refunded_total
    FROM public.payment_refunds
    WHERE payment_transaction_id = p_payment_transaction_id
      AND status = 'completed';

    RETURN jsonb_build_object(
      'ok', true,
      'idempotent_replay', true,
      'refund_id', v_existing.id,
      'provider_refund_id', v_existing.provider_refund_id,
      'transaction_id', p_payment_transaction_id,
      'amount_vnd', v_existing.amount_vnd,
      'refunded_total_vnd', v_refunded_total,
      'remaining_refundable_vnd', v_tx.amount_vnd::bigint - v_refunded_total,
      'status', v_tx.status
    );
  END IF;

  v_result := public.process_payment_refund(
    p_payment_transaction_id,
    p_refund_amount_vnd,
    p_reason,
    p_actor_user_id,
    p_provider_refund_payload
  );

  UPDATE public.payment_refunds
  SET provider_refund_id = v_normalized_provider_refund_id
  WHERE id = v_result->>'refund_id';

  RETURN v_result || jsonb_build_object(
    'idempotent_replay', false,
    'provider_refund_id', v_normalized_provider_refund_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_historical_ai_payment(text, jsonb, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_historical_ai_payment(text, jsonb, timestamptz) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_historical_ai_payment(text, jsonb, timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.process_unsuccessful_payment_callback(text, text, jsonb, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_unsuccessful_payment_callback(text, text, jsonb, timestamptz) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_unsuccessful_payment_callback(text, text, jsonb, timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.process_provider_payment_refund(text, int, text, text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_provider_payment_refund(text, int, text, text, uuid, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_provider_payment_refund(text, int, text, text, uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.reconcile_historical_ai_payment(text, jsonb, timestamptz) IS
  'Issue #329 transaction-only reconciliation for verified pre-retirement SePay AI payments; creates no entitlement.';
COMMENT ON FUNCTION public.process_unsuccessful_payment_callback(text, text, jsonb, timestamptz) IS
  'Issue #329 atomic pending-only failed/cancelled transition with same-transaction voucher release.';
COMMENT ON FUNCTION public.process_provider_payment_refund(text, int, text, text, uuid, jsonb) IS
  'Issue #329 provider refund wrapper; provider event IDs are globally unique, same-transaction replays are idempotent, and cross-transaction reuse fails explicitly.';

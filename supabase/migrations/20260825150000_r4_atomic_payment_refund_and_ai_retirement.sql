-- R4: close payment settlement/refund blockers and retire AI monetization effects.
-- Forward-only. Historical payment, refund, voucher, and subscription rows are preserved.

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS settled_at timestamptz;

UPDATE public.payment_transactions
SET settled_at = updated_at
WHERE settled_at IS NULL
  AND status IN ('paid', 'refund_requested', 'partially_refunded', 'refunded');

COMMENT ON COLUMN public.payment_transactions.settled_at IS
  'Immutable provider settlement timestamp. Unlike updated_at, later lifecycle events must not overwrite it.';

ALTER TABLE public.course_payment_access
  ADD COLUMN IF NOT EXISTS full_access_transaction_id text
    REFERENCES public.payment_transactions (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS certificate_fee_transaction_id text
    REFERENCES public.payment_transactions (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS course_payment_access_full_tx_idx
  ON public.course_payment_access (full_access_transaction_id);

CREATE INDEX IF NOT EXISTS course_payment_access_certificate_tx_idx
  ON public.course_payment_access (certificate_fee_transaction_id);

-- Backfill the split provenance fields only for payment-sourced snapshots.
UPDATE public.course_payment_access a
SET full_access_transaction_id = COALESCE(
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.payment_transactions t
      WHERE t.id = a.source_transaction_id
        AND t.user_id = a.user_id
        AND t.course_id = a.course_id
        AND t.purpose = 'course_purchase'
        AND t.status IN ('paid', 'refund_requested', 'partially_refunded')
    ) THEN a.source_transaction_id
  END,
  (
    SELECT t.id
    FROM public.payment_transactions t
    WHERE t.user_id = a.user_id
      AND t.course_id = a.course_id
      AND t.purpose = 'course_purchase'
      AND t.status IN ('paid', 'refund_requested', 'partially_refunded')
    ORDER BY COALESCE(t.settled_at, t.updated_at, t.created_at) DESC, t.id DESC
    LIMIT 1
  )
)
WHERE a.source = 'payment'
  AND a.full_access_granted = true
  AND a.full_access_transaction_id IS NULL;

UPDATE public.course_payment_access a
SET certificate_fee_transaction_id = COALESCE(
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.payment_transactions t
      WHERE t.id = a.source_transaction_id
        AND t.user_id = a.user_id
        AND t.course_id = a.course_id
        AND t.purpose = 'certificate_fee'
        AND t.status IN ('paid', 'refund_requested', 'partially_refunded')
    ) THEN a.source_transaction_id
  END,
  (
    SELECT t.id
    FROM public.payment_transactions t
    WHERE t.user_id = a.user_id
      AND t.course_id = a.course_id
      AND t.purpose = 'certificate_fee'
      AND t.status IN ('paid', 'refund_requested', 'partially_refunded')
    ORDER BY COALESCE(t.settled_at, t.updated_at, t.created_at) DESC, t.id DESC
    LIMIT 1
  )
)
WHERE a.source = 'payment'
  AND a.certificate_fee_paid = true
  AND a.certificate_fee_transaction_id IS NULL;

CREATE OR REPLACE FUNCTION public.process_successful_payment(
  p_payment_transaction_id text,
  p_provider_payload jsonb DEFAULT NULL,
  p_settled_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx public.payment_transactions%ROWTYPE;
  v_access_id text;
  v_enrollment_id text;
  v_effective_settled_at timestamptz;
  v_entitlement_tx public.payment_transactions%ROWTYPE;
  v_retry boolean;
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

  -- AI products are retired. Historical rows remain queryable/refundable, but
  -- no pending or late callback may create or extend an AI entitlement.
  IF v_tx.purpose = 'ai_subscription' THEN
    IF v_tx.status = 'paid' THEN
      RETURN jsonb_build_object(
        'ok', true,
        'status', 'already_paid_ai_retired',
        'transaction_id', v_tx.id,
        'purpose', v_tx.purpose
      );
    END IF;

    RAISE EXCEPTION 'AI_SUBSCRIPTION_RETIRED: New AI subscription settlement is disabled.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_tx.purpose NOT IN ('course_purchase', 'certificate_fee') THEN
    RAISE EXCEPTION 'UNSUPPORTED_PAYMENT_PURPOSE: %', v_tx.purpose
      USING ERRCODE = '22023';
  END IF;

  IF v_tx.status NOT IN ('pending', 'paid') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATUS_FOR_SETTLEMENT: Cannot settle transaction with status %', v_tx.status
      USING ERRCODE = '22000';
  END IF;

  v_retry := v_tx.status = 'paid';
  v_effective_settled_at := CASE
    WHEN v_retry THEN COALESCE(v_tx.settled_at, v_tx.updated_at, v_tx.created_at)
    ELSE COALESCE(p_settled_at, now())
  END;

  IF NOT v_retry THEN
    UPDATE public.payment_transactions
    SET status = 'paid',
        provider_payload = COALESCE(p_provider_payload, provider_payload),
        settled_at = v_effective_settled_at,
        updated_at = v_effective_settled_at
    WHERE id = p_payment_transaction_id;
  ELSIF v_tx.settled_at IS NULL THEN
    UPDATE public.payment_transactions
    SET settled_at = v_effective_settled_at
    WHERE id = p_payment_transaction_id;
  END IF;

  v_access_id := v_tx.user_id || '_' || v_tx.course_id;
  v_enrollment_id := v_tx.user_id || '_' || v_tx.course_id;

  -- A delayed retry for an older paid transaction must not replace provenance
  -- from a newer valid purchase. Reconcile from the latest eligible settled
  -- transaction instead of blindly trusting the callback transaction.
  SELECT *
  INTO v_entitlement_tx
  FROM public.payment_transactions t
  WHERE t.user_id = v_tx.user_id
    AND t.course_id = v_tx.course_id
    AND t.purpose = v_tx.purpose
    AND t.status IN ('paid', 'refund_requested', 'partially_refunded')
  ORDER BY COALESCE(t.settled_at, t.updated_at, t.created_at) DESC, t.id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SETTLED_PAYMENT_NOT_FOUND_AFTER_TRANSITION: %', p_payment_transaction_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_tx.purpose = 'course_purchase' THEN
    INSERT INTO public.course_payment_access (
      id, user_id, course_id,
      full_access_granted, certificate_fee_paid,
      source, status, source_transaction_id,
      full_access_transaction_id,
      granted_at, revoked_at, revoked_reason, updated_at
    )
    VALUES (
      v_access_id, v_tx.user_id, v_tx.course_id,
      true, false,
      'payment', 'active', v_entitlement_tx.id,
      v_entitlement_tx.id,
      COALESCE(v_entitlement_tx.settled_at, v_entitlement_tx.updated_at, v_entitlement_tx.created_at),
      NULL, NULL, v_effective_settled_at
    )
    ON CONFLICT (user_id, course_id) DO UPDATE
    SET full_access_granted = true,
        source = 'payment',
        status = 'active',
        source_transaction_id = v_entitlement_tx.id,
        full_access_transaction_id = v_entitlement_tx.id,
        granted_at = COALESCE(v_entitlement_tx.settled_at, v_entitlement_tx.updated_at, v_entitlement_tx.created_at),
        revoked_at = NULL,
        revoked_reason = NULL,
        updated_at = v_effective_settled_at;

    INSERT INTO public.enrollments (
      id, user_id, course_id, enrolled_at, last_accessed_at,
      paid_provider, paid_amount_vnd, paid_order_id, paid_at
    )
    VALUES (
      v_enrollment_id, v_tx.user_id, v_tx.course_id,
      v_effective_settled_at, v_effective_settled_at,
      v_entitlement_tx.provider, v_entitlement_tx.amount_vnd, v_entitlement_tx.id,
      COALESCE(v_entitlement_tx.settled_at, v_entitlement_tx.updated_at, v_entitlement_tx.created_at)
    )
    ON CONFLICT (user_id, course_id) DO UPDATE
    SET paid_provider = EXCLUDED.paid_provider,
        paid_amount_vnd = EXCLUDED.paid_amount_vnd,
        paid_order_id = EXCLUDED.paid_order_id,
        paid_at = EXCLUDED.paid_at,
        last_accessed_at = EXCLUDED.last_accessed_at;

  ELSIF v_tx.purpose = 'certificate_fee' THEN
    INSERT INTO public.course_payment_access (
      id, user_id, course_id,
      full_access_granted, certificate_fee_paid,
      source, status, source_transaction_id,
      certificate_fee_transaction_id,
      granted_at, updated_at
    )
    VALUES (
      v_access_id, v_tx.user_id, v_tx.course_id,
      false, true,
      'payment', 'active', v_entitlement_tx.id,
      v_entitlement_tx.id,
      COALESCE(v_entitlement_tx.settled_at, v_entitlement_tx.updated_at, v_entitlement_tx.created_at),
      v_effective_settled_at
    )
    ON CONFLICT (user_id, course_id) DO UPDATE
    SET certificate_fee_paid = true,
        status = 'active',
        source = CASE
          WHEN public.course_payment_access.full_access_granted = true
            THEN public.course_payment_access.source
          ELSE 'payment'
        END,
        source_transaction_id = CASE
          WHEN public.course_payment_access.full_access_granted = true
            THEN public.course_payment_access.source_transaction_id
          ELSE v_entitlement_tx.id
        END,
        certificate_fee_transaction_id = v_entitlement_tx.id,
        revoked_at = NULL,
        revoked_reason = NULL,
        updated_at = v_effective_settled_at;
  END IF;

  UPDATE public.ai_voucher_redemptions
  SET status = 'paid',
      paid_at = v_effective_settled_at,
      reserved_until = NULL,
      released_at = NULL,
      updated_at = v_effective_settled_at
  WHERE payment_transaction_id = p_payment_transaction_id
    AND status IN ('reserved', 'paid');

  RETURN jsonb_build_object(
    'ok', true,
    'status', CASE WHEN v_retry THEN 'already_paid_reconciled' ELSE 'paid' END,
    'transaction_id', v_tx.id,
    'purpose', v_tx.purpose,
    'user_id', v_tx.user_id,
    'course_id', v_tx.course_id,
    'settled_at', v_effective_settled_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_payment_refund(
  p_payment_transaction_id text,
  p_refund_amount_vnd int,
  p_reason text,
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
  v_refund_id text;
  v_now timestamptz := now();
  v_refunded_before bigint;
  v_refunded_after bigint;
  v_remaining_before bigint;
  v_is_full_refund boolean;
  v_replacement_tx text;
  v_has_other_active_sub boolean;
BEGIN
  IF p_refund_amount_vnd <= 0 THEN
    RAISE EXCEPTION 'INVALID_REFUND_AMOUNT: Refund amount must be positive.'
      USING ERRCODE = '22023';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'MISSING_REFUND_REASON: Reason is mandatory for refund.'
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

  IF v_tx.status NOT IN ('paid', 'refund_requested', 'partially_refunded') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATUS_FOR_REFUND: Cannot refund transaction with status %', v_tx.status
      USING ERRCODE = '22000';
  END IF;

  SELECT COALESCE(sum(amount_vnd), 0)
  INTO v_refunded_before
  FROM public.payment_refunds
  WHERE payment_transaction_id = p_payment_transaction_id
    AND status = 'completed';

  v_remaining_before := v_tx.amount_vnd::bigint - v_refunded_before;

  IF v_remaining_before <= 0 THEN
    RAISE EXCEPTION 'PAYMENT_ALREADY_FULLY_REFUNDED: %', p_payment_transaction_id
      USING ERRCODE = '22000';
  END IF;

  IF p_refund_amount_vnd::bigint > v_remaining_before THEN
    RAISE EXCEPTION 'REFUND_AMOUNT_EXCEEDS_REMAINING: requested %, remaining %', p_refund_amount_vnd, v_remaining_before
      USING ERRCODE = '22003';
  END IF;

  v_refunded_after := v_refunded_before + p_refund_amount_vnd;
  v_is_full_refund := v_refunded_after = v_tx.amount_vnd::bigint;
  v_refund_id := 'REFUND-' || extract(epoch from v_now)::bigint || '-' || substr(md5(random()::text), 1, 8);

  INSERT INTO public.payment_refunds (
    id, payment_transaction_id, user_id, amount_vnd, status, reason,
    requested_by, processed_by, provider_payload,
    created_at, updated_at, completed_at
  )
  VALUES (
    v_refund_id, p_payment_transaction_id, v_tx.user_id,
    p_refund_amount_vnd, 'completed', p_reason,
    p_actor_user_id, p_actor_user_id, p_provider_refund_payload,
    v_now, v_now, v_now
  );

  UPDATE public.payment_transactions
  SET status = CASE WHEN v_is_full_refund THEN 'refunded' ELSE 'partially_refunded' END,
      updated_at = v_now
  WHERE id = p_payment_transaction_id;

  -- Partial refunds preserve the purchased entitlement until fully refunded.
  IF v_is_full_refund AND v_tx.purpose = 'course_purchase' THEN
    SELECT t.id
    INTO v_replacement_tx
    FROM public.payment_transactions t
    WHERE t.user_id = v_tx.user_id
      AND t.course_id = v_tx.course_id
      AND t.purpose = 'course_purchase'
      AND t.id <> p_payment_transaction_id
      AND t.status IN ('paid', 'refund_requested', 'partially_refunded')
    ORDER BY COALESCE(t.settled_at, t.updated_at, t.created_at) DESC, t.id DESC
    LIMIT 1;

    IF v_replacement_tx IS NOT NULL THEN
      UPDATE public.course_payment_access
      SET full_access_granted = true,
          source = 'payment',
          status = 'active',
          source_transaction_id = v_replacement_tx,
          full_access_transaction_id = v_replacement_tx,
          revoked_at = NULL,
          revoked_reason = NULL,
          updated_at = v_now
      WHERE user_id = v_tx.user_id
        AND course_id = v_tx.course_id
        AND (
          full_access_transaction_id = p_payment_transaction_id
          OR (
            full_access_transaction_id IS NULL
            AND source = 'payment'
            AND source_transaction_id = p_payment_transaction_id
          )
        );
    ELSE
      UPDATE public.course_payment_access
      SET full_access_granted = false,
          full_access_transaction_id = NULL,
          status = CASE WHEN certificate_fee_paid = true THEN 'active' ELSE 'revoked' END,
          revoked_at = CASE WHEN certificate_fee_paid = true THEN NULL ELSE v_now END,
          revoked_reason = CASE WHEN certificate_fee_paid = true THEN NULL ELSE p_reason END,
          updated_at = v_now
      WHERE user_id = v_tx.user_id
        AND course_id = v_tx.course_id
        AND (
          full_access_transaction_id = p_payment_transaction_id
          OR (
            full_access_transaction_id IS NULL
            AND source = 'payment'
            AND source_transaction_id = p_payment_transaction_id
          )
        );
    END IF;

  ELSIF v_is_full_refund AND v_tx.purpose = 'certificate_fee' THEN
    SELECT t.id
    INTO v_replacement_tx
    FROM public.payment_transactions t
    WHERE t.user_id = v_tx.user_id
      AND t.course_id = v_tx.course_id
      AND t.purpose = 'certificate_fee'
      AND t.id <> p_payment_transaction_id
      AND t.status IN ('paid', 'refund_requested', 'partially_refunded')
    ORDER BY COALESCE(t.settled_at, t.updated_at, t.created_at) DESC, t.id DESC
    LIMIT 1;

    IF v_replacement_tx IS NOT NULL THEN
      UPDATE public.course_payment_access
      SET certificate_fee_paid = true,
          certificate_fee_transaction_id = v_replacement_tx,
          status = 'active',
          revoked_at = NULL,
          revoked_reason = NULL,
          updated_at = v_now
      WHERE user_id = v_tx.user_id
        AND course_id = v_tx.course_id
        AND certificate_fee_transaction_id = p_payment_transaction_id;
    ELSE
      UPDATE public.course_payment_access
      SET certificate_fee_paid = false,
          certificate_fee_transaction_id = NULL,
          status = CASE WHEN full_access_granted = true THEN 'active' ELSE 'revoked' END,
          revoked_at = CASE WHEN full_access_granted = true THEN NULL ELSE v_now END,
          revoked_reason = CASE WHEN full_access_granted = true THEN NULL ELSE p_reason END,
          updated_at = v_now
      WHERE user_id = v_tx.user_id
        AND course_id = v_tx.course_id
        AND certificate_fee_transaction_id = p_payment_transaction_id;
    END IF;

  ELSIF v_is_full_refund AND v_tx.purpose = 'ai_subscription' THEN
    UPDATE public.ai_subscriptions
    SET status = 'refunded',
        updated_at = v_now
    WHERE payment_transaction_id = p_payment_transaction_id;

    SELECT EXISTS (
      SELECT 1
      FROM public.ai_subscriptions
      WHERE user_id = v_tx.user_id
        AND status = 'active'
        AND expires_at > v_now
    ) INTO v_has_other_active_sub;

    IF NOT v_has_other_active_sub THEN
      UPDATE public.profiles
      SET tier = 'free',
          updated_at = v_now
      WHERE id = v_tx.user_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'refund_id', v_refund_id,
    'transaction_id', p_payment_transaction_id,
    'amount_vnd', p_refund_amount_vnd,
    'refunded_total_vnd', v_refunded_after,
    'remaining_refundable_vnd', v_tx.amount_vnd::bigint - v_refunded_after,
    'status', CASE WHEN v_is_full_refund THEN 'refunded' ELSE 'partially_refunded' END,
    'revoked_at', CASE WHEN v_is_full_refund THEN v_now ELSE NULL END
  );
END;
$$;

-- SECURITY DEFINER financial functions are callable only by service_role.
REVOKE ALL ON FUNCTION public.process_successful_payment(text, jsonb, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_successful_payment(text, jsonb, timestamptz) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_successful_payment(text, jsonb, timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.process_payment_refund(text, int, text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_payment_refund(text, int, text, uuid, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_refund(text, int, text, uuid, jsonb) TO service_role;

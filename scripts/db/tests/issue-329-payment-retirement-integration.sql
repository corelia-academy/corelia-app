-- Issue #329 real PostgreSQL integration assertions.
-- Run only against the disposable local Supabase database.

DO $issue_329$
DECLARE
  v_buyer uuid := gen_random_uuid();
  v_instructor uuid := gen_random_uuid();
  v_ai_pre text := 'I329-AI-PRE-' || replace(gen_random_uuid()::text, '-', '');
  v_ai_boundary text := 'I329-AI-BOUNDARY-' || replace(gen_random_uuid()::text, '-', '');
  v_ai_unverified text := 'I329-AI-UNVERIFIED-' || replace(gen_random_uuid()::text, '-', '');
  v_pending text := 'I329-PENDING-' || replace(gen_random_uuid()::text, '-', '');
  v_paid text := 'I329-PAID-' || replace(gen_random_uuid()::text, '-', '');
  v_partial text := 'I329-PARTIAL-' || replace(gen_random_uuid()::text, '-', '');
  v_refunded text := 'I329-REFUNDED-' || replace(gen_random_uuid()::text, '-', '');
  v_refund_tx text := 'I329-REFUND-' || replace(gen_random_uuid()::text, '-', '');
  v_refund_other_tx text := 'I329-REFUND-OTHER-' || replace(gen_random_uuid()::text, '-', '');
  v_result jsonb;
  v_before_ai_subscriptions bigint;
  v_refund_count bigint;
  v_refund_total bigint;
  v_profile_tier_before text;
BEGIN
  INSERT INTO auth.users (id, email, role, aud, raw_app_meta_data, raw_user_meta_data)
  VALUES
    (v_buyer, 'i329-buyer-' || v_buyer || '@test.local', 'authenticated', 'authenticated', '{}', '{}'),
    (v_instructor, 'i329-instructor-' || v_instructor || '@test.local', 'authenticated', 'authenticated', '{}', '{}');

  INSERT INTO public.courses (id, instructor_id, published, slug, data)
  VALUES ('i329-payment-course', v_instructor, true, 'i329-payment-course', '{"access_model":"paid_upfront"}')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.payment_transactions
    (id, user_id, course_id, purpose, amount_vnd, provider, status, created_at, updated_at, settled_at)
  VALUES
    (v_ai_pre, v_buyer, 'cora-ai', 'ai_subscription', 149000, 'sepay', 'pending', '2026-08-25 14:59:59+00', '2026-08-25 14:59:59+00', NULL),
    (v_ai_boundary, v_buyer, 'cora-ai', 'ai_subscription', 149000, 'sepay', 'pending', '2026-08-25 15:00:00+00', '2026-08-25 15:00:00+00', NULL),
    (v_ai_unverified, v_buyer, 'cora-ai', 'ai_subscription', 149000, 'sepay', 'pending', '2026-08-25 14:59:58+00', '2026-08-25 14:59:58+00', NULL),
    (v_pending, v_buyer, 'i329-payment-course', 'course_purchase', 100000, 'sepay', 'pending', now(), now(), NULL),
    (v_paid, v_buyer, 'i329-payment-course', 'course_purchase', 100000, 'sepay', 'paid', now(), now(), now()),
    (v_partial, v_buyer, 'i329-payment-course', 'course_purchase', 100000, 'sepay', 'partially_refunded', now(), now(), now()),
    (v_refunded, v_buyer, 'i329-payment-course', 'course_purchase', 100000, 'sepay', 'refunded', now(), now(), now()),
    (v_refund_tx, v_buyer, 'i329-payment-course', 'course_purchase', 100000, 'sepay', 'paid', now(), now(), now()),
    (v_refund_other_tx, v_buyer, 'i329-payment-course', 'course_purchase', 100000, 'sepay', 'paid', now(), now(), now());

  SELECT count(*) INTO v_before_ai_subscriptions FROM public.ai_subscriptions;
  SELECT tier INTO v_profile_tier_before FROM public.profiles WHERE id = v_buyer;

  -- I329-AI-01: a verified pre-retirement callback settles only the transaction.
  v_result := public.reconcile_historical_ai_payment(
    v_ai_pre,
    jsonb_build_object(
      'notification_type', 'ORDER_PAID',
      'order', jsonb_build_object('order_invoice_number', v_ai_pre, 'order_amount', '149000.00'),
      'transaction', jsonb_build_object('id', 'sepay-payment-i329-1')
    ),
    '2026-08-26 12:00:00+00'
  );
  IF v_result->>'status' <> 'paid_ai_historical_transaction_only'
     OR (SELECT status FROM public.payment_transactions WHERE id = v_ai_pre) <> 'paid'
     OR (SELECT settled_at FROM public.payment_transactions WHERE id = v_ai_pre) <> '2026-08-26 12:00:00+00'::timestamptz
     OR (SELECT count(*) FROM public.ai_subscriptions) <> v_before_ai_subscriptions
     OR EXISTS (SELECT 1 FROM public.ai_subscriptions WHERE payment_transaction_id = v_ai_pre)
     OR EXISTS (SELECT 1 FROM public.ai_voucher_redemptions WHERE payment_transaction_id = v_ai_pre)
     OR EXISTS (SELECT 1 FROM public.course_payment_access WHERE user_id = v_buyer AND course_id = 'cora-ai')
     OR EXISTS (SELECT 1 FROM public.enrollments WHERE user_id = v_buyer AND course_id = 'cora-ai')
     OR (SELECT tier FROM public.profiles WHERE id = v_buyer) IS DISTINCT FROM v_profile_tier_before THEN
    RAISE EXCEPTION 'I329-AI-01: historical reconciliation created side effects or failed to settle transaction';
  END IF;

  -- I329-AI-02/03: exact cutoff and unverified provenance fail closed.
  BEGIN
    PERFORM public.reconcile_historical_ai_payment(
      v_ai_boundary,
      jsonb_build_object(
        'notification_type', 'ORDER_PAID',
        'order', jsonb_build_object('order_invoice_number', v_ai_boundary, 'order_amount', '149000'),
        'transaction', jsonb_build_object('id', 'sepay-payment-i329-2')
      ),
      now()
    );
    RAISE EXCEPTION 'I329-AI-02: boundary transaction unexpectedly settled';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    IF SQLERRM NOT LIKE 'AI_HISTORICAL_RECONCILIATION_NOT_ELIGIBLE:%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.reconcile_historical_ai_payment(
      v_ai_unverified,
      jsonb_build_object(
        'notification_type', 'ORDER_PAID',
        'order', jsonb_build_object('order_invoice_number', 'wrong-invoice', 'order_amount', '149000'),
        'transaction', jsonb_build_object('id', 'sepay-payment-i329-3')
      ),
      now()
    );
    RAISE EXCEPTION 'I329-AI-03: unverified transaction unexpectedly settled';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    IF SQLERRM NOT LIKE 'UNVERIFIED_AI_PAYMENT_PROVIDER_PROVENANCE:%' THEN RAISE; END IF;
  END;
  IF EXISTS (
    SELECT 1 FROM public.payment_transactions
    WHERE id IN (v_ai_boundary, v_ai_unverified) AND status <> 'pending'
  ) THEN
    RAISE EXCEPTION 'I329-AI-02/03: rejected AI reconciliation changed status';
  END IF;

  -- I329-STATUS-01/02: only pending transitions; terminal financial states never regress.
  v_result := public.process_unsuccessful_payment_callback(v_pending, 'failed', '{"event":"first"}', now());
  IF v_result->>'transitioned' <> 'true'
     OR (SELECT status FROM public.payment_transactions WHERE id = v_pending) <> 'failed' THEN
    RAISE EXCEPTION 'I329-STATUS-01: pending transaction did not transition';
  END IF;
  v_result := public.process_unsuccessful_payment_callback(v_pending, 'cancelled', '{"event":"late"}', now());
  IF v_result->>'transitioned' <> 'false'
     OR (SELECT status FROM public.payment_transactions WHERE id = v_pending) <> 'failed' THEN
    RAISE EXCEPTION 'I329-STATUS-01: duplicate callback regressed terminal status';
  END IF;
  PERFORM public.process_unsuccessful_payment_callback(v_paid, 'failed', '{}', now());
  PERFORM public.process_unsuccessful_payment_callback(v_partial, 'cancelled', '{}', now());
  PERFORM public.process_unsuccessful_payment_callback(v_refunded, 'failed', '{}', now());
  IF (SELECT status FROM public.payment_transactions WHERE id = v_paid) <> 'paid'
     OR (SELECT status FROM public.payment_transactions WHERE id = v_partial) <> 'partially_refunded'
     OR (SELECT status FROM public.payment_transactions WHERE id = v_refunded) <> 'refunded' THEN
    RAISE EXCEPTION 'I329-STATUS-02: late failed/cancelled callback regressed financial status';
  END IF;

  -- I329-REFUND-01/02: duplicate event is a replay, distinct events preserve full totals.
  v_result := public.process_provider_payment_refund(
    v_refund_tx, 100000, 'provider full refund', 'sepay-refund-i329-1', NULL, '{"event_id":"sepay-refund-i329-1"}'
  );
  IF v_result->>'status' <> 'refunded' OR v_result->>'idempotent_replay' <> 'false' THEN
    RAISE EXCEPTION 'I329-REFUND-01: first provider refund failed';
  END IF;
  v_result := public.process_provider_payment_refund(
    v_refund_tx, 100000, 'provider duplicate', 'sepay-refund-i329-1', NULL, '{"event_id":"sepay-refund-i329-1"}'
  );
  SELECT count(*), COALESCE(sum(amount_vnd), 0)
  INTO v_refund_count, v_refund_total
  FROM public.payment_refunds
  WHERE payment_transaction_id = v_refund_tx AND status = 'completed';
  IF v_result->>'idempotent_replay' <> 'true'
     OR v_refund_count <> 1 OR v_refund_total <> 100000
     OR (SELECT status FROM public.payment_transactions WHERE id = v_refund_tx) <> 'refunded' THEN
    RAISE EXCEPTION 'I329-REFUND-01: duplicate provider event changed accounting';
  END IF;

  -- I329-REFUND-02: a provider event ID cannot be replayed onto another transaction.
  BEGIN
    PERFORM public.process_provider_payment_refund(
      v_refund_other_tx, 100000, 'cross-transaction replay', 'sepay-refund-i329-1', NULL,
      '{"event_id":"sepay-refund-i329-1"}'
    );
    RAISE EXCEPTION 'I329-REFUND-02: cross-transaction provider event replay unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    IF SQLERRM NOT LIKE 'PROVIDER_REFUND_ID_TRANSACTION_MISMATCH:%' THEN RAISE; END IF;
  END;
  IF (SELECT status FROM public.payment_transactions WHERE id = v_refund_other_tx) <> 'paid'
     OR EXISTS (
       SELECT 1 FROM public.payment_refunds WHERE payment_transaction_id = v_refund_other_tx
     ) THEN
    RAISE EXCEPTION 'I329-REFUND-02: rejected cross-transaction replay changed accounting';
  END IF;

  -- I329-REFUND-03: partial refund attempt is strictly rejected.
  BEGIN
    PERFORM public.process_provider_payment_refund(
      v_refund_other_tx, 40000, 'partial attempt', 'sepay-refund-i329-partial', NULL,
      '{"event_id":"sepay-refund-i329-partial"}'
    );
    RAISE EXCEPTION 'I329-REFUND-03: partial provider refund unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    IF SQLERRM NOT LIKE 'PARTIAL_REFUND_NOT_SUPPORTED:%' THEN RAISE; END IF;
  END;

  DELETE FROM public.payment_refunds WHERE payment_transaction_id IN (
    v_ai_pre, v_ai_boundary, v_ai_unverified, v_pending, v_paid, v_partial, v_refunded, v_refund_tx,
    v_refund_other_tx
  );
  DELETE FROM public.course_entitlement_grants WHERE user_id = v_buyer AND course_id = 'i329-payment-course';
  DELETE FROM public.course_payment_access WHERE user_id = v_buyer AND course_id = 'i329-payment-course';
  DELETE FROM public.enrollments WHERE user_id = v_buyer AND course_id = 'i329-payment-course';
  DELETE FROM public.payment_transaction_items WHERE payment_transaction_id IN (
    v_ai_pre, v_ai_boundary, v_ai_unverified, v_pending, v_paid, v_partial, v_refunded, v_refund_tx,
    v_refund_other_tx
  );
  DELETE FROM public.payment_transactions WHERE id IN (
    v_ai_pre, v_ai_boundary, v_ai_unverified, v_pending, v_paid, v_partial, v_refunded, v_refund_tx,
    v_refund_other_tx
  );
  DELETE FROM public.courses WHERE id = 'i329-payment-course';
  DELETE FROM auth.users WHERE id IN (v_buyer, v_instructor);

  RAISE NOTICE 'ISSUE #329 PAYMENT RETIREMENT INTEGRATION PASS';
END
$issue_329$;

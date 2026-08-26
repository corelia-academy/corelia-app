-- R4 real PostgreSQL payment/refund integration suite.
-- Runs only in the disposable local Supabase database.

DO $r4_payment$
DECLARE
  v_buyer uuid := '74000000-0000-4000-8000-000000000001'::uuid;
  v_instructor uuid := '74000000-0000-4000-8000-000000000002'::uuid;
  v_result jsonb;
  v_caught boolean;
  v_count int;
  v_status text;
  v_access public.course_payment_access%ROWTYPE;
BEGIN
  INSERT INTO auth.users (id, email, role, aud, raw_app_meta_data, raw_user_meta_data)
  VALUES
    (v_buyer, 'r4-payment-buyer@test.local', 'authenticated', 'authenticated', '{}', '{}'),
    (v_instructor, 'r4-payment-instructor@test.local', 'authenticated', 'authenticated', '{}', '{}')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.courses (id, instructor_id, published, slug, data)
  VALUES
    ('r4-pay-main', v_instructor, true, 'r4-pay-main', '{"access_model":"paid_upfront"}'),
    ('r4-pay-cert', v_instructor, true, 'r4-pay-cert', '{"access_model":"paid_upfront"}'),
    ('r4-pay-partial', v_instructor, true, 'r4-pay-partial', '{"access_model":"paid_upfront"}'),
    ('r4-pay-repurchase', v_instructor, true, 'r4-pay-repurchase', '{"access_model":"paid_upfront"}'),
    ('r4-pay-failure', v_instructor, true, 'r4-pay-failure', '{"access_model":"paid_upfront"}'),
    ('r4-pay-cert-later', v_instructor, true, 'r4-pay-cert-later', '{"access_model":"paid_upfront"}')
  ON CONFLICT (id) DO NOTHING;

  -- PAY-INT-01: pending course purchase settles atomically.
  INSERT INTO public.payment_transactions
    (id, user_id, course_id, purpose, amount_vnd, provider, status, created_at, updated_at)
  VALUES
    ('R4-PAY-01', v_buyer, 'r4-pay-main', 'course_purchase', 299000, 'sepay', 'pending', now(), now());

  v_result := public.process_successful_payment('R4-PAY-01', '{"provider":"test"}', now());
  IF v_result->>'status' <> 'paid' THEN
    RAISE EXCEPTION 'PAY-INT-01: settlement result was %', v_result;
  END IF;
  SELECT status INTO v_status FROM public.payment_transactions WHERE id = 'R4-PAY-01';
  IF v_status <> 'paid' OR (SELECT settled_at IS NULL FROM public.payment_transactions WHERE id = 'R4-PAY-01') THEN
    RAISE EXCEPTION 'PAY-INT-01: transaction did not become canonically settled';
  END IF;
  SELECT * INTO STRICT v_access FROM public.course_payment_access
  WHERE user_id = v_buyer AND course_id = 'r4-pay-main';
  IF v_access.full_access_granted IS NOT TRUE
     OR v_access.full_access_transaction_id <> 'R4-PAY-01'
     OR v_access.status <> 'active' THEN
    RAISE EXCEPTION 'PAY-INT-01: access side effect missing or invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE user_id = v_buyer AND course_id = 'r4-pay-main' AND paid_order_id = 'R4-PAY-01'
  ) THEN
    RAISE EXCEPTION 'PAY-INT-01: enrollment side effect missing';
  END IF;
  RAISE NOTICE 'PAY-INT-01 PASS';

  -- PAY-INT-02: duplicate webhook is idempotent.
  v_result := public.process_successful_payment('R4-PAY-01', '{"provider":"retry"}', now() + interval '1 hour');
  IF v_result->>'status' <> 'already_paid_reconciled' THEN
    RAISE EXCEPTION 'PAY-INT-02: unexpected retry result %', v_result;
  END IF;
  SELECT count(*) INTO v_count FROM public.course_payment_access
  WHERE user_id = v_buyer AND course_id = 'r4-pay-main';
  IF v_count <> 1 OR (
    SELECT count(*) FROM public.enrollments
    WHERE user_id = v_buyer AND course_id = 'r4-pay-main'
  ) <> 1 THEN
    RAISE EXCEPTION 'PAY-INT-02: duplicate side effects were created';
  END IF;
  RAISE NOTICE 'PAY-INT-02 PASS';

  -- PAY-INT-03: paid historical inconsistency is repaired on retry.
  DELETE FROM public.enrollments WHERE user_id = v_buyer AND course_id = 'r4-pay-main';
  DELETE FROM public.course_payment_access WHERE user_id = v_buyer AND course_id = 'r4-pay-main';
  v_result := public.process_successful_payment('R4-PAY-01', '{}', now());
  IF NOT EXISTS (
    SELECT 1 FROM public.course_payment_access
    WHERE user_id = v_buyer AND course_id = 'r4-pay-main'
      AND full_access_granted = true AND full_access_transaction_id = 'R4-PAY-01'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE user_id = v_buyer AND course_id = 'r4-pay-main' AND paid_order_id = 'R4-PAY-01'
  ) THEN
    RAISE EXCEPTION 'PAY-INT-03: paid retry did not repair missing side effects';
  END IF;
  RAISE NOTICE 'PAY-INT-03 PASS';

  -- PAY-INT-04/05/06: illegal source states cannot be resurrected.
  INSERT INTO public.payment_transactions
    (id, user_id, course_id, purpose, amount_vnd, provider, status, created_at, updated_at)
  VALUES
    ('R4-PAY-FAILED', v_buyer, 'r4-pay-failure', 'course_purchase', 100000, 'sepay', 'failed', now(), now()),
    ('R4-PAY-CANCELLED', v_buyer, 'r4-pay-failure', 'course_purchase', 100000, 'sepay', 'cancelled', now(), now()),
    ('R4-PAY-REFUNDED', v_buyer, 'r4-pay-failure', 'course_purchase', 100000, 'sepay', 'refunded', now(), now());

  FOREACH v_status IN ARRAY ARRAY['R4-PAY-FAILED', 'R4-PAY-CANCELLED', 'R4-PAY-REFUNDED'] LOOP
    v_caught := false;
    BEGIN
      PERFORM public.process_successful_payment(v_status, '{}', now());
    EXCEPTION WHEN SQLSTATE '22000' THEN
      v_caught := true;
    END;
    IF NOT v_caught THEN
      RAISE EXCEPTION 'PAY-INT-04/05/06: illegal settlement was accepted for %', v_status;
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM public.course_payment_access
    WHERE user_id = v_buyer AND course_id = 'r4-pay-failure'
  ) THEN
    RAISE EXCEPTION 'PAY-INT-04/05/06: illegal settlement granted access';
  END IF;
  RAISE NOTICE 'PAY-INT-04 PASS';
  RAISE NOTICE 'PAY-INT-05 PASS';
  RAISE NOTICE 'PAY-INT-06 PASS';

  -- PAY-INT-07: certificate fee grants only certificate entitlement.
  INSERT INTO public.payment_transactions
    (id, user_id, course_id, purpose, amount_vnd, provider, status, created_at, updated_at)
  VALUES
    ('R4-PAY-CERT', v_buyer, 'r4-pay-cert', 'certificate_fee', 50000, 'sepay', 'pending', now(), now());
  PERFORM public.process_successful_payment('R4-PAY-CERT', '{}', now());
  SELECT * INTO STRICT v_access FROM public.course_payment_access
  WHERE user_id = v_buyer AND course_id = 'r4-pay-cert';
  IF v_access.certificate_fee_paid IS NOT TRUE
     OR v_access.full_access_granted IS TRUE
     OR v_access.certificate_fee_transaction_id <> 'R4-PAY-CERT'
     OR EXISTS (
       SELECT 1 FROM public.enrollments
       WHERE user_id = v_buyer AND course_id = 'r4-pay-cert'
     ) THEN
    RAISE EXCEPTION 'PAY-INT-07: certificate payment crossed into course entitlement';
  END IF;
  RAISE NOTICE 'PAY-INT-07 PASS';

  -- PAY-INT-08: late AI settlement fails closed and creates no entitlement.
  INSERT INTO public.payment_transactions
    (id, user_id, course_id, purpose, amount_vnd, provider, status, created_at, updated_at)
  VALUES
    ('R4-PAY-AI', v_buyer, 'cora-ai', 'ai_subscription', 149000, 'sepay', 'pending', now(), now());
  v_caught := false;
  BEGIN
    PERFORM public.process_successful_payment('R4-PAY-AI', '{"subscription_meta":{"tier":"pro","duration_months":1}}', now());
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    v_caught := SQLERRM LIKE 'AI_SUBSCRIPTION_RETIRED:%';
  END;
  IF NOT v_caught
     OR (SELECT status FROM public.payment_transactions WHERE id = 'R4-PAY-AI') <> 'pending'
     OR EXISTS (SELECT 1 FROM public.ai_subscriptions WHERE payment_transaction_id = 'R4-PAY-AI')
     OR EXISTS (SELECT 1 FROM public.course_payment_access WHERE source_transaction_id = 'R4-PAY-AI') THEN
    RAISE EXCEPTION 'PAY-INT-08: late AI settlement did not fail closed';
  END IF;
  RAISE NOTICE 'PAY-INT-08 PASS';

  -- PAY-INT-10: SECURITY DEFINER financial mutations are service-only.
  IF has_function_privilege('anon', 'public.process_successful_payment(text,jsonb,timestamp with time zone)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.process_successful_payment(text,jsonb,timestamp with time zone)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.process_payment_refund(text,integer,text,uuid,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.process_payment_refund(text,integer,text,uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PAY-INT-10: financial SECURITY DEFINER RPC remains client executable';
  END IF;
  RAISE NOTICE 'PAY-INT-10 PASS';

  -- REF-INT-01: full refund writes ledger, revokes access, preserves enrollment.
  v_result := public.process_payment_refund('R4-PAY-01', 299000, 'full refund', v_instructor, '{}');
  IF v_result->>'status' <> 'refunded'
     OR (SELECT status FROM public.payment_transactions WHERE id = 'R4-PAY-01') <> 'refunded'
     OR NOT EXISTS (
       SELECT 1 FROM public.payment_refunds
       WHERE payment_transaction_id = 'R4-PAY-01' AND amount_vnd = 299000 AND status = 'completed'
     )
     OR EXISTS (
       SELECT 1 FROM public.course_payment_access
       WHERE user_id = v_buyer AND course_id = 'r4-pay-main' AND full_access_granted = true
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.enrollments
       WHERE user_id = v_buyer AND course_id = 'r4-pay-main'
     ) THEN
    RAISE EXCEPTION 'REF-INT-01: full refund invariant failed';
  END IF;
  RAISE NOTICE 'REF-INT-01 PASS';

  -- REF-INT-02/03: partial state and remaining refundable amount.
  INSERT INTO public.payment_transactions
    (id, user_id, course_id, purpose, amount_vnd, provider, status, created_at, updated_at)
  VALUES
    ('R4-REF-PARTIAL', v_buyer, 'r4-pay-partial', 'course_purchase', 300000, 'sepay', 'pending', now(), now());
  PERFORM public.process_successful_payment('R4-REF-PARTIAL', '{}', now());
  v_result := public.process_payment_refund('R4-REF-PARTIAL', 100000, 'partial refund', v_instructor, '{}');
  IF v_result->>'status' <> 'partially_refunded'
     OR (v_result->>'remaining_refundable_vnd')::int <> 200000
     OR (SELECT status FROM public.payment_transactions WHERE id = 'R4-REF-PARTIAL') <> 'partially_refunded'
     OR NOT EXISTS (
       SELECT 1 FROM public.course_payment_access
       WHERE user_id = v_buyer AND course_id = 'r4-pay-partial' AND full_access_granted = true
     ) THEN
    RAISE EXCEPTION 'REF-INT-02: partial refund state/access invalid';
  END IF;
  RAISE NOTICE 'REF-INT-02 PASS';

  v_caught := false;
  BEGIN
    PERFORM public.process_payment_refund('R4-REF-PARTIAL', 200001, 'over refund', v_instructor, '{}');
  EXCEPTION WHEN SQLSTATE '22003' THEN
    v_caught := true;
  END;
  IF NOT v_caught OR (
    SELECT COALESCE(sum(amount_vnd), 0) FROM public.payment_refunds
    WHERE payment_transaction_id = 'R4-REF-PARTIAL' AND status = 'completed'
  ) <> 100000 THEN
    RAISE EXCEPTION 'REF-INT-03: over-refund was not rejected atomically';
  END IF;
  RAISE NOTICE 'REF-INT-03 PASS';

  -- REF-INT-05: refunding an old purchase preserves a newer purchase.
  INSERT INTO public.payment_transactions
    (id, user_id, course_id, purpose, amount_vnd, provider, status, created_at, updated_at)
  VALUES
    ('R4-REF-OLD', v_buyer, 'r4-pay-repurchase', 'course_purchase', 200000, 'sepay', 'pending', now() - interval '2 hours', now() - interval '2 hours'),
    ('R4-REF-NEW', v_buyer, 'r4-pay-repurchase', 'course_purchase', 220000, 'sepay', 'pending', now() - interval '1 hour', now() - interval '1 hour');
  PERFORM public.process_successful_payment('R4-REF-OLD', '{}', now() - interval '2 hours');
  PERFORM public.process_successful_payment('R4-REF-NEW', '{}', now() - interval '1 hour');

  -- PAY-INT-11: a delayed duplicate callback for the old transaction must not
  -- overwrite the newer entitlement provenance or enrollment payment source.
  PERFORM public.process_successful_payment('R4-REF-OLD', '{"provider":"delayed-retry"}', now());
  IF (SELECT full_access_transaction_id FROM public.course_payment_access
      WHERE user_id = v_buyer AND course_id = 'r4-pay-repurchase') <> 'R4-REF-NEW'
     OR (SELECT paid_order_id FROM public.enrollments
         WHERE user_id = v_buyer AND course_id = 'r4-pay-repurchase') <> 'R4-REF-NEW' THEN
    RAISE EXCEPTION 'PAY-INT-11: delayed old retry replaced newer provenance';
  END IF;
  RAISE NOTICE 'PAY-INT-11 PASS';

  PERFORM public.process_payment_refund('R4-REF-OLD', 200000, 'refund old purchase', v_instructor, '{}');
  SELECT * INTO STRICT v_access FROM public.course_payment_access
  WHERE user_id = v_buyer AND course_id = 'r4-pay-repurchase';
  IF v_access.full_access_granted IS NOT TRUE
     OR v_access.status <> 'active'
     OR v_access.full_access_transaction_id <> 'R4-REF-NEW' THEN
    RAISE EXCEPTION 'REF-INT-05: old refund revoked/repointed newer entitlement incorrectly';
  END IF;
  RAISE NOTICE 'REF-INT-05 PASS';

  -- REF-INT-06: rejected refund leaves transaction, access, and ledger unchanged.
  INSERT INTO public.payment_transactions
    (id, user_id, course_id, purpose, amount_vnd, provider, status, created_at, updated_at)
  VALUES
    ('R4-REF-FAIL', v_buyer, 'r4-pay-failure', 'course_purchase', 120000, 'sepay', 'pending', now(), now());
  PERFORM public.process_successful_payment('R4-REF-FAIL', '{}', now());
  v_caught := false;
  BEGIN
    PERFORM public.process_payment_refund('R4-REF-FAIL', 120001, 'must fail', v_instructor, '{}');
  EXCEPTION WHEN SQLSTATE '22003' THEN
    v_caught := true;
  END;
  IF NOT v_caught
     OR (SELECT status FROM public.payment_transactions WHERE id = 'R4-REF-FAIL') <> 'paid'
     OR EXISTS (SELECT 1 FROM public.payment_refunds WHERE payment_transaction_id = 'R4-REF-FAIL')
     OR NOT EXISTS (
       SELECT 1 FROM public.course_payment_access
       WHERE user_id = v_buyer AND course_id = 'r4-pay-failure' AND full_access_granted = true
     ) THEN
    RAISE EXCEPTION 'REF-INT-06: failed refund changed canonical state';
  END IF;
  RAISE NOTICE 'REF-INT-06 PASS';

  -- REF-INT-07: refunding an old certificate fee preserves the newer fee.
  INSERT INTO public.payment_transactions
    (id, user_id, course_id, purpose, amount_vnd, provider, status, created_at, updated_at)
  VALUES
    ('R4-CERT-OLD', v_buyer, 'r4-pay-cert-later', 'certificate_fee', 40000, 'sepay', 'pending', now() - interval '2 hours', now() - interval '2 hours'),
    ('R4-CERT-NEW', v_buyer, 'r4-pay-cert-later', 'certificate_fee', 45000, 'sepay', 'pending', now() - interval '1 hour', now() - interval '1 hour');
  PERFORM public.process_successful_payment('R4-CERT-OLD', '{}', now() - interval '2 hours');
  PERFORM public.process_successful_payment('R4-CERT-NEW', '{}', now() - interval '1 hour');
  PERFORM public.process_payment_refund('R4-CERT-OLD', 40000, 'refund old certificate fee', v_instructor, '{}');
  SELECT * INTO STRICT v_access FROM public.course_payment_access
  WHERE user_id = v_buyer AND course_id = 'r4-pay-cert-later';
  IF v_access.certificate_fee_paid IS NOT TRUE
     OR v_access.certificate_fee_transaction_id <> 'R4-CERT-NEW' THEN
    RAISE EXCEPTION 'REF-INT-07: old certificate refund removed newer certificate entitlement';
  END IF;
  RAISE NOTICE 'REF-INT-07 PASS';

  -- Cleanup in FK-safe order.
  DELETE FROM public.payment_refunds WHERE payment_transaction_id LIKE 'R4-%';
  DELETE FROM public.enrollments WHERE user_id = v_buyer AND course_id LIKE 'r4-pay-%';
  DELETE FROM public.course_payment_access WHERE user_id = v_buyer AND course_id LIKE 'r4-pay-%';
  DELETE FROM public.payment_transactions WHERE id LIKE 'R4-%';
  DELETE FROM public.courses WHERE id LIKE 'r4-pay-%';
  DELETE FROM auth.users WHERE id IN (v_buyer, v_instructor);

  RAISE NOTICE 'R4 PAYMENT/REFUND SQL INTEGRATION PASS';
END
$r4_payment$;

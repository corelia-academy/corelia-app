DO $r5_ai_retirement$
DECLARE
  v_user uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_tx_pending text := 'R5-AI-PENDING-' || replace(gen_random_uuid()::text, '-', '');
  v_tx_paid text := 'R5-AI-PAID-' || replace(gen_random_uuid()::text, '-', '');
  v_tx_voucher text := 'R5-AI-VOUCHER-' || replace(gen_random_uuid()::text, '-', '');
  v_batch uuid := gen_random_uuid();
  v_voucher uuid := gen_random_uuid();
  v_redemption uuid := gen_random_uuid();
  v_subscription uuid := gen_random_uuid();
  v_result jsonb;
BEGIN
  INSERT INTO auth.users (id, email, role, aud, raw_app_meta_data, raw_user_meta_data)
  VALUES
    (v_user, 'r5-ai-user-' || v_user || '@test.local', 'authenticated', 'authenticated', '{}', '{}'),
    (v_admin, 'r5-ai-admin-' || v_admin || '@test.local', 'authenticated', 'authenticated', '{}', '{}');

  INSERT INTO public.payment_transactions (
    id, user_id, course_id, purpose, amount_vnd, provider, status, created_at, updated_at
  ) VALUES
    (v_tx_pending, v_user, 'cora-ai', 'ai_subscription', 199000, 'sepay', 'pending', now(), now()),
    (v_tx_paid, v_user, 'cora-ai', 'ai_subscription', 199000, 'sepay', 'paid', now() - interval '60 days', now() - interval '60 days'),
    (v_tx_voucher, v_user, 'cora-ai', 'ai_subscription', 0, 'sepay', 'pending', now(), now());

  -- R5-AI-01: a late callback for a pending AI checkout fails closed.
  BEGIN
    PERFORM public.process_successful_payment(v_tx_pending, '{"source":"r5-test"}'::jsonb, now());
    RAISE EXCEPTION 'R5-AI-01: pending AI settlement unexpectedly succeeded';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM NOT LIKE 'AI_SUBSCRIPTION_RETIRED:%' THEN
        RAISE;
      END IF;
  END;
  IF (SELECT status FROM public.payment_transactions WHERE id = v_tx_pending) <> 'pending'
     OR EXISTS (SELECT 1 FROM public.ai_subscriptions WHERE payment_transaction_id = v_tx_pending) THEN
    RAISE EXCEPTION 'R5-AI-01: rejected settlement mutated history or entitlement';
  END IF;
  RAISE NOTICE 'R5-AI-01 PASS (pending late settlement rejected; zero entitlement)';

  -- R5-AI-02: historical paid retry is deterministic and cannot reactivate.
  v_result := public.process_successful_payment(v_tx_paid, '{"source":"r5-paid-retry"}'::jsonb, now());
  IF v_result->>'status' <> 'already_paid_ai_retired'
     OR EXISTS (SELECT 1 FROM public.ai_subscriptions WHERE payment_transaction_id = v_tx_paid) THEN
    RAISE EXCEPTION 'R5-AI-02: historical paid retry changed entitlement state';
  END IF;
  RAISE NOTICE 'R5-AI-02 PASS (historical paid retry preserved without entitlement)';

  -- R5-AI-03: even service-role/direct table writes cannot create subscriptions.
  BEGIN
    INSERT INTO public.ai_subscriptions (
      id, user_id, tier, duration_months, price_vnd, started_at, expires_at,
      payment_transaction_id, status
    ) VALUES (
      v_subscription, v_user, 'pro', 1, 199000, now(), now() + interval '30 days',
      v_tx_pending, 'active'
    );
    RAISE EXCEPTION 'R5-AI-03: direct subscription insert unexpectedly succeeded';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM NOT LIKE 'AI_SUBSCRIPTION_RETIRED:%' THEN
        RAISE;
      END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.ai_subscriptions WHERE id = v_subscription) THEN
    RAISE EXCEPTION 'R5-AI-03: rejected subscription row remains';
  END IF;
  RAISE NOTICE 'R5-AI-03 PASS (service-role direct subscription insert rejected)';

  -- Build a historical expired fixture with triggers disabled, then prove it
  -- cannot be reactivated or extended once normal enforcement resumes.
  ALTER TABLE public.ai_subscriptions DISABLE TRIGGER trg_guard_retired_ai_subscription_writes;
  INSERT INTO public.ai_subscriptions (
    id, user_id, tier, duration_months, price_vnd, started_at, expires_at,
    payment_transaction_id, status
  ) VALUES (
    v_subscription, v_user, 'pro', 1, 199000,
    now() - interval '60 days', now() - interval '30 days', v_tx_paid, 'expired'
  );
  ALTER TABLE public.ai_subscriptions ENABLE TRIGGER trg_guard_retired_ai_subscription_writes;

  BEGIN
    UPDATE public.ai_subscriptions
    SET status = 'active', expires_at = now() + interval '30 days'
    WHERE id = v_subscription;
    RAISE EXCEPTION 'R5-AI-04: historical subscription reactivation unexpectedly succeeded';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM NOT LIKE 'AI_SUBSCRIPTION_RETIRED:%' THEN
        RAISE;
      END IF;
  END;
  IF (SELECT status FROM public.ai_subscriptions WHERE id = v_subscription) <> 'expired' THEN
    RAISE EXCEPTION 'R5-AI-04: failed reactivation changed historical row';
  END IF;
  RAISE NOTICE 'R5-AI-04 PASS (historical entitlement cannot reactivate or extend)';

  INSERT INTO public.ai_voucher_batches (
    id, name, percent_off, active, created_by, updated_by
  ) VALUES (v_batch, 'R5 retired voucher fixture', 100, false, v_admin, v_admin);
  INSERT INTO public.ai_vouchers (
    id, batch_id, code, active, created_by, updated_by
  ) VALUES (v_voucher, v_batch, 'R5' || upper(substr(replace(v_voucher::text, '-', ''), 1, 12)), false, v_admin, v_admin);

  -- R5-AI-05: no new voucher reservation/redemption may be created.
  BEGIN
    INSERT INTO public.ai_voucher_redemptions (
      id, voucher_id, user_id, payment_transaction_id, status,
      base_amount_vnd, discount_amount_vnd, final_amount_vnd, reserved_until
    ) VALUES (
      v_redemption, v_voucher, v_user, v_tx_voucher, 'reserved',
      199000, 199000, 0, now() + interval '15 minutes'
    );
    RAISE EXCEPTION 'R5-AI-05: direct voucher reservation unexpectedly succeeded';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM NOT LIKE 'AI_VOUCHER_REDEMPTION_RETIRED:%' THEN
        RAISE;
      END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.ai_voucher_redemptions WHERE id = v_redemption) THEN
    RAISE EXCEPTION 'R5-AI-05: rejected voucher redemption row remains';
  END IF;
  RAISE NOTICE 'R5-AI-05 PASS (new voucher redemption rejected)';

  ALTER TABLE public.ai_voucher_redemptions DISABLE TRIGGER trg_guard_retired_ai_voucher_redemption_writes;
  INSERT INTO public.ai_voucher_redemptions (
    id, voucher_id, user_id, payment_transaction_id, status,
    base_amount_vnd, discount_amount_vnd, final_amount_vnd, released_at
  ) VALUES (
    v_redemption, v_voucher, v_user, v_tx_voucher, 'released',
    199000, 199000, 0, now() - interval '1 day'
  );
  ALTER TABLE public.ai_voucher_redemptions ENABLE TRIGGER trg_guard_retired_ai_voucher_redemption_writes;

  BEGIN
    UPDATE public.ai_voucher_redemptions
    SET status = 'reserved', reserved_until = now() + interval '15 minutes', released_at = NULL
    WHERE id = v_redemption;
    RAISE EXCEPTION 'R5-AI-06: released voucher reactivation unexpectedly succeeded';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM NOT LIKE 'AI_VOUCHER_REDEMPTION_RETIRED:%' THEN
        RAISE;
      END IF;
  END;
  IF (SELECT status FROM public.ai_voucher_redemptions WHERE id = v_redemption) <> 'released' THEN
    RAISE EXCEPTION 'R5-AI-06: failed voucher reactivation changed history';
  END IF;
  RAISE NOTICE 'R5-AI-06 PASS (historical voucher cannot be reactivated)';

  DELETE FROM public.ai_voucher_redemptions WHERE id = v_redemption;
  DELETE FROM public.ai_vouchers WHERE id = v_voucher;
  DELETE FROM public.ai_voucher_batches WHERE id = v_batch;
  DELETE FROM public.ai_subscriptions WHERE id = v_subscription;
  DELETE FROM public.payment_transactions WHERE id IN (v_tx_pending, v_tx_paid, v_tx_voucher);
  DELETE FROM auth.users WHERE id IN (v_user, v_admin);

  RAISE NOTICE 'R5 AI FINANCIAL RETIREMENT INTEGRATION PASS (6/6)';
END
$r5_ai_retirement$;

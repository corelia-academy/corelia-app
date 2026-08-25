-- Master Wave Migration 2: Atomic Payment Settlement, Refund State Machine, and Enrollment Integrity RPCs
-- Forward-only, data-preserving migration implementing:
-- 1. Atomic payment settlement RPC: public.process_successful_payment
-- 2. Atomic refund processing RPC: public.process_payment_refund
-- 3. Canonical enrollment RPC: public.enroll_in_course
-- 4. Admin access grant RPC: public.grant_course_access_admin
-- 5. Database trigger guard preventing client privilege escalation on paid course enrollments

-- 1. Atomic payment settlement RPC
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
  v_tx record;
  v_access_id text;
  v_enrollment_id text;
  v_meta jsonb;
  v_tier text;
  v_duration_months int;
  v_expires_at timestamptz;
BEGIN
  -- Lock the payment transaction row against concurrent settlement races
  SELECT *
  INTO v_tx
  FROM public.payment_transactions
  WHERE id = p_payment_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_TRANSACTION_NOT_FOUND: %', p_payment_transaction_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Idempotent check: if already settled as paid, return success immediately
  IF v_tx.status = 'paid' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'status', 'already_paid',
      'transaction_id', v_tx.id,
      'purpose', v_tx.purpose,
      'user_id', v_tx.user_id,
      'course_id', v_tx.course_id
    );
  END IF;

  -- Update transaction to paid
  UPDATE public.payment_transactions
  SET status = 'paid',
      provider_payload = COALESCE(p_provider_payload, provider_payload),
      updated_at = p_settled_at
  WHERE id = p_payment_transaction_id;

  v_access_id := v_tx.user_id || '_' || v_tx.course_id;
  v_enrollment_id := v_tx.user_id || '_' || v_tx.course_id;

  -- Settle according to purpose
  IF v_tx.purpose = 'course_purchase' THEN
    -- Grant course access
    INSERT INTO public.course_payment_access (
      id,
      user_id,
      course_id,
      full_access_granted,
      certificate_fee_paid,
      source,
      status,
      source_transaction_id,
      granted_at,
      revoked_at,
      revoked_reason,
      updated_at
    )
    VALUES (
      v_access_id,
      v_tx.user_id,
      v_tx.course_id,
      true,
      false,
      'payment',
      'active',
      p_payment_transaction_id,
      p_settled_at,
      NULL,
      NULL,
      p_settled_at
    )
    ON CONFLICT (user_id, course_id) DO UPDATE
    SET full_access_granted = true,
        status = 'active',
        source = 'payment',
        source_transaction_id = p_payment_transaction_id,
        revoked_at = NULL,
        revoked_reason = NULL,
        updated_at = p_settled_at;

    -- Ensure enrollment record is created atomically
    INSERT INTO public.enrollments (
      id,
      user_id,
      course_id,
      enrolled_at,
      last_accessed_at,
      paid_provider,
      paid_amount_vnd,
      paid_order_id,
      paid_at
    )
    VALUES (
      v_enrollment_id,
      v_tx.user_id,
      v_tx.course_id,
      p_settled_at,
      p_settled_at,
      v_tx.provider,
      v_tx.amount_vnd,
      p_payment_transaction_id,
      p_settled_at
    )
    ON CONFLICT (user_id, course_id) DO UPDATE
    SET paid_provider = EXCLUDED.paid_provider,
        paid_amount_vnd = EXCLUDED.paid_amount_vnd,
        paid_order_id = EXCLUDED.paid_order_id,
        paid_at = EXCLUDED.paid_at,
        last_accessed_at = p_settled_at;

  ELSIF v_tx.purpose = 'certificate_fee' THEN
    INSERT INTO public.course_payment_access (
      id,
      user_id,
      course_id,
      full_access_granted,
      certificate_fee_paid,
      source,
      status,
      source_transaction_id,
      granted_at,
      updated_at
    )
    VALUES (
      v_access_id,
      v_tx.user_id,
      v_tx.course_id,
      false,
      true,
      'payment',
      'active',
      p_payment_transaction_id,
      p_settled_at,
      p_settled_at
    )
    ON CONFLICT (user_id, course_id) DO UPDATE
    SET certificate_fee_paid = true,
        status = 'active',
        updated_at = p_settled_at;

  ELSIF v_tx.purpose = 'ai_subscription' THEN
    v_meta := COALESCE(
      p_provider_payload->'subscription_meta',
      v_tx.provider_payload->'subscription_meta'
    );
    v_tier := v_meta->>'tier';
    v_duration_months := COALESCE((v_meta->>'duration_months')::int, 1);

    IF v_tier IS NOT NULL THEN
      -- Supersede previous active subscription
      UPDATE public.ai_subscriptions
      SET status = 'superseded',
          updated_at = p_settled_at
      WHERE user_id = v_tx.user_id
        AND status = 'active';

      v_expires_at := p_settled_at + (v_duration_months || ' months')::interval;

      INSERT INTO public.ai_subscriptions (
        user_id,
        tier,
        duration_months,
        price_vnd,
        started_at,
        expires_at,
        payment_transaction_id,
        status,
        auto_renew,
        created_at,
        updated_at
      )
      VALUES (
        v_tx.user_id,
        v_tier,
        v_duration_months,
        v_tx.amount_vnd,
        p_settled_at,
        v_expires_at,
        p_payment_transaction_id,
        'active',
        false,
        p_settled_at,
        p_settled_at
      );

      UPDATE public.profiles
      SET tier = v_tier,
          updated_at = p_settled_at
      WHERE id = v_tx.user_id;
    END IF;
  END IF;

  -- Consume voucher redemption atomically if one was reserved for this transaction
  UPDATE public.ai_voucher_redemptions
  SET status = 'paid',
      paid_at = p_settled_at,
      reserved_until = NULL,
      released_at = NULL,
      updated_at = p_settled_at
  WHERE payment_transaction_id = p_payment_transaction_id
    AND status IN ('reserved', 'paid');

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'paid',
    'transaction_id', v_tx.id,
    'purpose', v_tx.purpose,
    'user_id', v_tx.user_id,
    'course_id', v_tx.course_id,
    'amount_vnd', v_tx.amount_vnd,
    'settled_at', p_settled_at
  );
END;
$$;

-- 2. Atomic refund processing RPC
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
  v_tx record;
  v_refund_id text;
  v_now timestamptz := now();
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

  -- Lock transaction for update
  SELECT *
  INTO v_tx
  FROM public.payment_transactions
  WHERE id = p_payment_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_TRANSACTION_NOT_FOUND: %', p_payment_transaction_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_tx.status NOT IN ('paid', 'refund_requested') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATUS_FOR_REFUND: Cannot refund transaction with status %', v_tx.status
      USING ERRCODE = '22000';
  END IF;

  v_refund_id := 'REFUND-' || extract(epoch from v_now)::bigint || '-' || substr(md5(random()::text), 1, 8);

  -- Record the refund audit record
  INSERT INTO public.payment_refunds (
    id,
    payment_transaction_id,
    user_id,
    amount_vnd,
    status,
    reason,
    requested_by,
    processed_by,
    provider_payload,
    created_at,
    updated_at,
    completed_at
  )
  VALUES (
    v_refund_id,
    p_payment_transaction_id,
    v_tx.user_id,
    p_refund_amount_vnd,
    'completed',
    p_reason,
    p_actor_user_id,
    p_actor_user_id,
    p_provider_refund_payload,
    v_now,
    v_now,
    v_now
  );

  -- Update transaction status
  UPDATE public.payment_transactions
  SET status = 'refunded',
      updated_at = v_now
  WHERE id = p_payment_transaction_id;

  -- Revoke access based on purpose
  IF v_tx.purpose = 'course_purchase' THEN
    -- Revoke course payment access only if it came from this payment
    UPDATE public.course_payment_access
    SET full_access_granted = false,
        status = 'revoked',
        revoked_at = v_now,
        revoked_reason = p_reason,
        updated_at = v_now
    WHERE user_id = v_tx.user_id
      AND course_id = v_tx.course_id
      AND (source_transaction_id = p_payment_transaction_id OR source = 'payment');

  ELSIF v_tx.purpose = 'certificate_fee' THEN
    UPDATE public.course_payment_access
    SET certificate_fee_paid = false,
        updated_at = v_now
    WHERE user_id = v_tx.user_id
      AND course_id = v_tx.course_id;

  ELSIF v_tx.purpose = 'ai_subscription' THEN
    -- Mark subscription refunded
    UPDATE public.ai_subscriptions
    SET status = 'refunded',
        updated_at = v_now
    WHERE payment_transaction_id = p_payment_transaction_id;

    -- Check if user has another active subscription
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
    'status', 'refunded',
    'revoked_at', v_now
  );
END;
$$;

-- 3. Canonical enrollment RPC
CREATE OR REPLACE FUNCTION public.enroll_in_course(
  p_course_id text,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_course record;
  v_access_model text;
  v_has_paid_access boolean := false;
  v_enrollment_id text;
  v_now timestamptz := now();
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Must be logged in to enroll.'
      USING ERRCODE = '42501';
  END IF;

  -- Authorization check: caller must be target user or staff
  IF v_caller IS NOT NULL AND v_caller <> p_user_id AND NOT public.is_admin_or_support() THEN
    RAISE EXCEPTION 'FORBIDDEN: Cannot enroll another user.'
      USING ERRCODE = '42501';
  END IF;

  -- Check course existence and access model
  SELECT id, instructor_id, data
  INTO v_course
  FROM public.courses
  WHERE id = p_course_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COURSE_NOT_FOUND: %', p_course_id
      USING ERRCODE = 'P0002';
  END IF;

  v_access_model := COALESCE(v_course.data->>'access_model', 'free');

  -- If course requires upfront payment, verify active paid access or instructor/staff privileges
  IF v_access_model = 'paid_upfront' THEN
    IF v_caller IS NOT NULL AND (
      v_course.instructor_id = v_caller
      OR (v_course.data->'co_instructor_permissions') ? (v_caller::text)
      OR public.is_admin_or_support()
    ) THEN
      v_has_paid_access := true;
    ELSE
      SELECT (full_access_granted = true AND status = 'active')
      INTO v_has_paid_access
      FROM public.course_payment_access
      WHERE user_id = p_user_id
        AND course_id = p_course_id;

      v_has_paid_access := COALESCE(v_has_paid_access, false);
    END IF;

    IF NOT v_has_paid_access THEN
      RAISE EXCEPTION 'PAYMENT_REQUIRED: Course % requires upfront payment before enrollment.', p_course_id
        USING ERRCODE = '42501';
    END IF;
  END IF;

  v_enrollment_id := p_user_id || '_' || p_course_id;

  INSERT INTO public.enrollments (
    id,
    user_id,
    course_id,
    enrolled_at,
    last_accessed_at
  )
  VALUES (
    v_enrollment_id,
    p_user_id,
    p_course_id,
    v_now,
    v_now
  )
  ON CONFLICT (user_id, course_id) DO UPDATE
  SET last_accessed_at = v_now;

  RETURN jsonb_build_object(
    'ok', true,
    'enrollment_id', v_enrollment_id,
    'user_id', p_user_id,
    'course_id', p_course_id,
    'enrolled_at', v_now
  );
END;
$$;

-- 4. Admin access grant RPC with full provenance
CREATE OR REPLACE FUNCTION public.grant_course_access_admin(
  p_target_user_id uuid,
  p_course_id text,
  p_full_access boolean DEFAULT true,
  p_cert_fee_paid boolean DEFAULT false,
  p_reason text DEFAULT 'Admin Grant',
  p_admin_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_access_id text;
  v_enrollment_id text;
  v_now timestamptz := now();
BEGIN
  IF NOT public.is_admin_or_support() THEN
    RAISE EXCEPTION 'FORBIDDEN: Only administrators or support staff can grant course access.'
      USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id IS NULL OR p_course_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENTS: Missing target user or course ID.'
      USING ERRCODE = '22023';
  END IF;

  v_access_id := p_target_user_id || '_' || p_course_id;
  v_enrollment_id := p_target_user_id || '_' || p_course_id;

  INSERT INTO public.course_payment_access (
    id,
    user_id,
    course_id,
    full_access_granted,
    certificate_fee_paid,
    source,
    status,
    granted_at,
    revoked_at,
    revoked_reason,
    granted_by,
    updated_at
  )
  VALUES (
    v_access_id,
    p_target_user_id,
    p_course_id,
    p_full_access,
    p_cert_fee_paid,
    'admin_grant',
    'active',
    v_now,
    NULL,
    NULL,
    p_admin_id,
    v_now
  )
  ON CONFLICT (user_id, course_id) DO UPDATE
  SET full_access_granted = p_full_access,
      certificate_fee_paid = p_cert_fee_paid,
      source = 'admin_grant',
      status = 'active',
      granted_at = v_now,
      revoked_at = NULL,
      revoked_reason = NULL,
      granted_by = p_admin_id,
      updated_at = v_now;

  IF p_full_access THEN
    INSERT INTO public.enrollments (
      id,
      user_id,
      course_id,
      enrolled_at,
      last_accessed_at,
      paid_provider,
      paid_amount_vnd,
      paid_order_id,
      paid_at
    )
    VALUES (
      v_enrollment_id,
      p_target_user_id,
      p_course_id,
      v_now,
      v_now,
      'admin_grant',
      0,
      'ADMIN-GRANT-' || extract(epoch from v_now)::bigint,
      v_now
    )
    ON CONFLICT (user_id, course_id) DO UPDATE
    SET last_accessed_at = v_now;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', p_target_user_id,
    'course_id', p_course_id,
    'full_access', p_full_access,
    'certificate_fee_paid', p_cert_fee_paid,
    'source', 'admin_grant',
    'granted_by', p_admin_id,
    'reason', p_reason
  );
END;
$$;

-- 5. DB Trigger guard on enrollments table to prevent client-side privilege escalation
CREATE OR REPLACE FUNCTION public.guard_course_enrollment_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_access_model text;
  v_has_access boolean;
  v_caller uuid := auth.uid();
BEGIN
  -- Service role / internal server triggers skip client guard
  IF v_caller IS NULL THEN
    RETURN NEW;
  END IF;

  -- Staff can bypass
  IF public.is_admin_or_support() THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(data->>'access_model', 'free')
  INTO v_access_model
  FROM public.courses
  WHERE id = NEW.course_id;

  IF v_access_model = 'paid_upfront' THEN
    -- If row already has valid paid provenance or caller already has active paid access, allow
    IF NEW.paid_order_id IS NOT NULL AND NEW.paid_at IS NOT NULL THEN
      RETURN NEW;
    END IF;

    SELECT (full_access_granted = true AND status = 'active')
    INTO v_has_access
    FROM public.course_payment_access
    WHERE user_id = NEW.user_id
      AND course_id = NEW.course_id;

    IF NOT COALESCE(v_has_access, false) THEN
      RAISE EXCEPTION 'PAYMENT_REQUIRED: Cannot self-enroll in paid upfront course without valid payment.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_course_enrollment_access ON public.enrollments;
CREATE TRIGGER trg_guard_course_enrollment_access
  BEFORE INSERT OR UPDATE ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_course_enrollment_access();

-- Grant permissions explicitly
GRANT EXECUTE ON FUNCTION public.process_successful_payment(text, jsonb, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_payment_refund(text, int, text, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.enroll_in_course(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.grant_course_access_admin(uuid, text, boolean, boolean, text, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.process_successful_payment(text, jsonb, timestamptz) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_payment_refund(text, int, text, uuid, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enroll_in_course(text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.grant_course_access_admin(uuid, text, boolean, boolean, text, uuid) FROM anon;

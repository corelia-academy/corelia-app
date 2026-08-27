-- Master Wave Forward Migration: Harden Enrollment Payment Purpose and Timestamp Invariants (R1.1)
-- Forward-only, data-preserving migration closing F-REV-01 and F-REV-02:
-- 1. Strictly enforce transaction purpose = 'course_purchase' for enrollment provenance (F-REV-01)
-- 2. Derive authoritative paid_at timestamp and monetary metadata from verified transaction (F-REV-02)
-- 3. Reject non-course transaction reuse (e.g. certificate_fee, ai_subscription) for course enrollment

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_course_enrollment_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_access_model text;
  v_has_access boolean := false;
  v_caller uuid := auth.uid();
  v_course record;
  v_tx record;
BEGIN
  -- Service role / internal server triggers skip client guard
  IF v_caller IS NULL THEN
    RETURN NEW;
  END IF;

  -- Staff can bypass
  IF public.is_admin_or_support() THEN
    RETURN NEW;
  END IF;

  -- Fetch course information
  SELECT id, instructor_id, data
  INTO v_course
  FROM public.courses
  WHERE id = NEW.course_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COURSE_NOT_FOUND: Course % does not exist.', NEW.course_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Course instructors and co-instructors can enroll/access their own course freely
  IF v_caller = v_course.instructor_id
     OR (v_course.data->'co_instructor_permissions') ? (v_caller::text) THEN
    RETURN NEW;
  END IF;

  v_access_model := COALESCE(v_course.data->>'access_model', 'free');

  -- Free courses:
  IF v_access_model <> 'paid_upfront' THEN
    -- On free courses, authenticated students cannot forge fake paid_order_id or paid_at
    IF (TG_OP = 'INSERT' AND (NEW.paid_order_id IS NOT NULL OR NEW.paid_at IS NOT NULL))
       OR (TG_OP = 'UPDATE' AND (
            (NEW.paid_order_id IS DISTINCT FROM OLD.paid_order_id AND NEW.paid_order_id IS NOT NULL)
            OR (NEW.paid_at IS DISTINCT FROM OLD.paid_at AND NEW.paid_at IS NOT NULL)
          )) THEN
      RAISE EXCEPTION 'INVALID_PROVENANCE: Free courses cannot specify paid transaction provenance.'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  -- Paid upfront courses:
  -- If this is an UPDATE and paid fields/user/course are unchanged, allow (e.g. updating last_accessed_at)
  IF TG_OP = 'UPDATE'
     AND NEW.user_id = OLD.user_id
     AND NEW.course_id = OLD.course_id
     AND NEW.paid_order_id IS NOT DISTINCT FROM OLD.paid_order_id
     AND NEW.paid_at IS NOT DISTINCT FROM OLD.paid_at THEN
    RETURN NEW;
  END IF;

  -- Verify canonical entitlement:
  -- Check 1: Does user have active course_payment_access?
  SELECT (full_access_granted = true AND status = 'active')
  INTO v_has_access
  FROM public.course_payment_access
  WHERE user_id = NEW.user_id
    AND course_id = NEW.course_id;

  v_has_access := COALESCE(v_has_access, false);

  -- Check 2: If client provided paid_order_id, verify that it matches a REAL, PAID 'course_purchase' transaction
  IF NEW.paid_order_id IS NOT NULL THEN
    SELECT *
    INTO v_tx
    FROM public.payment_transactions
    WHERE id = NEW.paid_order_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PAYMENT_TRANSACTION_NOT_FOUND: paid_order_id % does not exist.', NEW.paid_order_id
        USING ERRCODE = '42501';
    END IF;

    IF v_tx.user_id <> NEW.user_id THEN
      RAISE EXCEPTION 'PAYMENT_USER_MISMATCH: paid_order_id % belongs to another user.', NEW.paid_order_id
        USING ERRCODE = '42501';
    END IF;

    IF v_tx.course_id <> NEW.course_id THEN
      RAISE EXCEPTION 'PAYMENT_COURSE_MISMATCH: paid_order_id % belongs to another course %.', NEW.paid_order_id, v_tx.course_id
        USING ERRCODE = '42501';
    END IF;

    IF v_tx.status <> 'paid' THEN
      RAISE EXCEPTION 'PAYMENT_NOT_PAID: Transaction % status is %, not paid.', NEW.paid_order_id, v_tx.status
        USING ERRCODE = '42501';
    END IF;

    -- Enforce purpose = 'course_purchase' (F-REV-01)
    IF v_tx.purpose <> 'course_purchase' THEN
      RAISE EXCEPTION 'PAYMENT_PURPOSE_MISMATCH: Transaction % purpose is %, not course_purchase.', NEW.paid_order_id, v_tx.purpose
        USING ERRCODE = '42501';
    END IF;

    -- Derive authoritative timestamp and payment metadata from verified canonical transaction (F-REV-02)
    NEW.paid_at := COALESCE(v_tx.updated_at, now());
    NEW.paid_provider := COALESCE(v_tx.provider, 'sepay');
    NEW.paid_amount_vnd := v_tx.amount_vnd;

    v_has_access := true;
  END IF;

  -- If neither verified payment nor active course_payment_access exists, reject
  IF NOT v_has_access THEN
    RAISE EXCEPTION 'PAYMENT_REQUIRED: Cannot enroll in paid course % without valid verified payment.', NEW.course_id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_course_enrollment_access ON public.enrollments;
CREATE TRIGGER trg_guard_course_enrollment_access
  BEFORE INSERT OR UPDATE ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_course_enrollment_access();

COMMIT;

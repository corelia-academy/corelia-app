-- Permanently retire all payment and partner-finance features.
-- Run `pnpm run storage:purge-financial` before applying this migration.

DO $preflight$
DECLARE
  v_remaining bigint;
BEGIN
  SELECT count(*) INTO v_remaining
  FROM storage.objects
  WHERE bucket_id = 'app'
    AND (storage.foldername(name))[1] IN ('course-partner-docs', 'instructor-partner-docs');

  IF v_remaining > 0 THEN
    RAISE EXCEPTION
      'FINANCIAL_RETIREMENT_ABORTED: % financial storage objects remain; run the Storage API purge first',
      v_remaining;
  END IF;
END;
$preflight$;

-- Every course is free. Keep owner_type because it is non-financial provenance.
UPDATE public.courses
SET data = data
  - 'access_model'
  - 'price_vnd'
  - 'promo_price_vnd'
  - 'promo_ends_at'
  - 'certificate_fee_vnd'
  - 'platform_revenue_share_percent'
  - 'partner_contract_docs'
  - 'partner_invoice_docs'
  - 'partner_transfer_info',
  updated_at = now()
WHERE data ?| ARRAY[
  'access_model', 'price_vnd', 'promo_price_vnd', 'promo_ends_at',
  'certificate_fee_vnd', 'platform_revenue_share_percent',
  'partner_contract_docs', 'partner_invoice_docs', 'partner_transfer_info'
];

-- Enrollment remains the sole learning relationship and no longer carries money facts.
DROP TRIGGER IF EXISTS trg_guard_course_enrollment_access ON public.enrollments;
DROP FUNCTION IF EXISTS public.guard_course_enrollment_access();

CREATE OR REPLACE FUNCTION public.enroll_in_course(
  p_course_id text,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_enrollment_id text;
  v_now timestamptz := now();
BEGIN
  IF v_user_id IS NULL OR auth.uid() IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'ENROLLMENT_USER_MISMATCH' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.courses WHERE id = p_course_id) THEN
    RAISE EXCEPTION 'COURSE_NOT_FOUND: %', p_course_id USING ERRCODE = 'P0002';
  END IF;

  v_enrollment_id := v_user_id::text || '_' || p_course_id;
  INSERT INTO public.enrollments (id, user_id, course_id, enrolled_at, last_accessed_at)
  VALUES (v_enrollment_id, v_user_id, p_course_id, v_now, v_now)
  ON CONFLICT (user_id, course_id) DO UPDATE
    SET last_accessed_at = GREATEST(public.enrollments.last_accessed_at, EXCLUDED.last_accessed_at)
  RETURNING id INTO v_enrollment_id;

  RETURN jsonb_build_object('ok', true, 'enrollment_id', v_enrollment_id);
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_in_course(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enroll_in_course(text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.check_user_course_quiz_access(
  p_course_id text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT p_user_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.courses c WHERE c.id = p_course_id)
    AND (
      EXISTS (
        SELECT 1 FROM public.enrollments e
        WHERE e.course_id = p_course_id AND e.user_id = p_user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = p_course_id
          AND (c.instructor_id = p_user_id OR (c.data->'co_instructor_permissions') ? p_user_id::text)
      )
      OR public.is_admin_or_support()
    );
$$;

-- Remove all payment/refund/admin-grant functions before their table row types disappear.
DROP FUNCTION IF EXISTS public.create_payment_checkout_transaction(text, uuid, text, text, int, int, text, int, text, timestamptz);
DROP FUNCTION IF EXISTS public.process_successful_payment(text, jsonb, timestamptz);
DROP FUNCTION IF EXISTS public.process_unsuccessful_payment_callback(text, text, jsonb, timestamptz);
DROP FUNCTION IF EXISTS public.grant_course_access_admin(uuid, text, boolean, text, uuid);
DROP FUNCTION IF EXISTS public.grant_course_access_admin(uuid, text, boolean, boolean, text, uuid);
DROP FUNCTION IF EXISTS public.request_payment_refund(text, int, text, uuid, jsonb);
DROP FUNCTION IF EXISTS public.process_payment_refund(text, int, text, uuid, jsonb);
DROP FUNCTION IF EXISTS public.process_provider_payment_refund(text, int, text, text, uuid, jsonb);
DROP FUNCTION IF EXISTS private.finalize_provider_payment_refund(text, int, text, text, uuid, jsonb);
DROP FUNCTION IF EXISTS public.reconcile_historical_ai_payment(text, jsonb, timestamptz);

-- Explicit order makes unexpected dependencies fail closed instead of being cascaded silently.
DROP TABLE IF EXISTS public.payment_refunds;
DROP TABLE IF EXISTS public.payment_transaction_items;
DROP TABLE IF EXISTS public.course_payment_access;
DROP TABLE IF EXISTS public.course_entitlement_grants;
DROP TABLE IF EXISTS public.payment_transactions;
DROP TABLE IF EXISTS public.billing_products;
DROP TABLE IF EXISTS public.course_discounts;

ALTER TABLE public.enrollments
  DROP COLUMN IF EXISTS paid_provider,
  DROP COLUMN IF EXISTS paid_amount_vnd,
  DROP COLUMN IF EXISTS paid_order_id,
  DROP COLUMN IF EXISTS paid_at;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS partner_contract_docs,
  DROP COLUMN IF EXISTS partner_invoice_docs,
  DROP COLUMN IF EXISTS partner_transfer_info,
  DROP COLUMN IF EXISTS partner_bank_name,
  DROP COLUMN IF EXISTS partner_bank_account_number,
  DROP COLUMN IF EXISTS partner_bank_account_holder,
  DROP COLUMN IF EXISTS partner_bank_transfer_note;

DROP POLICY IF EXISTS storage_instructor_partner_docs ON storage.objects;
DROP POLICY IF EXISTS storage_instructor_partner_docs_select ON storage.objects;
DROP POLICY IF EXISTS storage_instructor_partner_docs_manage ON storage.objects;
DROP POLICY IF EXISTS storage_instructor_partner_docs_manage_update ON storage.objects;
DROP POLICY IF EXISTS storage_instructor_partner_docs_manage_delete ON storage.objects;

-- Retain the shared course-assets policies but remove the retired financial prefix.
DROP POLICY IF EXISTS storage_course_assets_read ON storage.objects;
CREATE POLICY storage_course_assets_read
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] IN (
      'course-sponsor-logos', 'course-partners', 'course-partner-brand',
      'course-credential-badges', 'hackathon-credential-badges',
      'activity-milestone-badges', 'contest-org-partner-logos'
    )
  );

DROP POLICY IF EXISTS storage_course_assets_write ON storage.objects;
DROP POLICY IF EXISTS storage_course_assets_update ON storage.objects;
DROP POLICY IF EXISTS storage_course_assets_delete ON storage.objects;
DROP POLICY IF EXISTS storage_course_assets_manage ON storage.objects;
DROP POLICY IF EXISTS storage_course_assets_manage_update ON storage.objects;
DROP POLICY IF EXISTS storage_course_assets_manage_delete ON storage.objects;

CREATE POLICY storage_course_assets_manage
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] IN (
      'course-sponsor-logos', 'course-partners', 'course-partner-brand'
    )
    AND private.can_manage_course((storage.foldername(name))[2], (SELECT auth.uid()))
  );

CREATE POLICY storage_course_assets_manage_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] IN ('course-sponsor-logos', 'course-partners', 'course-partner-brand')
    AND private.can_manage_course((storage.foldername(name))[2], (SELECT auth.uid()))
  )
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] IN ('course-sponsor-logos', 'course-partners', 'course-partner-brand')
    AND private.can_manage_course((storage.foldername(name))[2], (SELECT auth.uid()))
  );

CREATE POLICY storage_course_assets_manage_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] IN ('course-sponsor-logos', 'course-partners', 'course-partner-brand')
    AND private.can_manage_course((storage.foldername(name))[2], (SELECT auth.uid()))
  );

DO $verify$
DECLARE
  v_unexpected text;
BEGIN
  SELECT string_agg(name, ', ' ORDER BY name) INTO v_unexpected
  FROM (
    SELECT table_name AS name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'payment_transactions', 'payment_transaction_items', 'payment_refunds',
        'course_payment_access', 'course_entitlement_grants', 'billing_products',
        'course_discounts'
      )
    UNION ALL
    SELECT table_name || '.' || column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'enrollments' AND column_name IN ('paid_provider', 'paid_amount_vnd', 'paid_order_id', 'paid_at'))
        OR (table_name = 'profiles' AND column_name LIKE 'partner\_%' ESCAPE '\')
      )
  ) remaining;

  IF v_unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'FINANCIAL_RETIREMENT_INCOMPLETE: %', v_unexpected;
  END IF;
END;
$verify$;

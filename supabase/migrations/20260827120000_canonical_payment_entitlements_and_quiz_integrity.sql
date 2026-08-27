-- =============================================================================
-- Migration: Canonical Payment Architecture, Product Catalog, Course Entitlements,
-- Admin Grant, Refund Lifecycle, and Server-Calculated Quiz Integrity
-- Version: 20260827120000
-- =============================================================================

-- =============================================================================
-- 0. Migration Preflight Validation (Fail-Closed Integrity Invariants)
-- =============================================================================

DO $canonical_migration_preflight$
DECLARE
  v_count int;
BEGIN
  -- 0.1 Verify no duplicate active full access records in legacy course_payment_access
  SELECT count(*)
  INTO v_count
  FROM (
    SELECT user_id, course_id
    FROM public.course_payment_access
    WHERE full_access_granted = true
    GROUP BY user_id, course_id
    HAVING count(*) > 1
  ) dup;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT_FAIL_DUPLICATE_ACTIVE: Found % duplicate active full access pairs in course_payment_access', v_count
      USING ERRCODE = '23505';
  END IF;

  -- 0.2 Verify source = 'payment' rows have valid transaction provenance
  SELECT count(*)
  INTO v_count
  FROM public.course_payment_access
  WHERE source = 'payment'
    AND full_access_granted = true
    AND full_access_transaction_id IS NULL
    AND source_transaction_id IS NULL;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT_FAIL_PAYMENT_MISSING_TX: Found % active payment access rows with no transaction ID provenance.', v_count
      USING ERRCODE = '23514';
  END IF;

  -- 0.3 Verify payment transaction provenance references existing transactions
  SELECT count(*)
  INTO v_count
  FROM public.course_payment_access a
  WHERE source = 'payment'
    AND COALESCE(a.full_access_transaction_id, a.source_transaction_id) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.payment_transactions tx
      WHERE tx.id = COALESCE(a.full_access_transaction_id, a.source_transaction_id)
    );

  IF v_count > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT_FAIL_ORPHAN_TX_PROVENANCE: Found % access rows referencing non-existent payment transactions.', v_count
      USING ERRCODE = '23503';
  END IF;

  -- 0.4 Verify source = 'admin_grant' rows have granted_by actor recorded
  SELECT count(*)
  INTO v_count
  FROM public.course_payment_access
  WHERE source = 'admin_grant'
    AND granted_by IS NULL;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT_FAIL_ADMIN_GRANT_MISSING_ACTOR: Found % admin_grant rows missing granted_by actor.', v_count
      USING ERRCODE = '23514';
  END IF;

  -- 0.5 Verify referenced users and courses exist in auth.users and public.courses
  SELECT count(*)
  INTO v_count
  FROM public.course_payment_access a
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = a.user_id)
     OR NOT EXISTS (SELECT 1 FROM public.courses c WHERE c.id = a.course_id);

  IF v_count > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT_FAIL_ORPHAN_USER_OR_COURSE: Found % access rows referencing non-existent user or course.', v_count
      USING ERRCODE = '23503';
  END IF;

  -- 0.6 Verify legacy source values belong to source domain
  SELECT count(*)
  INTO v_count
  FROM public.course_payment_access
  WHERE source NOT IN ('payment', 'admin_grant', 'voucher', 'free_enrollment', 'legacy');

  IF v_count > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT_FAIL_INVALID_SOURCE_DOMAIN: Found % access rows with unrecognized source.', v_count
      USING ERRCODE = '22023';
  END IF;

  -- 0.7 Verify transaction purposes are mappable to supported products
  SELECT count(*)
  INTO v_count
  FROM public.payment_transactions
  WHERE purpose IS NOT NULL
    AND purpose NOT IN ('course_purchase', 'certificate_fee', 'ai_subscription');

  IF v_count > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT_FAIL_UNMAPPABLE_TX_PURPOSE: Found % payment transactions with unsupported purpose.', v_count
      USING ERRCODE = '22023';
  END IF;

  -- 0.8 Verify course_purchase transactions reference valid courses
  SELECT count(*)
  INTO v_count
  FROM public.payment_transactions tx
  WHERE tx.purpose = 'course_purchase'
    AND (tx.course_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.courses c WHERE c.id = tx.course_id));

  IF v_count > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT_FAIL_TX_INVALID_RESOURCE: Found % course_purchase transactions with invalid course_id.', v_count
      USING ERRCODE = '23503';
  END IF;
END
$canonical_migration_preflight$;

-- =============================================================================
-- 1. Product Catalog & Payment Transaction Items
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.billing_products (
  id text PRIMARY KEY,
  product_type text NOT NULL,
  title text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_products_type_active_idx
  ON public.billing_products (product_type, active);

ALTER TABLE public.billing_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_products_select ON public.billing_products;
CREATE POLICY billing_products_select
  ON public.billing_products FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS billing_products_write_staff ON public.billing_products;
CREATE POLICY billing_products_write_staff
  ON public.billing_products FOR ALL
  TO authenticated
  USING (public.is_admin_or_support())
  WITH CHECK (public.is_admin_or_support());

-- Seed baseline sellable products
INSERT INTO public.billing_products (id, product_type, title, description, active)
VALUES
  ('course_access', 'course', 'Course Full Access', 'Full access entitlement to course content', true),
  ('certificate_fee', 'certificate', 'Course Certificate Fee', 'Fee for issuing verified course certificate', true)
ON CONFLICT (id) DO NOTHING;

-- Relax legacy payment_transactions constraints for forward extensibility
ALTER TABLE public.payment_transactions
  ALTER COLUMN course_id DROP NOT NULL;

ALTER TABLE public.payment_transactions
  ALTER COLUMN purpose DROP NOT NULL;

-- Payment Transaction Items
CREATE TABLE IF NOT EXISTS public.payment_transaction_items (
  id text PRIMARY KEY DEFAULT ('ITEM-' || gen_random_uuid()::text),
  payment_transaction_id text NOT NULL REFERENCES public.payment_transactions (id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES public.billing_products (id) ON DELETE RESTRICT,
  resource_id text NOT NULL,
  unit_price_vnd int NOT NULL CHECK (unit_price_vnd >= 0),
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  fulfillment_status text NOT NULL DEFAULT 'pending' CHECK (fulfillment_status IN ('pending', 'fulfilled', 'conflict', 'failed', 'revoked')),
  fulfillment_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_tx_items_tx_id_idx
  ON public.payment_transaction_items (payment_transaction_id);

CREATE INDEX IF NOT EXISTS payment_tx_items_resource_idx
  ON public.payment_transaction_items (product_id, resource_id);

CREATE INDEX IF NOT EXISTS payment_tx_items_fulfillment_idx
  ON public.payment_transaction_items (fulfillment_status);

ALTER TABLE public.payment_transaction_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_tx_items_select_own_or_staff ON public.payment_transaction_items;
CREATE POLICY payment_tx_items_select_own_or_staff
  ON public.payment_transaction_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.payment_transactions tx
      WHERE tx.id = payment_transaction_id
        AND (tx.user_id = auth.uid() OR public.is_admin_or_support())
    )
  );

-- =============================================================================
-- 2. Course Entitlement Grants (Canonical Course Access Truth)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.course_entitlement_grants (
  id text PRIMARY KEY DEFAULT ('GRANT-' || gen_random_uuid()::text),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  course_id text NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('payment', 'admin_grant', 'voucher', 'free_enrollment', 'legacy')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  source_transaction_id text REFERENCES public.payment_transactions (id) ON DELETE RESTRICT,
  granted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reason text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Strict Invariant: Exactly 0 or 1 active entitlement per (user_id, course_id)
CREATE UNIQUE INDEX IF NOT EXISTS course_entitlement_grants_active_user_course_uidx
  ON public.course_entitlement_grants (user_id, course_id)
  WHERE status = 'active';

-- Provenance Integrity Check
ALTER TABLE public.course_entitlement_grants
  DROP CONSTRAINT IF EXISTS course_entitlement_grants_provenance_check;

ALTER TABLE public.course_entitlement_grants
  ADD CONSTRAINT course_entitlement_grants_provenance_check
  CHECK (
    (source = 'payment' AND source_transaction_id IS NOT NULL)
    OR (source = 'admin_grant' AND granted_by IS NOT NULL AND source_transaction_id IS NULL)
    OR (source IN ('voucher', 'free_enrollment', 'legacy'))
  );

CREATE INDEX IF NOT EXISTS course_entitlement_grants_user_status_idx
  ON public.course_entitlement_grants (user_id, course_id, status);

CREATE INDEX IF NOT EXISTS course_entitlement_grants_tx_idx
  ON public.course_entitlement_grants (source_transaction_id)
  WHERE source_transaction_id IS NOT NULL;

ALTER TABLE public.course_entitlement_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_entitlement_grants_select_own_or_staff ON public.course_entitlement_grants;
CREATE POLICY course_entitlement_grants_select_own_or_staff
  ON public.course_entitlement_grants FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_admin_or_support()
  );

-- Enforce at most one non-terminal refund per payment transaction
CREATE UNIQUE INDEX IF NOT EXISTS payment_refunds_active_request_uidx
  ON public.payment_refunds (payment_transaction_id)
  WHERE status IN ('requested', 'approved', 'processing', 'completed');

-- =============================================================================
-- 3. Data Backfill (Learning Entitlements & Transaction Items)
-- =============================================================================

-- Backfill ONLY actual learning access from course_payment_access (exclude certificate-only rows)
INSERT INTO public.course_entitlement_grants (
  id,
  user_id,
  course_id,
  source,
  status,
  source_transaction_id,
  granted_by,
  reason,
  granted_at,
  revoked_at,
  revoked_reason,
  created_at,
  updated_at
)
SELECT
  'GRANT-' || a.id,
  a.user_id,
  a.course_id,
  a.source,
  CASE WHEN a.full_access_granted = true THEN 'active' ELSE 'revoked' END,
  COALESCE(a.full_access_transaction_id, a.source_transaction_id),
  a.granted_by,
  'Migrated from course_payment_access',
  COALESCE(a.granted_at, a.updated_at, now()),
  a.revoked_at,
  a.revoked_reason,
  COALESCE(a.granted_at, a.updated_at, now()),
  COALESCE(a.updated_at, now())
FROM public.course_payment_access a
WHERE EXISTS (SELECT 1 FROM public.courses c WHERE c.id = a.course_id)
  AND (a.full_access_granted = true OR a.full_access_transaction_id IS NOT NULL OR a.source = 'admin_grant')
ON CONFLICT (id) DO NOTHING;

-- Backfill payment_transaction_items for historical settled transactions
INSERT INTO public.payment_transaction_items (
  id,
  payment_transaction_id,
  product_id,
  resource_id,
  unit_price_vnd,
  quantity,
  snapshot,
  fulfillment_status,
  created_at,
  updated_at
)
SELECT
  'ITEM-' || t.id,
  t.id,
  CASE
    WHEN t.purpose = 'course_purchase' THEN 'course_access'
    WHEN t.purpose = 'certificate_fee' THEN 'certificate_fee'
  END,
  COALESCE(t.course_id, 'unknown'),
  t.amount_vnd,
  1,
  jsonb_build_object(
    'purpose', t.purpose,
    'original_amount_vnd', t.original_amount_vnd,
    'discount_code', t.discount_code,
    'discount_amount_vnd', t.discount_amount_vnd
  ),
  CASE
    WHEN t.status = 'paid' THEN 'fulfilled'
    WHEN t.status IN ('refunded', 'partially_refunded') THEN 'revoked'
    WHEN t.status IN ('failed', 'cancelled') THEN 'failed'
    ELSE 'pending'
  END,
  t.created_at,
  t.updated_at
FROM public.payment_transactions t
WHERE t.purpose IN ('course_purchase', 'certificate_fee')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 4. RPC: Atomic Payment Checkout Transaction Creation
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_payment_checkout_transaction(
  p_order_id text,
  p_user_id uuid,
  p_product_id text,
  p_resource_id text,
  p_amount_vnd int,
  p_original_amount_vnd int,
  p_discount_code text DEFAULT NULL,
  p_discount_amount_vnd int DEFAULT NULL,
  p_provider text DEFAULT 'sepay',
  p_created_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_product public.billing_products%ROWTYPE;
  v_course public.courses%ROWTYPE;
  v_item_id text;
  v_resource_title text := 'Unknown Resource';
  v_snapshot jsonb;
  v_legacy_purpose text;
  v_calculated_final int;
BEGIN
  IF p_order_id IS NULL OR p_user_id IS NULL OR p_product_id IS NULL OR p_resource_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENTS: Missing required checkout fields.'
      USING ERRCODE = '22023';
  END IF;

  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: User % does not exist.', p_user_id
      USING ERRCODE = 'P0002';
  END IF;

  IF p_amount_vnd < 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Amount cannot be negative.'
      USING ERRCODE = '22023';
  END IF;

  -- 1. Validate billing product is active
  SELECT *
  INTO v_product
  FROM public.billing_products
  WHERE id = p_product_id
    AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_ACTIVE_OR_FOUND: Product % is not available for purchase.', p_product_id
      USING ERRCODE = '22023';
  END IF;

  -- 2. Validate product fulfillment mapping (fail closed for unsupported product types)
  IF p_product_id = 'course_access' THEN
    v_legacy_purpose := 'course_purchase';
  ELSIF p_product_id = 'certificate_fee' THEN
    v_legacy_purpose := 'certificate_fee';
  ELSE
    RAISE EXCEPTION 'UNSUPPORTED_PRODUCT_FOR_CHECKOUT: Product % does not have a supported fulfillment mapping.', p_product_id
      USING ERRCODE = '22023';
  END IF;

  -- 3. Validate resource
  IF v_product.product_type = 'course' OR v_product.product_type = 'certificate' THEN
    SELECT *
    INTO v_course
    FROM public.courses
    WHERE id = p_resource_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'RESOURCE_NOT_FOUND: Course % does not exist.', p_resource_id
        USING ERRCODE = 'P0002';
    END IF;

    v_resource_title := COALESCE(v_course.data->>'title', p_resource_id);
  END IF;

  -- 4. Validate math
  v_calculated_final := COALESCE(p_original_amount_vnd, p_amount_vnd) - COALESCE(p_discount_amount_vnd, 0);
  IF v_calculated_final < 0 THEN
    v_calculated_final := 0;
  END IF;

  IF v_calculated_final <> p_amount_vnd THEN
    RAISE EXCEPTION 'AMOUNT_MISMATCH: Calculated % does not match requested %', v_calculated_final, p_amount_vnd
      USING ERRCODE = '22023';
  END IF;

  v_item_id := 'ITEM-' || p_order_id;
  v_snapshot := jsonb_build_object(
    'product_id', v_product.id,
    'product_type', v_product.product_type,
    'product_title', v_product.title,
    'resource_id', p_resource_id,
    'resource_title', v_resource_title,
    'unit_price_vnd', COALESCE(p_original_amount_vnd, p_amount_vnd),
    'quantity', 1,
    'subtotal_vnd', COALESCE(p_original_amount_vnd, p_amount_vnd),
    'discount_code', p_discount_code,
    'discount_amount_vnd', COALESCE(p_discount_amount_vnd, 0),
    'final_amount_vnd', p_amount_vnd,
    'currency', 'VND',
    'created_at', p_created_at
  );

  -- 4. Insert payment_transactions header
  INSERT INTO public.payment_transactions (
    id,
    user_id,
    course_id,
    purpose,
    amount_vnd,
    original_amount_vnd,
    discount_code,
    discount_amount_vnd,
    provider,
    status,
    created_at,
    updated_at
  )
  VALUES (
    p_order_id,
    p_user_id,
    p_resource_id,
    v_legacy_purpose,
    p_amount_vnd,
    p_original_amount_vnd,
    p_discount_code,
    p_discount_amount_vnd,
    p_provider,
    'pending',
    p_created_at,
    p_created_at
  );

  -- 5. Insert payment_transaction_items
  INSERT INTO public.payment_transaction_items (
    id,
    payment_transaction_id,
    product_id,
    resource_id,
    unit_price_vnd,
    quantity,
    snapshot,
    fulfillment_status,
    created_at,
    updated_at
  )
  VALUES (
    v_item_id,
    p_order_id,
    v_product.id,
    p_resource_id,
    COALESCE(p_original_amount_vnd, p_amount_vnd),
    1,
    v_snapshot,
    'pending',
    p_created_at,
    p_created_at
  );

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'item_id', v_item_id,
    'amount_vnd', p_amount_vnd,
    'status', 'pending'
  );
END;
$$;

-- =============================================================================
-- 5. RPC: Atomic Payment Settlement with Advisory Lock & Conflict Refund Lifecycle
-- =============================================================================

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
  v_retry boolean;
  v_existing_active_grant public.course_entitlement_grants%ROWTYPE;
  v_grant_id text;
  v_refund_id text;
  v_item_id text;
  v_product_id text;
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

  -- Retired AI subscriptions rejection
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

  IF v_tx.status IN ('refunded', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATUS_FOR_SETTLEMENT: Cannot settle transaction with terminal status %', v_tx.status
      USING ERRCODE = '22000';
  END IF;

  IF v_tx.status = 'refund_requested' THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATUS_FOR_SETTLEMENT: Transaction is already in refund_requested state.'
      USING ERRCODE = '22000';
  END IF;

  -- Acquire Entitlement Advisory Lock to serialize with concurrent admin grants
  IF v_tx.course_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended('course-entitlement:' || v_tx.user_id::text || ':' || v_tx.course_id, 0)
    );
  END IF;

  v_retry := (v_tx.status = 'paid');
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

  v_product_id := CASE WHEN v_tx.purpose = 'course_purchase' THEN 'course_access' ELSE 'certificate_fee' END;
  v_item_id := 'ITEM-' || v_tx.id;
  v_access_id := v_tx.user_id || '_' || v_tx.course_id;
  v_enrollment_id := v_tx.user_id || '_' || v_tx.course_id;

  IF v_tx.purpose = 'course_purchase' THEN
    -- Check for concurrent active entitlement grant race after acquiring lock
    SELECT *
    INTO v_existing_active_grant
    FROM public.course_entitlement_grants
    WHERE user_id = v_tx.user_id
      AND course_id = v_tx.course_id
      AND status = 'active'
    LIMIT 1;

    IF FOUND AND (v_existing_active_grant.source_transaction_id IS DISTINCT FROM v_tx.id) THEN
      -- RACE / CONFLICT CASE:
      -- Keep the payment fact intact (status = paid, settled_at recorded),
      -- record fulfillment_status = conflict on transaction item,
      -- create a refund request record (status = requested) and transition transaction to refund_requested.
      INSERT INTO public.payment_transaction_items (
        id, payment_transaction_id, product_id, resource_id,
        unit_price_vnd, quantity, snapshot, fulfillment_status, created_at, updated_at
      )
      VALUES (
        v_item_id, v_tx.id, v_product_id, v_tx.course_id,
        v_tx.amount_vnd, 1,
        jsonb_build_object(
          'purpose', v_tx.purpose,
          'conflict_reason', 'User already has active entitlement from ' || v_existing_active_grant.source,
          'existing_grant_id', v_existing_active_grant.id
        ),
        'conflict',
        v_effective_settled_at, v_effective_settled_at
      )
      ON CONFLICT (id) DO UPDATE
      SET fulfillment_status = 'conflict',
          updated_at = v_effective_settled_at;

      v_refund_id := 'REFUND-' || extract(epoch from v_effective_settled_at)::bigint || '-' || substr(md5(random()::text), 1, 8);

      INSERT INTO public.payment_refunds (
        id, payment_transaction_id, user_id, amount_vnd, status, reason,
        provider_payload, created_at, updated_at
      )
      VALUES (
        v_refund_id, v_tx.id, v_tx.user_id, v_tx.amount_vnd, 'requested',
        'Automatic refund: user already active entitlement (' || v_existing_active_grant.source || ')',
        jsonb_build_object('conflict_settlement', true, 'existing_grant_id', v_existing_active_grant.id),
        v_effective_settled_at, v_effective_settled_at
      )
      ON CONFLICT DO NOTHING;

      UPDATE public.payment_transactions
      SET status = 'refund_requested',
          updated_at = v_effective_settled_at
      WHERE id = v_tx.id;

      RETURN jsonb_build_object(
        'ok', true,
        'status', 'settled_conflict_refund_requested',
        'transaction_id', v_tx.id,
        'conflict_reason', 'User already entitled',
        'existing_grant_id', v_existing_active_grant.id,
        'refund_id', v_refund_id
      );
    END IF;

    -- Standard Happy Path: create/ensure canonical entitlement grant
    v_grant_id := 'GRANT-' || v_tx.id;
    INSERT INTO public.course_entitlement_grants (
      id, user_id, course_id, source, status,
      source_transaction_id, granted_at, created_at, updated_at
    )
    VALUES (
      v_grant_id, v_tx.user_id, v_tx.course_id, 'payment', 'active',
      v_tx.id, v_effective_settled_at, v_effective_settled_at, v_effective_settled_at
    )
    ON CONFLICT (id) DO UPDATE
    SET status = 'active',
        source = 'payment',
        source_transaction_id = v_tx.id,
        revoked_at = NULL,
        revoked_reason = NULL,
        updated_at = v_effective_settled_at;

    -- Record transaction item as fulfilled
    INSERT INTO public.payment_transaction_items (
      id, payment_transaction_id, product_id, resource_id,
      unit_price_vnd, quantity, snapshot, fulfillment_status, fulfillment_id,
      created_at, updated_at
    )
    VALUES (
      v_item_id, v_tx.id, v_product_id, v_tx.course_id,
      v_tx.amount_vnd, 1,
      jsonb_build_object('purpose', v_tx.purpose, 'settled_at', v_effective_settled_at),
      'fulfilled', v_grant_id,
      v_effective_settled_at, v_effective_settled_at
    )
    ON CONFLICT (id) DO UPDATE
    SET fulfillment_status = 'fulfilled',
        fulfillment_id = v_grant_id,
        updated_at = v_effective_settled_at;

    -- Sync course_payment_access for backward compatibility projection
    INSERT INTO public.course_payment_access (
      id, user_id, course_id, full_access_granted, certificate_fee_paid,
      source, status, source_transaction_id, full_access_transaction_id,
      granted_at, revoked_at, revoked_reason, updated_at
    )
    VALUES (
      v_access_id, v_tx.user_id, v_tx.course_id, true, false,
      'payment', 'active', v_tx.id, v_tx.id,
      v_effective_settled_at, NULL, NULL, v_effective_settled_at
    )
    ON CONFLICT (user_id, course_id) DO UPDATE
    SET full_access_granted = true,
        source = 'payment',
        status = 'active',
        source_transaction_id = v_tx.id,
        full_access_transaction_id = v_tx.id,
        revoked_at = NULL,
        revoked_reason = NULL,
        updated_at = v_effective_settled_at;

    -- Ensure enrollment row exists (keep paid info for actual payments)
    INSERT INTO public.enrollments (
      id, user_id, course_id, enrolled_at, last_accessed_at,
      paid_provider, paid_amount_vnd, paid_order_id, paid_at
    )
    VALUES (
      v_enrollment_id, v_tx.user_id, v_tx.course_id,
      v_effective_settled_at, v_effective_settled_at,
      v_tx.provider, v_tx.amount_vnd, v_tx.id, v_effective_settled_at
    )
    ON CONFLICT (user_id, course_id) DO UPDATE
    SET paid_provider = EXCLUDED.paid_provider,
        paid_amount_vnd = EXCLUDED.paid_amount_vnd,
        paid_order_id = EXCLUDED.paid_order_id,
        paid_at = EXCLUDED.paid_at,
        last_accessed_at = EXCLUDED.last_accessed_at;

  ELSIF v_tx.purpose = 'certificate_fee' THEN
    -- Record certificate payment item
    INSERT INTO public.payment_transaction_items (
      id, payment_transaction_id, product_id, resource_id,
      unit_price_vnd, quantity, snapshot, fulfillment_status,
      created_at, updated_at
    )
    VALUES (
      v_item_id, v_tx.id, v_product_id, v_tx.course_id,
      v_tx.amount_vnd, 1,
      jsonb_build_object('purpose', v_tx.purpose, 'settled_at', v_effective_settled_at),
      'fulfilled',
      v_effective_settled_at, v_effective_settled_at
    )
    ON CONFLICT (id) DO UPDATE
    SET fulfillment_status = 'fulfilled',
        updated_at = v_effective_settled_at;

    -- Sync course_payment_access certificate fee projection
    INSERT INTO public.course_payment_access (
      id, user_id, course_id, full_access_granted, certificate_fee_paid,
      source, status, source_transaction_id, certificate_fee_transaction_id,
      granted_at, updated_at
    )
    VALUES (
      v_access_id, v_tx.user_id, v_tx.course_id, false, true,
      'payment', 'active', v_tx.id, v_tx.id,
      v_effective_settled_at, v_effective_settled_at
    )
    ON CONFLICT (user_id, course_id) DO UPDATE
    SET certificate_fee_paid = true,
        certificate_fee_transaction_id = v_tx.id,
        updated_at = v_effective_settled_at;
  END IF;

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

-- Explicit drop of previous overloads is required in PostgreSQL because:
-- 1. In migration 20260825110000, grant_course_access_admin was defined with 6 parameters having default values.
-- 2. PostgreSQL CREATE OR REPLACE FUNCTION cannot remove or modify parameter defaults from pg_proc without recreating,
--    and having both 5-arg and 6-arg overloads with overlapping defaults causes ambiguous function call errors (SQLSTATE 42725/42P13).
-- 3. Dropping both overloads in this transaction and redefining the 5-arg canonical function with defaults and the 6-arg
--    compatibility function WITHOUT defaults restores exact signature compatibility without ambiguous invocation traps.
DROP FUNCTION IF EXISTS public.grant_course_access_admin(uuid, text, boolean, boolean, text, uuid);
DROP FUNCTION IF EXISTS public.grant_course_access_admin(uuid, text, boolean, text, uuid);

CREATE OR REPLACE FUNCTION public.grant_course_access_admin(
  p_target_user_id uuid,
  p_course_id text,
  p_full_access boolean DEFAULT true,
  p_reason text DEFAULT 'Admin Grant',
  p_admin_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_effective_admin_id uuid;
  v_access_id text;
  v_enrollment_id text;
  v_now timestamptz := now();
  v_existing_active public.course_entitlement_grants%ROWTYPE;
  v_grant_id text;
BEGIN
  -- Determine canonical actor: authenticated user takes precedence and cannot be spoofed
  IF v_caller IS NOT NULL THEN
    IF p_admin_id IS NOT NULL AND p_admin_id <> v_caller THEN
      RAISE EXCEPTION 'FORBIDDEN: Authenticated caller cannot spoof admin_id.'
        USING ERRCODE = '42501';
    END IF;
    v_effective_admin_id := v_caller;
  ELSE
    v_effective_admin_id := p_admin_id;
  END IF;

  IF v_effective_admin_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Admin actor identity is required.'
      USING ERRCODE = '42501';
  END IF;

  -- Verify actor has admin or support privilege in profiles
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_effective_admin_id
      AND p.role IN ('admin', 'support_staff')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: Actor % is not an administrator or support staff.', v_effective_admin_id
      USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id IS NULL OR p_course_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENTS: Missing target user or course ID.'
      USING ERRCODE = '22023';
  END IF;

  -- Validate target user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: Target user % does not exist.', p_target_user_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Validate course exists
  IF NOT EXISTS (SELECT 1 FROM public.courses WHERE id = p_course_id) THEN
    RAISE EXCEPTION 'COURSE_NOT_FOUND: %', p_course_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Explicitly reject non-full access requests (both false and null)
  IF p_full_access IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'INVALID_GRANT_TYPE: Admin grant only supports full learning access (p_full_access must be true).'
      USING ERRCODE = '22023';
  END IF;

  -- Acquire Entitlement Advisory Lock
  PERFORM pg_advisory_xact_lock(
    hashtextextended('course-entitlement:' || p_target_user_id::text || ':' || p_course_id, 0)
  );

  v_access_id := p_target_user_id || '_' || p_course_id;
  v_enrollment_id := p_target_user_id || '_' || p_course_id;

  -- Check if active entitlement already exists
  SELECT *
  INTO v_existing_active
  FROM public.course_entitlement_grants
  WHERE user_id = p_target_user_id
    AND course_id = p_course_id
    AND status = 'active'
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'status', 'already_entitled',
      'grant_id', v_existing_active.id,
      'user_id', p_target_user_id,
      'course_id', p_course_id,
      'source', v_existing_active.source,
      'message', 'User already has active entitlement'
    );
  END IF;

  -- Create canonical entitlement grant with source = admin_grant
  v_grant_id := 'GRANT-ADMIN-' || extract(epoch from v_now)::bigint || '-' || substr(md5(random()::text), 1, 6);
  INSERT INTO public.course_entitlement_grants (
    id, user_id, course_id, source, status,
    source_transaction_id, granted_by, reason,
    granted_at, created_at, updated_at
  )
  VALUES (
    v_grant_id, p_target_user_id, p_course_id, 'admin_grant', 'active',
    NULL, v_effective_admin_id, p_reason,
    v_now, v_now, v_now
  );

  -- Sync course_payment_access compatibility projection
  INSERT INTO public.course_payment_access (
    id, user_id, course_id, full_access_granted, certificate_fee_paid,
    source, status, source_transaction_id, granted_by,
    granted_at, revoked_at, revoked_reason, updated_at
  )
  VALUES (
    v_access_id, p_target_user_id, p_course_id, true, false,
    'admin_grant', 'active', NULL, v_effective_admin_id,
    v_now, NULL, NULL, v_now
  )
  ON CONFLICT (user_id, course_id) DO UPDATE
  SET full_access_granted = true,
      source = 'admin_grant',
      status = 'active',
      source_transaction_id = NULL,
      granted_by = v_effective_admin_id,
      revoked_at = NULL,
      revoked_reason = NULL,
      updated_at = v_now;

  -- Create enrollment WITHOUT fake payment values (paid fields stay NULL)
  INSERT INTO public.enrollments (
    id, user_id, course_id, enrolled_at, last_accessed_at
  )
  VALUES (
    v_enrollment_id, p_target_user_id, p_course_id, v_now, v_now
  )
  ON CONFLICT (user_id, course_id) DO UPDATE
  SET last_accessed_at = v_now;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'granted',
    'grant_id', v_grant_id,
    'user_id', p_target_user_id,
    'course_id', p_course_id,
    'full_access', true,
    'source', 'admin_grant',
    'granted_by', v_effective_admin_id,
    'reason', p_reason
  );
END;
$$;

-- Compatibility overload for callers still providing p_cert_fee_paid
CREATE OR REPLACE FUNCTION public.grant_course_access_admin(
  p_target_user_id uuid,
  p_course_id text,
  p_full_access boolean,
  p_cert_fee_paid boolean,
  p_reason text,
  p_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_cert_fee_paid = true THEN
    RAISE EXCEPTION 'ADMIN_GRANT_CERTIFICATE_PAYMENT_FORBIDDEN: Admin grant cannot waive or grant certificate fee payments.'
      USING ERRCODE = '22023';
  END IF;

  IF p_full_access IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'INVALID_GRANT_TYPE: Admin grant only supports full learning access (p_full_access must be true).'
      USING ERRCODE = '22023';
  END IF;

  RETURN public.grant_course_access_admin(
    p_target_user_id,
    p_course_id,
    p_full_access,
    p_reason,
    p_admin_id
  );
END;
$$;

-- =============================================================================
-- 7. Refund Lifecycle: Stage A (Request) and Stage B (Provider Finalize)
-- =============================================================================

-- Stage A: Request Payment Refund (Admin / Backend)
CREATE OR REPLACE FUNCTION public.request_payment_refund(
  p_payment_transaction_id text,
  p_refund_amount_vnd int,
  p_reason text,
  p_actor_user_id uuid DEFAULT NULL,
  p_provider_payload jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx public.payment_transactions%ROWTYPE;
  v_existing_active_refund public.payment_refunds%ROWTYPE;
  v_refund_id text;
  v_now timestamptz := now();
  v_caller uuid := auth.uid();
  v_actor uuid;
BEGIN
  -- Determine canonical actor: authenticated caller cannot spoof actor
  IF v_caller IS NOT NULL THEN
    IF p_actor_user_id IS NOT NULL AND p_actor_user_id <> v_caller THEN
      RAISE EXCEPTION 'FORBIDDEN: Authenticated caller cannot spoof actor_user_id.'
        USING ERRCODE = '42501';
    END IF;
    v_actor := v_caller;
  ELSE
    v_actor := p_actor_user_id;
  END IF;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Refund actor identity is required.'
      USING ERRCODE = '42501';
  END IF;

  -- Verify actor has admin or support privilege in profiles
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_actor
      AND p.role IN ('admin', 'support_staff')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: Actor % is not an administrator or support staff.', v_actor
      USING ERRCODE = '42501';
  END IF;

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

  IF v_tx.status NOT IN ('paid', 'refund_requested') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATUS_FOR_REFUND: Cannot refund transaction with status %', v_tx.status
      USING ERRCODE = '22000';
  END IF;

  -- Strictly full refund
  IF p_refund_amount_vnd::bigint <> v_tx.amount_vnd::bigint THEN
    RAISE EXCEPTION 'PARTIAL_REFUND_NOT_SUPPORTED: Requested %, transaction amount %', p_refund_amount_vnd, v_tx.amount_vnd
      USING ERRCODE = '22023';
  END IF;

  -- Check if active / completed refund already exists
  SELECT *
  INTO v_existing_active_refund
  FROM public.payment_refunds
  WHERE payment_transaction_id = p_payment_transaction_id
    AND status IN ('requested', 'approved', 'processing', 'completed')
  LIMIT 1;

  IF FOUND THEN
    IF v_existing_active_refund.status = 'completed' THEN
      RAISE EXCEPTION 'PAYMENT_ALREADY_FULLY_REFUNDED: %', p_payment_transaction_id
        USING ERRCODE = '22000';
    END IF;

    -- Idempotent return of active refund request
    RETURN jsonb_build_object(
      'ok', true,
      'status', 'refund_requested',
      'idempotent_replay', true,
      'refund_id', v_existing_active_refund.id,
      'transaction_id', p_payment_transaction_id,
      'amount_vnd', v_existing_active_refund.amount_vnd
    );
  END IF;

  v_refund_id := 'REFUND-' || extract(epoch from v_now)::bigint || '-' || substr(md5(random()::text), 1, 8);

  INSERT INTO public.payment_refunds (
    id, payment_transaction_id, user_id, amount_vnd, status, reason,
    requested_by, provider_payload,
    created_at, updated_at
  )
  VALUES (
    v_refund_id, p_payment_transaction_id, v_tx.user_id,
    p_refund_amount_vnd, 'requested', p_reason,
    v_actor, p_provider_payload,
    v_now, v_now
  );

  UPDATE public.payment_transactions
  SET status = 'refund_requested',
      updated_at = v_now
  WHERE id = p_payment_transaction_id;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'refund_requested',
    'idempotent_replay', false,
    'refund_id', v_refund_id,
    'transaction_id', p_payment_transaction_id,
    'amount_vnd', p_refund_amount_vnd
  );
END;
$$;

-- Stage B: Private Finalizer for Provider Confirmed Refunds
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.finalize_provider_payment_refund(
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
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_tx public.payment_transactions%ROWTYPE;
  v_existing_active_refund public.payment_refunds%ROWTYPE;
  v_refund_id text;
  v_now timestamptz := now();
  v_normalized_provider_refund_id text := NULLIF(trim(p_provider_refund_id), '');
BEGIN
  IF v_normalized_provider_refund_id IS NULL THEN
    RAISE EXCEPTION 'MISSING_PROVIDER_REFUND_ID: Provider refund/event id is required.'
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

  IF v_tx.status NOT IN ('paid', 'refund_requested') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATUS_FOR_REFUND: Cannot finalize refund on transaction with status %', v_tx.status
      USING ERRCODE = '22000';
  END IF;

  IF p_refund_amount_vnd::bigint <> v_tx.amount_vnd::bigint THEN
    RAISE EXCEPTION 'PARTIAL_REFUND_NOT_SUPPORTED: Requested %, transaction amount %', p_refund_amount_vnd, v_tx.amount_vnd
      USING ERRCODE = '22023';
  END IF;

  -- Find existing active refund request to complete
  SELECT *
  INTO v_existing_active_refund
  FROM public.payment_refunds
  WHERE payment_transaction_id = p_payment_transaction_id
    AND status IN ('requested', 'approved', 'processing')
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    v_refund_id := v_existing_active_refund.id;
    UPDATE public.payment_refunds
    SET status = 'completed',
        provider_refund_id = v_normalized_provider_refund_id,
        provider_payload = COALESCE(p_provider_refund_payload, provider_payload),
        processed_by = COALESCE(p_actor_user_id, processed_by),
        updated_at = v_now,
        completed_at = v_now
    WHERE id = v_refund_id;
  ELSE
    v_refund_id := 'REFUND-' || extract(epoch from v_now)::bigint || '-' || substr(md5(random()::text), 1, 8);
    INSERT INTO public.payment_refunds (
      id, payment_transaction_id, user_id, amount_vnd, status, reason,
      requested_by, processed_by, provider_refund_id, provider_payload,
      created_at, updated_at, completed_at
    )
    VALUES (
      v_refund_id, p_payment_transaction_id, v_tx.user_id,
      p_refund_amount_vnd, 'completed', p_reason,
      p_actor_user_id, p_actor_user_id, v_normalized_provider_refund_id, p_provider_refund_payload,
      v_now, v_now, v_now
    );
  END IF;

  UPDATE public.payment_transactions
  SET status = 'refunded',
      updated_at = v_now
  WHERE id = p_payment_transaction_id;

  -- Revoke item fulfillment status
  UPDATE public.payment_transaction_items
  SET fulfillment_status = 'revoked',
      updated_at = v_now
  WHERE payment_transaction_id = p_payment_transaction_id;

  -- Revoke ONLY payment entitlement grants matching this transaction
  UPDATE public.course_entitlement_grants
  SET status = 'revoked',
      revoked_at = v_now,
      revoked_reason = p_reason,
      updated_at = v_now
  WHERE user_id = v_tx.user_id
    AND course_id = v_tx.course_id
    AND source = 'payment'
    AND source_transaction_id = p_payment_transaction_id;

  -- Sync course_payment_access compatibility projection
  UPDATE public.course_payment_access
  SET full_access_granted = CASE
        WHEN source_transaction_id = p_payment_transaction_id OR full_access_transaction_id = p_payment_transaction_id THEN false
        ELSE full_access_granted
      END,
      certificate_fee_paid = CASE
        WHEN certificate_fee_transaction_id = p_payment_transaction_id THEN false
        ELSE certificate_fee_paid
      END,
      status = CASE
        WHEN source = 'admin_grant' THEN 'active'
        WHEN (source_transaction_id = p_payment_transaction_id OR full_access_transaction_id = p_payment_transaction_id) AND certificate_fee_paid = false THEN 'revoked'
        ELSE status
      END,
      revoked_at = CASE
        WHEN source <> 'admin_grant' AND (source_transaction_id = p_payment_transaction_id OR full_access_transaction_id = p_payment_transaction_id) THEN v_now
        ELSE revoked_at
      END,
      revoked_reason = CASE
        WHEN source <> 'admin_grant' AND (source_transaction_id = p_payment_transaction_id OR full_access_transaction_id = p_payment_transaction_id) THEN p_reason
        ELSE revoked_reason
      END,
      updated_at = v_now
  WHERE user_id = v_tx.user_id
    AND course_id = v_tx.course_id
    AND (
      source_transaction_id = p_payment_transaction_id
      OR full_access_transaction_id = p_payment_transaction_id
      OR certificate_fee_transaction_id = p_payment_transaction_id
    );

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'refunded',
    'refund_id', v_refund_id,
    'provider_refund_id', v_normalized_provider_refund_id,
    'transaction_id', p_payment_transaction_id,
    'amount_vnd', p_refund_amount_vnd,
    'completed_at', v_now
  );
END;
$$;

-- Stage B Public Entrypoint: Provider Confirmed Refund
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
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_tx public.payment_transactions%ROWTYPE;
  v_existing public.payment_refunds%ROWTYPE;
  v_normalized_provider_refund_id text := NULLIF(trim(p_provider_refund_id), '');
BEGIN
  IF v_normalized_provider_refund_id IS NULL THEN
    RAISE EXCEPTION 'MISSING_PROVIDER_REFUND_ID: Provider refund/event id is required.'
      USING ERRCODE = '22023';
  END IF;

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

    RETURN jsonb_build_object(
      'ok', true,
      'idempotent_replay', true,
      'refund_id', v_existing.id,
      'provider_refund_id', v_existing.provider_refund_id,
      'transaction_id', p_payment_transaction_id,
      'amount_vnd', v_existing.amount_vnd,
      'status', v_tx.status
    );
  END IF;

  RETURN private.finalize_provider_payment_refund(
    p_payment_transaction_id,
    p_refund_amount_vnd,
    p_reason,
    v_normalized_provider_refund_id,
    p_actor_user_id,
    p_provider_refund_payload
  ) || jsonb_build_object('idempotent_replay', false);
END;
$$;

-- Compatibility Request-Only Wrapper
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
BEGIN
  -- Delegates to request_payment_refund (does NOT complete refund without provider confirmation)
  RETURN public.request_payment_refund(
    p_payment_transaction_id,
    p_refund_amount_vnd,
    p_reason,
    p_actor_user_id,
    p_provider_refund_payload
  );
END;
$$;

-- =============================================================================
-- 8. Server-Calculated Quiz Practice Integrity & Access Boundary
-- =============================================================================

-- Drop raw authenticated direct insert policy on question attempts
DROP POLICY IF EXISTS sqa_insert ON public.section_question_attempts;
REVOKE INSERT ON public.section_question_attempts FROM anon, authenticated;

-- Helper to verify course quiz access
CREATE OR REPLACE FUNCTION private.check_user_course_quiz_access(
  p_course_id text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_course public.courses%ROWTYPE;
  v_access_model text;
  v_has_entitlement boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT *
  INTO v_course
  FROM public.courses
  WHERE id = p_course_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Instructor, co-instructor, or admin/support staff have full access
  IF v_course.instructor_id = p_user_id
     OR (v_course.data->'co_instructor_permissions') ? (p_user_id::text)
     OR public.is_admin_or_support() THEN
    RETURN true;
  END IF;

  v_access_model := COALESCE(v_course.data->>'access_model', 'free');
  IF v_access_model = 'free' OR v_access_model = 'free_with_paid_certificate' THEN
    RETURN true;
  END IF;

  -- Paid course requires active entitlement
  SELECT EXISTS (
    SELECT 1
    FROM public.course_entitlement_grants
    WHERE user_id = p_user_id
      AND course_id = p_course_id
      AND status = 'active'
  ) INTO v_has_entitlement;

  RETURN COALESCE(v_has_entitlement, false);
END;
$$;

-- Single Quiz Attempt Submission RPC
CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(
  p_course_id text,
  p_section_id text DEFAULT NULL,
  p_lesson_id text DEFAULT NULL,
  p_question_id text DEFAULT NULL,
  p_selected_index int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_question public.course_section_questions%ROWTYPE;
  v_options jsonb;
  v_options_count int;
  v_correct_index_raw text;
  v_correct_index int;
  v_is_correct boolean;
  v_attempt_id text;
  v_now timestamptz := now();
  v_section_id text;
  v_lesson_id text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Must be logged in to submit quiz.'
      USING ERRCODE = '42501';
  END IF;

  IF p_course_id IS NULL OR p_question_id IS NULL OR p_selected_index IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENTS: Missing course_id, question_id, or selected_index.'
      USING ERRCODE = '22023';
  END IF;

  -- Verify course access
  IF NOT private.check_user_course_quiz_access(p_course_id, v_user_id) THEN
    RAISE EXCEPTION 'COURSE_ACCESS_REQUIRED: User does not have access to course %', p_course_id
      USING ERRCODE = '42501';
  END IF;

  -- Fetch canonical question
  SELECT *
  INTO v_question
  FROM public.course_section_questions
  WHERE id = p_question_id
    AND course_id = p_course_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUESTION_NOT_FOUND: Question % does not belong to course %', p_question_id, p_course_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Validate Section vs Lesson Scoping
  IF v_question.lesson_id IS NOT NULL THEN
    -- Lesson question
    IF p_lesson_id IS NOT NULL AND p_lesson_id <> v_question.lesson_id THEN
      RAISE EXCEPTION 'LESSON_MISMATCH: Question belongs to lesson %, not %', v_question.lesson_id, p_lesson_id
        USING ERRCODE = '22023';
    END IF;
    v_lesson_id := v_question.lesson_id;
    v_section_id := NULL;
  ELSE
    -- Section question
    IF p_lesson_id IS NOT NULL THEN
      RAISE EXCEPTION 'SECTION_QUESTION_CANNOT_HAVE_LESSON: Question % is a section question.', p_question_id
        USING ERRCODE = '22023';
    END IF;
    IF p_section_id IS NOT NULL AND p_section_id <> v_question.section_id THEN
      RAISE EXCEPTION 'SECTION_MISMATCH: Question belongs to section %, not %', v_question.section_id, p_section_id
        USING ERRCODE = '22023';
    END IF;
    v_section_id := v_question.section_id;
    v_lesson_id := NULL;
  END IF;

  -- Validate options array
  v_options := v_question.data->'options';
  IF v_options IS NULL OR jsonb_typeof(v_options) <> 'array' OR jsonb_array_length(v_options) = 0 THEN
    RAISE EXCEPTION 'MALFORMED_QUESTION_OPTIONS: Question % has no valid options array.', p_question_id
      USING ERRCODE = '22023';
  END IF;

  v_options_count := jsonb_array_length(v_options);

  -- Validate canonical correct_index
  v_correct_index_raw := COALESCE(v_question.data->>'correct_index', v_question.data->>'correctIndex');
  IF v_correct_index_raw IS NULL OR v_correct_index_raw !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'INVALID_QUESTION_CORRECT_INDEX: Question % has invalid correct_index.', p_question_id
      USING ERRCODE = '22023';
  END IF;

  v_correct_index := v_correct_index_raw::int;
  IF v_correct_index < 0 OR v_correct_index >= v_options_count THEN
    RAISE EXCEPTION 'INVALID_QUESTION_CORRECT_INDEX: Correct index % out of bounds for % options.', v_correct_index, v_options_count
      USING ERRCODE = '22023';
  END IF;

  -- Validate selected_index range
  IF p_selected_index < 0 OR p_selected_index >= v_options_count THEN
    RAISE EXCEPTION 'SELECTED_INDEX_OUT_OF_RANGE: Selected index % must be between 0 and %.', p_selected_index, v_options_count - 1
      USING ERRCODE = '22023';
  END IF;

  v_is_correct := (p_selected_index = v_correct_index);
  v_attempt_id := gen_random_uuid()::text;

  INSERT INTO public.section_question_attempts (
    id,
    user_id,
    course_id,
    section_id,
    lesson_id,
    question_id,
    selected_index,
    is_correct,
    attempted_at
  )
  VALUES (
    v_attempt_id,
    v_user_id,
    p_course_id,
    v_section_id,
    v_lesson_id,
    p_question_id,
    p_selected_index,
    v_is_correct,
    v_now
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_attempt_id,
    'user_id', v_user_id,
    'course_id', p_course_id,
    'section_id', v_section_id,
    'lesson_id', v_lesson_id,
    'question_id', p_question_id,
    'selected_index', p_selected_index,
    'is_correct', v_is_correct,
    'attempted_at', v_now
  );
END;
$$;

-- Atomic Batch Quiz Attempts Submission RPC
CREATE OR REPLACE FUNCTION public.submit_quiz_attempts(
  p_attempts jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_item jsonb;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF p_attempts IS NULL OR jsonb_typeof(p_attempts) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_ARGUMENTS: p_attempts must be a JSON array.'
      USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_attempts)
  LOOP
    v_result := public.submit_quiz_attempt(
      p_course_id => v_item->>'course_id',
      p_section_id => v_item->>'section_id',
      p_lesson_id => v_item->>'lesson_id',
      p_question_id => v_item->>'question_id',
      p_selected_index => (v_item->>'selected_index')::int
    );
    v_results := v_results || jsonb_build_array(v_result);
  END LOOP;

  RETURN v_results;
END;
$$;

-- =============================================================================
-- 9. Role Permissions & Execution Rights (Explicit Lockdown)
-- =============================================================================

-- Maintain USAGE on schema private for anon, authenticated, service_role
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

-- Revoke all permissions on private functions from client roles
REVOKE ALL ON FUNCTION private.finalize_provider_payment_refund(text, int, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.finalize_provider_payment_refund(text, int, text, text, uuid, jsonb) TO service_role;

REVOKE ALL ON FUNCTION private.check_user_course_quiz_access(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.check_user_course_quiz_access(text, uuid) TO service_role;

-- Financial / Admin RPCs: SERVICE_ROLE ONLY
REVOKE ALL ON FUNCTION public.create_payment_checkout_transaction(text, uuid, text, text, int, int, text, int, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_payment_checkout_transaction(text, uuid, text, text, int, int, text, int, text, timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.process_successful_payment(text, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_successful_payment(text, jsonb, timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.request_payment_refund(text, int, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_payment_refund(text, int, text, uuid, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.process_provider_payment_refund(text, int, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_provider_payment_refund(text, int, text, text, uuid, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.process_payment_refund(text, int, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_refund(text, int, text, uuid, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.grant_course_access_admin(uuid, text, boolean, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_course_access_admin(uuid, text, boolean, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.grant_course_access_admin(uuid, text, boolean, boolean, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_course_access_admin(uuid, text, boolean, boolean, text, uuid) TO service_role;

-- Quiz RPCs: AUTHENTICATED and SERVICE_ROLE
REVOKE ALL ON FUNCTION public.submit_quiz_attempt(text, text, text, text, int) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_quiz_attempt(text, text, text, text, int) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.submit_quiz_attempts(jsonb) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_quiz_attempts(jsonb) TO authenticated, service_role;

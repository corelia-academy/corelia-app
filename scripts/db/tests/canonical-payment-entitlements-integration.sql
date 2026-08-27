-- =============================================================================
-- Canonical Wave DB Integration Suite: Payment, Entitlements, Quiz Integrity
-- Runs only in disposable local Supabase database.
-- =============================================================================

DO $canonical_integration$
DECLARE
  v_buyer uuid := '85000000-0000-4000-8000-000000000001'::uuid;
  v_admin uuid := '85000000-0000-4000-8000-000000000002'::uuid;
  v_student2 uuid := '85000000-0000-4000-8000-000000000003'::uuid;
  v_impostor uuid := '85000000-0000-4000-8000-000000000004'::uuid;
  v_result jsonb;
  v_caught boolean;
  v_count int;
  v_tx_count_before int;
  v_item_count_before int;
  v_attempt_count_before int;
  v_grant public.course_entitlement_grants%ROWTYPE;
  v_q_sec text := 'q-canonical-sec-01';
  v_q_les text := 'q-canonical-les-01';
  v_q_bad text := 'q-canonical-bad-01';
BEGIN
  -- ---------------------------------------------------------------------------
  -- Setup Test Fixtures: Users, Profiles, Courses, Sections, Lessons, Questions
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, role, aud, raw_app_meta_data, raw_user_meta_data)
  VALUES
    (v_buyer, 'canonical-buyer@test.local', 'authenticated', 'authenticated', '{}', '{}'),
    (v_admin, 'canonical-admin@test.local', 'authenticated', 'authenticated', '{}', '{}'),
    (v_student2, 'canonical-student2@test.local', 'authenticated', 'authenticated', '{}', '{}'),
    (v_impostor, 'canonical-impostor@test.local', 'authenticated', 'authenticated', '{}', '{}')
  ON CONFLICT (id) DO NOTHING;

  -- Canonical role assignment in public.profiles
  INSERT INTO public.profiles (id, role, full_name, email)
  VALUES
    (v_admin, 'admin', 'Canonical Admin', 'canonical-admin@test.local'),
    (v_buyer, 'student', 'Canonical Buyer', 'canonical-buyer@test.local'),
    (v_student2, 'student', 'Canonical Student 2', 'canonical-student2@test.local'),
    (v_impostor, 'student', 'Canonical Impostor', 'canonical-impostor@test.local')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.courses (id, instructor_id, published, slug, data)
  VALUES
    ('c-canonical-paid', v_admin, true, 'c-canonical-paid', '{"title":"Paid Course","access_model":"paid_upfront","price_vnd":250000}'::jsonb),
    ('c-canonical-free', v_admin, true, 'c-canonical-free', '{"title":"Free Course","access_model":"free"}'::jsonb),
    ('c-canonical-conflict', v_admin, true, 'c-canonical-conflict', '{"title":"Conflict Course","access_model":"paid_upfront","price_vnd":300000}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.course_sections (id, course_id, sort_order, data)
  VALUES
    ('sec-canonical-01', 'c-canonical-paid', 1, '{"title":"Section 1"}'::jsonb),
    ('sec-canonical-free-01', 'c-canonical-free', 1, '{"title":"Free Section 1"}'::jsonb)
  ON CONFLICT (course_id, id) DO NOTHING;

  INSERT INTO public.course_lessons (id, course_id, section_id, sort_order, data)
  VALUES
    ('les-canonical-01', 'c-canonical-paid', 'sec-canonical-01', 1, '{"title":"Lesson 1"}'::jsonb)
  ON CONFLICT (course_id, id) DO NOTHING;

  -- Section question: section_id NOT NULL, lesson_id NULL
  -- Lesson question: section_id NULL, lesson_id NOT NULL
  INSERT INTO public.course_section_questions (id, course_id, section_id, lesson_id, sort_order, data)
  VALUES
    (v_q_sec, 'c-canonical-paid', 'sec-canonical-01', NULL, 1, '{"prompt":"Section Question 1","options":["A","B","C","D"],"correct_index":1}'::jsonb),
    (v_q_les, 'c-canonical-paid', NULL, 'les-canonical-01', 1, '{"prompt":"Lesson Question 1","options":["True","False"],"correct_index":0}'::jsonb),
    (v_q_bad, 'c-canonical-paid', 'sec-canonical-01', NULL, 2, '{"prompt":"Bad Question","options":[],"correct_index":0}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  -- ---------------------------------------------------------------------------
  -- 1. PRIVILEGE GATES (has_function_privilege assertions for all overloads)
  -- ---------------------------------------------------------------------------
  -- Financial & Admin RPCs MUST NOT be executable by anon or authenticated
  IF has_function_privilege('anon', 'public.create_payment_checkout_transaction(text,uuid,text,text,integer,integer,text,integer,text,timestamp with time zone)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.create_payment_checkout_transaction(text,uuid,text,text,integer,integer,text,integer,text,timestamp with time zone)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.process_successful_payment(text,jsonb,timestamp with time zone)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.process_successful_payment(text,jsonb,timestamp with time zone)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.request_payment_refund(text,integer,text,uuid,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.request_payment_refund(text,integer,text,uuid,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.process_provider_payment_refund(text,integer,text,text,uuid,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.process_provider_payment_refund(text,integer,text,text,uuid,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.process_payment_refund(text,integer,text,uuid,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.process_payment_refund(text,integer,text,uuid,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.grant_course_access_admin(uuid,text,boolean,text,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.grant_course_access_admin(uuid,text,boolean,text,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.grant_course_access_admin(uuid,text,boolean,boolean,text,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.grant_course_access_admin(uuid,text,boolean,boolean,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'GATE_FAIL: Financial or admin RPC is executable by client role (anon/authenticated)';
  END IF;

  -- Quiz RPCs: anon MUST NOT execute; authenticated MUST execute
  IF has_function_privilege('anon', 'public.submit_quiz_attempt(text,text,text,text,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.submit_quiz_attempts(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'GATE_FAIL: Quiz RPC is executable by anon role';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.submit_quiz_attempt(text,text,text,text,integer)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.submit_quiz_attempts(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'GATE_FAIL: Quiz RPC is not executable by authenticated role';
  END IF;

  -- Service role MUST have execute privilege on all RPCs
  IF NOT has_function_privilege('service_role', 'public.create_payment_checkout_transaction(text,uuid,text,text,integer,integer,text,integer,text,timestamp with time zone)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.process_successful_payment(text,jsonb,timestamp with time zone)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.request_payment_refund(text,integer,text,uuid,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.process_provider_payment_refund(text,integer,text,text,uuid,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.process_payment_refund(text,integer,text,uuid,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.grant_course_access_admin(uuid,text,boolean,text,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.grant_course_access_admin(uuid,text,boolean,boolean,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'GATE_FAIL: Service role lacks execute privilege on financial RPCs';
  END IF;

  -- Schema private: USAGE must be granted to authenticated (to allow public RLS wrappers)
  IF NOT has_schema_privilege('authenticated', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'GATE_FAIL: Authenticated role lacks USAGE on schema private (breaks RLS wrappers)';
  END IF;
  IF NOT has_schema_privilege('anon', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'GATE_FAIL: Anon role lacks USAGE on schema private (breaks RLS wrappers)';
  END IF;

  -- ---------------------------------------------------------------------------
  -- 1.1 RUNTIME RLS WRAPPER VERIFICATION (RLS-WRAP-01, RLS-WRAP-02, RLS-WRAP-03)
  -- ---------------------------------------------------------------------------
  -- RLS-WRAP-01: Admin authenticated caller executes public wrapper -> true
  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE format('SET LOCAL request.jwt.claims TO ''{"sub": "%s", "role": "authenticated"}''', v_admin);
  IF public.is_admin_or_support() IS NOT TRUE THEN
    RAISE EXCEPTION 'RLS_WRAP_FAIL: public.is_admin_or_support() did not return TRUE for authenticated admin fixture';
  END IF;
  IF public.current_profile_role() <> 'admin' THEN
    RAISE EXCEPTION 'RLS_WRAP_FAIL: public.current_profile_role() did not return admin for authenticated admin fixture';
  END IF;

  -- RLS-WRAP-02: Student authenticated caller executes public wrapper -> false
  EXECUTE format('SET LOCAL request.jwt.claims TO ''{"sub": "%s", "role": "authenticated"}''', v_buyer);
  IF public.is_admin_or_support() IS NOT FALSE THEN
    RAISE EXCEPTION 'RLS_WRAP_FAIL: public.is_admin_or_support() did not return FALSE for authenticated student fixture';
  END IF;
  IF public.current_profile_role() <> 'student' THEN
    RAISE EXCEPTION 'RLS_WRAP_FAIL: public.current_profile_role() did not return student for authenticated student fixture';
  END IF;

  -- RLS-WRAP-03: Anonymous / unauthenticated caller executes public wrapper -> false (fail closed)
  EXECUTE 'SET LOCAL ROLE anon';
  EXECUTE 'SET LOCAL request.jwt.claims TO ''{"role": "anon"}''';
  IF public.is_admin_or_support() IS NOT FALSE THEN
    RAISE EXCEPTION 'RLS_WRAP_FAIL: public.is_admin_or_support() did not return FALSE for anon role';
  END IF;
  IF public.current_profile_role() IS NOT NULL THEN
    RAISE EXCEPTION 'RLS_WRAP_FAIL: public.current_profile_role() did not return NULL for anon role';
  END IF;

  -- Reset role & JWT claims context
  EXECUTE 'RESET ROLE';
  EXECUTE 'RESET request.jwt.claims';

  RAISE NOTICE 'CANONICAL GATE 1: Privilege lockdown & RLS wrapper runtime PASS';

  -- ---------------------------------------------------------------------------
  -- 2. CHECKOUT ATOMICITY & REJECTION CASES
  -- ---------------------------------------------------------------------------
  -- 2.1 Happy path checkout creation
  v_result := public.create_payment_checkout_transaction(
    p_order_id => 'CANON-ORD-01',
    p_user_id => v_buyer,
    p_product_id => 'course_access',
    p_resource_id => 'c-canonical-paid',
    p_amount_vnd => 250000,
    p_original_amount_vnd => 250000
  );
  IF v_result->>'status' <> 'pending'
     OR NOT EXISTS (SELECT 1 FROM public.payment_transactions WHERE id = 'CANON-ORD-01')
     OR NOT EXISTS (SELECT 1 FROM public.payment_transaction_items WHERE payment_transaction_id = 'CANON-ORD-01' AND product_id = 'course_access') THEN
    RAISE EXCEPTION 'CHECKOUT_FAIL: Happy path checkout failed to create atomic header and item.';
  END IF;

  -- 2.2 Rejection: Inactive product (Rollback validation)
  SELECT count(*) INTO v_tx_count_before FROM public.payment_transactions;
  SELECT count(*) INTO v_item_count_before FROM public.payment_transaction_items;
  v_caught := false;
  BEGIN
    PERFORM public.create_payment_checkout_transaction('CANON-ORD-FAIL-1', v_buyer, 'non_existent_product', 'c-canonical-paid', 250000, 250000);
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'CHECKOUT_FAIL: Inactive/non-existent product was not rejected.'; END IF;
  IF (SELECT count(*) FROM public.payment_transactions) <> v_tx_count_before
     OR (SELECT count(*) FROM public.payment_transaction_items) <> v_item_count_before THEN
    RAISE EXCEPTION 'CHECKOUT_FAIL: Inactive product rejection left orphan rows.';
  END IF;

  -- 2.3 Rejection: Non-existent course resource (Rollback validation)
  v_caught := false;
  BEGIN
    PERFORM public.create_payment_checkout_transaction('CANON-ORD-FAIL-2', v_buyer, 'course_access', 'c-non-existent', 250000, 250000);
  EXCEPTION WHEN SQLSTATE 'P0002' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'CHECKOUT_FAIL: Non-existent course resource was not rejected.'; END IF;
  IF (SELECT count(*) FROM public.payment_transactions) <> v_tx_count_before
     OR (SELECT count(*) FROM public.payment_transaction_items) <> v_item_count_before THEN
    RAISE EXCEPTION 'CHECKOUT_FAIL: Non-existent course rejection left orphan rows.';
  END IF;

  -- 2.4 Rejection: Amount mismatch (original - discount != amount)
  v_caught := false;
  BEGIN
    PERFORM public.create_payment_checkout_transaction('CANON-ORD-FAIL-3', v_buyer, 'course_access', 'c-canonical-paid', 200000, 250000, 'DISC', 30000);
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'CHECKOUT_FAIL: Amount mismatch was not rejected.'; END IF;

  -- 2.5 Rejection: Non-existent user
  v_caught := false;
  BEGIN
    PERFORM public.create_payment_checkout_transaction('CANON-ORD-FAIL-4', 'fa000000-0000-4000-8000-000000000000'::uuid, 'course_access', 'c-canonical-paid', 250000, 250000);
  EXCEPTION WHEN SQLSTATE 'P0002' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'CHECKOUT_FAIL: Non-existent user was not rejected.'; END IF;

  -- 2.6 Rejection: Negative amount
  v_caught := false;
  BEGIN
    PERFORM public.create_payment_checkout_transaction('CANON-ORD-FAIL-5', v_buyer, 'course_access', 'c-canonical-paid', -50000, -50000);
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'CHECKOUT_FAIL: Negative amount was not rejected.'; END IF;

  -- 2.7 Rejection: NULL order/user/product/resource
  v_caught := false;
  BEGIN
    PERFORM public.create_payment_checkout_transaction(NULL, v_buyer, 'course_access', 'c-canonical-paid', 250000, 250000);
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'CHECKOUT_FAIL: NULL order_id was not rejected.'; END IF;

  -- 2.8 Rejection: Duplicate order_id (idempotency key conflict)
  v_caught := false;
  BEGIN
    PERFORM public.create_payment_checkout_transaction('CANON-ORD-01', v_buyer, 'course_access', 'c-canonical-paid', 250000, 250000);
  EXCEPTION WHEN SQLSTATE '23505' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'CHECKOUT_FAIL: Duplicate order_id was not rejected.'; END IF;

  -- 2.9 Certificate Fee checkout creation
  v_result := public.create_payment_checkout_transaction(
    p_order_id => 'CANON-ORD-CERT-01',
    p_user_id => v_buyer,
    p_product_id => 'certificate_fee',
    p_resource_id => 'c-canonical-paid',
    p_amount_vnd => 50000,
    p_original_amount_vnd => 50000
  );
  IF v_result->>'status' <> 'pending'
     OR NOT EXISTS (SELECT 1 FROM public.payment_transaction_items WHERE payment_transaction_id = 'CANON-ORD-CERT-01' AND product_id = 'certificate_fee') THEN
    RAISE EXCEPTION 'CHECKOUT_FAIL: Certificate fee checkout failed.';
  END IF;

  -- 2.10 Catalog snapshot immutability: Altering course price does not mutate existing transaction snapshot
  UPDATE public.courses SET data = jsonb_set(data, '{price_vnd}', '999999'::jsonb) WHERE id = 'c-canonical-paid';
  IF (SELECT unit_price_vnd FROM public.payment_transaction_items WHERE payment_transaction_id = 'CANON-ORD-01') <> 250000
     OR (SELECT (snapshot->>'unit_price_vnd')::int FROM public.payment_transaction_items WHERE payment_transaction_id = 'CANON-ORD-01') <> 250000 THEN
    RAISE EXCEPTION 'CHECKOUT_FAIL: Transaction item snapshot was mutated by course catalog price update.';
  END IF;
  -- Restore course price
  UPDATE public.courses SET data = jsonb_set(data, '{price_vnd}', '250000'::jsonb) WHERE id = 'c-canonical-paid';

  RAISE NOTICE 'CANONICAL GATE 2: Checkout atomicity, negative amount, nullability, idempotency & snapshot immutability PASS';

  -- ---------------------------------------------------------------------------
  -- 3. PAYMENT SETTLEMENT & ENTITLEMENT INTEGRITY
  -- ---------------------------------------------------------------------------
  -- 3.0 Settlement Rejection on unknown transaction
  v_caught := false;
  BEGIN
    PERFORM public.process_successful_payment('CANON-ORD-NON-EXISTENT', '{}', now());
  EXCEPTION WHEN SQLSTATE 'P0002' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'SETTLEMENT_FAIL: Unknown transaction was not rejected.'; END IF;

  -- 3.0b Settlement Rejection on failed / cancelled terminal transaction
  INSERT INTO public.payment_transactions (id, user_id, course_id, purpose, amount_vnd, provider, status, created_at, updated_at)
  VALUES ('CANON-TX-FAILED-01', v_buyer, 'c-canonical-paid', 'course_purchase', 250000, 'sepay', 'failed', now(), now());
  v_caught := false;
  BEGIN
    PERFORM public.process_successful_payment('CANON-TX-FAILED-01', '{}', now());
  EXCEPTION WHEN SQLSTATE '22000' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'SETTLEMENT_FAIL: Settlement on failed transaction was not rejected.'; END IF;

  -- 3.1 Settle CANON-ORD-01
  v_result := public.process_successful_payment('CANON-ORD-01', '{"provider_tx_id":"P1"}', now());
  IF v_result->>'status' <> 'paid' THEN
    RAISE EXCEPTION 'SETTLEMENT_FAIL: Expected paid status, got %', v_result;
  END IF;

  -- Verify active entitlement grant created with exact provenance
  SELECT * INTO STRICT v_grant
  FROM public.course_entitlement_grants
  WHERE user_id = v_buyer AND course_id = 'c-canonical-paid' AND status = 'active';

  IF v_grant.source <> 'payment' OR v_grant.source_transaction_id <> 'CANON-ORD-01' THEN
    RAISE EXCEPTION 'ENTITLEMENT_FAIL: Grant provenance does not match transaction.';
  END IF;

  -- Verify item status is fulfilled
  IF (SELECT fulfillment_status FROM public.payment_transaction_items WHERE payment_transaction_id = 'CANON-ORD-01') <> 'fulfilled' THEN
    RAISE EXCEPTION 'ITEM_FAIL: Item fulfillment status is not fulfilled.';
  END IF;

  -- Verify backward compatibility projection in course_payment_access
  IF NOT EXISTS (
    SELECT 1 FROM public.course_payment_access
    WHERE user_id = v_buyer AND course_id = 'c-canonical-paid' AND full_access_granted = true AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'COMPAT_FAIL: course_payment_access projection not updated.';
  END IF;

  -- 3.1b Settle Certificate Fee transaction CANON-ORD-CERT-01
  v_result := public.process_successful_payment('CANON-ORD-CERT-01', '{"provider_tx_id":"PCERT1"}', now());
  IF v_result->>'status' <> 'paid' THEN
    RAISE EXCEPTION 'SETTLEMENT_FAIL: Certificate fee settlement failed: %', v_result;
  END IF;
  IF (SELECT fulfillment_status FROM public.payment_transaction_items WHERE payment_transaction_id = 'CANON-ORD-CERT-01') <> 'fulfilled'
     OR (SELECT certificate_fee_paid FROM public.course_payment_access WHERE user_id = v_buyer AND course_id = 'c-canonical-paid') IS NOT TRUE THEN
    RAISE EXCEPTION 'SETTLEMENT_FAIL: Certificate fee fulfillment projection failed.';
  END IF;
  -- Certificate fee settlement must NOT create course_entitlement_grants row
  IF EXISTS (SELECT 1 FROM public.course_entitlement_grants WHERE source_transaction_id = 'CANON-ORD-CERT-01') THEN
    RAISE EXCEPTION 'SETTLEMENT_FAIL: Certificate fee created unexpected course entitlement grant.';
  END IF;

  -- 3.2 Idempotent retry settlement
  v_result := public.process_successful_payment('CANON-ORD-01', '{}', now());
  IF v_result->>'status' <> 'already_paid_reconciled' THEN
    RAISE EXCEPTION 'SETTLEMENT_FAIL: Retry was not recognized as already_paid_reconciled.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.course_entitlement_grants
  WHERE user_id = v_buyer AND course_id = 'c-canonical-paid' AND status = 'active';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'ENTITLEMENT_FAIL: Duplicate active entitlements found after retry (% active).', v_count;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3.3 PAYMENT PROVENANCE DELETION-GUARD (PAY-PROV-DELETE-01)
  -- ---------------------------------------------------------------------------
  -- 1. Create payment transaction fixture
  INSERT INTO public.payment_transactions (
    id, user_id, course_id, purpose, amount_vnd, provider, status, created_at, updated_at, settled_at
  )
  VALUES (
    'CANON-TX-DEL-GUARD', v_buyer, 'c-canonical-paid', 'course_purchase', 250000, 'sepay', 'paid', now(), now(), now()
  );

  -- Insert transaction item fixture
  INSERT INTO public.payment_transaction_items (
    id, payment_transaction_id, product_id, resource_id, unit_price_vnd, quantity, snapshot, fulfillment_status, created_at, updated_at
  )
  VALUES (
    'ITEM-CANON-TX-DEL-GUARD', 'CANON-TX-DEL-GUARD', 'course_access', 'c-canonical-paid', 250000, 1, '{"purpose":"course_purchase"}'::jsonb, 'fulfilled', now(), now()
  );

  -- 2. Create payment-derived entitlement referencing this transaction
  INSERT INTO public.course_entitlement_grants (
    id, user_id, course_id, source, status, source_transaction_id, granted_at, created_at, updated_at
  )
  VALUES (
    'GRANT-DEL-GUARD', v_buyer, 'c-canonical-paid', 'payment', 'revoked', 'CANON-TX-DEL-GUARD', now(), now(), now()
  );

  -- 3. Record state before deletion attempt
  SELECT count(*) INTO v_count FROM public.payment_transactions WHERE id = 'CANON-TX-DEL-GUARD';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'PAY-PROV-DELETE-01: Setup failed, transaction fixture not found.';
  END IF;

  -- 4. Attempt to delete the transaction while entitlement and item reference it
  v_caught := false;
  BEGIN
    DELETE FROM public.payment_transactions WHERE id = 'CANON-TX-DEL-GUARD';
  EXCEPTION WHEN SQLSTATE '23503' THEN
    v_caught := true;
  END;

  -- 5. Expect SQLSTATE 23503 (foreign_key_violation)
  IF NOT v_caught THEN
    RAISE EXCEPTION 'PAY-PROV-DELETE-01: Direct deletion of payment transaction was NOT blocked by ON DELETE RESTRICT FK.';
  END IF;

  -- 6. Verify transaction still exists
  IF NOT EXISTS (SELECT 1 FROM public.payment_transactions WHERE id = 'CANON-TX-DEL-GUARD') THEN
    RAISE EXCEPTION 'PAY-PROV-DELETE-01: Payment transaction was deleted despite RESTRICT FK.';
  END IF;

  -- 7. Verify entitlement still exists
  IF NOT EXISTS (SELECT 1 FROM public.course_entitlement_grants WHERE id = 'GRANT-DEL-GUARD') THEN
    RAISE EXCEPTION 'PAY-PROV-DELETE-01: Entitlement grant was cascaded/deleted.';
  END IF;

  -- 8. Verify source_transaction_id unchanged
  IF (SELECT source_transaction_id FROM public.course_entitlement_grants WHERE id = 'GRANT-DEL-GUARD') <> 'CANON-TX-DEL-GUARD' THEN
    RAISE EXCEPTION 'PAY-PROV-DELETE-01: source_transaction_id was mutated (e.g. SET NULL).';
  END IF;

  -- 9. Verify item still exists
  IF NOT EXISTS (SELECT 1 FROM public.payment_transaction_items WHERE id = 'ITEM-CANON-TX-DEL-GUARD') THEN
    RAISE EXCEPTION 'PAY-PROV-DELETE-01: Transaction item was cascaded/deleted.';
  END IF;

  -- 10. Explicit cleanup in dependency order: dependent entitlement -> item -> transaction
  DELETE FROM public.course_entitlement_grants WHERE id = 'GRANT-DEL-GUARD';
  DELETE FROM public.payment_transaction_items WHERE id = 'ITEM-CANON-TX-DEL-GUARD';
  DELETE FROM public.payment_transactions WHERE id = 'CANON-TX-DEL-GUARD';

  RAISE NOTICE 'PAY-PROV-DELETE-01 PASS: Payment transaction deletion strictly blocked by ON DELETE RESTRICT FK';

  -- 3.4 Direct Provenance Constraint Tests
  -- 3.4a Payment source missing transaction id -> 23514
  v_caught := false;
  BEGIN
    INSERT INTO public.course_entitlement_grants (id, user_id, course_id, source, status, source_transaction_id)
    VALUES ('GRANT-FAIL-1', v_buyer, 'c-canonical-paid', 'payment', 'active', NULL);
  EXCEPTION WHEN SQLSTATE '23514' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'ENTITLEMENT_FAIL: Payment source missing transaction id was not rejected by check constraint.'; END IF;

  -- 3.4b Admin grant source with source_transaction_id -> 23514
  v_caught := false;
  BEGIN
    INSERT INTO public.course_entitlement_grants (id, user_id, course_id, source, status, source_transaction_id, granted_by)
    VALUES ('GRANT-FAIL-2', v_buyer, 'c-canonical-paid', 'admin_grant', 'active', 'CANON-ORD-01', v_admin);
  EXCEPTION WHEN SQLSTATE '23514' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'ENTITLEMENT_FAIL: Admin grant with source_transaction_id was not rejected by check constraint.'; END IF;

  -- 3.4c Admin grant source missing granted_by -> 23514
  v_caught := false;
  BEGIN
    INSERT INTO public.course_entitlement_grants (id, user_id, course_id, source, status, granted_by)
    VALUES ('GRANT-FAIL-3', v_buyer, 'c-canonical-paid', 'admin_grant', 'active', NULL);
  EXCEPTION WHEN SQLSTATE '23514' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'ENTITLEMENT_FAIL: Admin grant missing granted_by was not rejected by check constraint.'; END IF;

  -- 3.4d Invalid source domain -> 23514
  v_caught := false;
  BEGIN
    INSERT INTO public.course_entitlement_grants (id, user_id, course_id, source, status)
    VALUES ('GRANT-FAIL-4', v_buyer, 'c-canonical-paid', 'invalid_source', 'active');
  EXCEPTION WHEN SQLSTATE '23514' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'ENTITLEMENT_FAIL: Invalid source domain was not rejected by check constraint.'; END IF;

  -- 3.4e Duplicate active entitlement for same (user_id, course_id) -> 23505
  v_caught := false;
  BEGIN
    INSERT INTO public.course_entitlement_grants (id, user_id, course_id, source, status, source_transaction_id)
    VALUES ('GRANT-FAIL-DUP', v_buyer, 'c-canonical-paid', 'payment', 'active', 'CANON-ORD-01');
  EXCEPTION WHEN SQLSTATE '23505' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'ENTITLEMENT_FAIL: Duplicate active entitlement was not rejected by unique index.'; END IF;

  RAISE NOTICE 'CANONICAL GATE 3: Payment settlement, entitlement creation, check constraints, unique active index & deletion guard PASS';

  -- ---------------------------------------------------------------------------
  -- 4. ADMIN GRANT & ENROLLMENT PURITY
  -- ---------------------------------------------------------------------------
  -- 4.1 Admin grant course access to student2
  v_result := public.grant_course_access_admin(
    p_target_user_id => v_student2,
    p_course_id => 'c-canonical-paid',
    p_full_access => true,
    p_reason => 'Scholarship Grant',
    p_admin_id => v_admin
  );
  IF v_result->>'status' <> 'granted' THEN
    RAISE EXCEPTION 'ADMIN_GRANT_FAIL: Expected granted, got %', v_result;
  END IF;

  -- Verify admin grant entitlement
  SELECT * INTO STRICT v_grant
  FROM public.course_entitlement_grants
  WHERE user_id = v_student2 AND course_id = 'c-canonical-paid' AND status = 'active';

  IF v_grant.source <> 'admin_grant' OR v_grant.granted_by <> v_admin OR v_grant.source_transaction_id IS NOT NULL THEN
    RAISE EXCEPTION 'ADMIN_GRANT_FAIL: Admin grant provenance corrupted.';
  END IF;

  -- Verify NO payment records or fake payment values created
  IF EXISTS (SELECT 1 FROM public.payment_transactions WHERE user_id = v_student2 AND course_id = 'c-canonical-paid')
     OR (SELECT paid_order_id FROM public.enrollments WHERE user_id = v_student2 AND course_id = 'c-canonical-paid') IS NOT NULL
     OR (SELECT paid_amount_vnd FROM public.enrollments WHERE user_id = v_student2 AND course_id = 'c-canonical-paid') IS NOT NULL THEN
    RAISE EXCEPTION 'ADMIN_GRANT_FAIL: Admin grant created fake payment transactions or fake paid enrollment fields.';
  END IF;

  -- 4.2 Rejection: Non-admin impostor attempting admin grant
  v_caught := false;
  BEGIN
    PERFORM public.grant_course_access_admin(v_buyer, 'c-canonical-free', true, 'Unauthorized', v_impostor);
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'ADMIN_GRANT_FAIL: Impostor actor was not rejected.'; END IF;

  -- 4.3 Rejection: Actor NULL
  v_caught := false;
  BEGIN
    PERFORM public.grant_course_access_admin(v_buyer, 'c-canonical-free', true, 'No Actor', NULL);
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'ADMIN_GRANT_FAIL: NULL actor was not rejected.'; END IF;

  -- 4.4 Rejection: p_full_access = false
  v_caught := false;
  BEGIN
    PERFORM public.grant_course_access_admin(v_buyer, 'c-canonical-free', false, 'Partial', v_admin);
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'ADMIN_GRANT_FAIL: p_full_access = false was not rejected.'; END IF;

  -- 4.5 Rejection: p_full_access = NULL (Finding C)
  v_caught := false;
  BEGIN
    PERFORM public.grant_course_access_admin(v_buyer, 'c-canonical-free', NULL, 'Null Full Access', v_admin);
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'ADMIN_GRANT_FAIL: p_full_access = NULL was not rejected.'; END IF;

  -- 4.6 Rejection: p_cert_fee_paid = true in 6-parameter compatibility overload
  v_caught := false;
  BEGIN
    PERFORM public.grant_course_access_admin(v_buyer, 'c-canonical-free', true, true, 'Cert Fee Waiver', v_admin);
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'ADMIN_GRANT_FAIL: cert fee paid waiver was not rejected.'; END IF;

  -- 4.7 Rejection: p_full_access = NULL in 6-parameter compatibility overload
  v_caught := false;
  BEGIN
    PERFORM public.grant_course_access_admin(v_buyer, 'c-canonical-free', NULL, false, 'Cert Null Access', v_admin);
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'ADMIN_GRANT_FAIL: 6-param p_full_access = NULL was not rejected.'; END IF;

  -- 4.8 Idempotent duplicate admin grant
  v_result := public.grant_course_access_admin(v_student2, 'c-canonical-paid', true, 'Repeat Grant', v_admin);
  IF v_result->>'status' <> 'already_entitled' THEN
    RAISE EXCEPTION 'ADMIN_GRANT_FAIL: Duplicate admin grant was not recognized as already_entitled: %', v_result;
  END IF;

  RAISE NOTICE 'CANONICAL GATE 4: Admin grant & enrollment purity PASS';

  -- ---------------------------------------------------------------------------
  -- 5. CONCURRENT / CONFLICT SETTLEMENT LIFECYCLE
  -- ---------------------------------------------------------------------------
  -- User v_buyer receives admin grant on c-canonical-conflict first
  PERFORM public.grant_course_access_admin(v_buyer, 'c-canonical-conflict', true, 'Early Scholarship', v_admin);

  -- Then a payment transaction CANON-ORD-CONFLICT settles later for the same (user, course)
  PERFORM public.create_payment_checkout_transaction('CANON-ORD-CONFLICT', v_buyer, 'course_access', 'c-canonical-conflict', 300000, 300000);
  v_result := public.process_successful_payment('CANON-ORD-CONFLICT', '{}', now());

  IF v_result->>'status' <> 'settled_conflict_refund_requested' THEN
    RAISE EXCEPTION 'CONFLICT_FAIL: Expected settled_conflict_refund_requested, got %', v_result;
  END IF;

  -- Fact 1: Transaction status is refund_requested
  IF (SELECT status FROM public.payment_transactions WHERE id = 'CANON-ORD-CONFLICT') <> 'refund_requested'
     OR (SELECT settled_at FROM public.payment_transactions WHERE id = 'CANON-ORD-CONFLICT') IS NULL THEN
    RAISE EXCEPTION 'CONFLICT_FAIL: Transaction did not record settlement and refund_requested status.';
  END IF;

  -- Fact 2: Item status is conflict
  IF (SELECT fulfillment_status FROM public.payment_transaction_items WHERE payment_transaction_id = 'CANON-ORD-CONFLICT') <> 'conflict' THEN
    RAISE EXCEPTION 'CONFLICT_FAIL: Item fulfillment_status is not conflict.';
  END IF;

  -- Fact 3: Refund request is created
  IF NOT EXISTS (SELECT 1 FROM public.payment_refunds WHERE payment_transaction_id = 'CANON-ORD-CONFLICT' AND status = 'requested') THEN
    RAISE EXCEPTION 'CONFLICT_FAIL: Automatic refund request not generated.';
  END IF;

  -- Fact 4: Admin grant remains active and untouched
  IF (SELECT source FROM public.course_entitlement_grants WHERE user_id = v_buyer AND course_id = 'c-canonical-conflict' AND status = 'active') <> 'admin_grant' THEN
    RAISE EXCEPTION 'CONFLICT_FAIL: Existing admin grant was overwritten.';
  END IF;

  RAISE NOTICE 'CANONICAL GATE 5: Concurrent/Conflict settlement lifecycle PASS';

  -- ---------------------------------------------------------------------------
  -- 6. TWO-STAGE REFUND LIFECYCLE & ISOLATION
  -- ---------------------------------------------------------------------------
  -- 6.1 Rejection: Actor NULL in request_payment_refund (Finding D)
  v_caught := false;
  BEGIN
    PERFORM public.request_payment_refund('CANON-ORD-01', 250000, 'Null Actor Refund', NULL, '{}');
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'REFUND_FAIL: NULL refund actor was not rejected.'; END IF;

  -- 6.2 Rejection: Impostor Actor in request_payment_refund
  v_caught := false;
  BEGIN
    PERFORM public.request_payment_refund('CANON-ORD-01', 250000, 'Impostor Refund', v_impostor, '{}');
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'REFUND_FAIL: Impostor refund actor was not rejected.'; END IF;

  -- 6.3 Rejection: Partial refund
  v_caught := false;
  BEGIN
    PERFORM public.request_payment_refund('CANON-ORD-01', 100000, 'Partial refund attempt', v_admin, '{}');
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'REFUND_FAIL: Partial refund was not rejected.'; END IF;

  -- 6.4 Stage A Happy path: Request refund for CANON-ORD-01
  v_result := public.request_payment_refund('CANON-ORD-01', 250000, 'Buyer requested refund', v_admin, '{}');
  IF v_result->>'status' <> 'refund_requested' THEN
    RAISE EXCEPTION 'REFUND_FAIL: Stage A did not return refund_requested.';
  END IF;

  -- Entitlement must still be active in Stage A
  IF NOT EXISTS (SELECT 1 FROM public.course_entitlement_grants WHERE user_id = v_buyer AND course_id = 'c-canonical-paid' AND status = 'active') THEN
    RAISE EXCEPTION 'REFUND_FAIL: Entitlement was prematurely revoked during Stage A request.';
  END IF;

  -- 6.5 Stage B Rejection: Missing provider refund ID
  v_caught := false;
  BEGIN
    PERFORM public.process_provider_payment_refund('CANON-ORD-01', 250000, 'Missing provider ID', '   ', v_admin, '{}');
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'REFUND_FAIL: Missing provider refund ID was not rejected.'; END IF;

  -- 6.6 Stage B Happy path: Finalize refund with provider confirmation
  v_result := public.process_provider_payment_refund('CANON-ORD-01', 250000, 'Provider Confirmed', 'SEPAY-CANON-REF-01', v_admin, '{}');
  IF v_result->>'status' <> 'refunded' THEN
    RAISE EXCEPTION 'REFUND_FAIL: Stage B did not finalize to refunded.';
  END IF;

  -- Entitlement is now revoked for CANON-ORD-01
  IF EXISTS (SELECT 1 FROM public.course_entitlement_grants WHERE user_id = v_buyer AND course_id = 'c-canonical-paid' AND status = 'active') THEN
    RAISE EXCEPTION 'REFUND_FAIL: Entitlement was not revoked after Stage B provider confirmation.';
  END IF;

  -- Verify admin grant on c-canonical-paid for student2 was NOT revoked
  IF NOT EXISTS (SELECT 1 FROM public.course_entitlement_grants WHERE user_id = v_student2 AND course_id = 'c-canonical-paid' AND status = 'active') THEN
    RAISE EXCEPTION 'REFUND_FAIL: Refund on buyer transaction revoked admin grant of another student.';
  END IF;

  -- Replay of same provider refund ID is idempotent
  v_result := public.process_provider_payment_refund('CANON-ORD-01', 250000, 'Provider Confirmed', 'SEPAY-CANON-REF-01', v_admin, '{}');
  IF v_result->>'idempotent_replay' <> 'true' THEN
    RAISE EXCEPTION 'REFUND_FAIL: Replay with same provider refund ID was not idempotent.';
  END IF;

  -- Replay with same provider refund ID on a DIFFERENT transaction MUST be rejected
  v_caught := false;
  BEGIN
    PERFORM public.process_provider_payment_refund('CANON-ORD-CONFLICT', 300000, 'Fraudulent replay', 'SEPAY-CANON-REF-01', v_admin, '{}');
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'REFUND_FAIL: Reused provider refund ID across different transactions was not rejected.'; END IF;

  RAISE NOTICE 'CANONICAL GATE 6: Two-stage refund lifecycle & isolation PASS';

  -- ---------------------------------------------------------------------------
  -- 7. SERVER-CALCULATED QUIZ INTEGRITY & ACCESS BOUNDARIES
  -- ---------------------------------------------------------------------------
  -- Re-grant buyer active access on c-canonical-paid for quiz testing
  PERFORM public.grant_course_access_admin(v_buyer, 'c-canonical-paid', true, 'Quiz Access Grant', v_admin);

  -- 7.0 Direct INSERT denial on section_question_attempts under authenticated role
  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE format('SET LOCAL request.jwt.claims TO ''{"sub": "%s", "role": "authenticated"}''', v_buyer);

  v_caught := false;
  BEGIN
    INSERT INTO public.section_question_attempts (id, user_id, course_id, section_id, question_id, selected_index, is_correct)
    VALUES ('hacked-attempt', v_buyer, 'c-canonical-paid', 'sec-canonical-01', v_q_sec, 0, true);
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'QUIZ_FAIL: Direct insert into section_question_attempts was NOT rejected for authenticated role.';
  END IF;

  -- 7.1 Correct answer calculated by server
  v_result := public.submit_quiz_attempt(
    p_course_id => 'c-canonical-paid',
    p_section_id => 'sec-canonical-01',
    p_question_id => v_q_sec,
    p_selected_index => 1 -- Correct index is 1
  );
  IF (v_result->>'is_correct')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'QUIZ_FAIL: Correct answer calculated as incorrect: %', v_result;
  END IF;

  -- 7.2 Wrong answer calculated by server
  v_result := public.submit_quiz_attempt(
    p_course_id => 'c-canonical-paid',
    p_section_id => 'sec-canonical-01',
    p_question_id => v_q_sec,
    p_selected_index => 0 -- Correct index is 1
  );
  IF (v_result->>'is_correct')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'QUIZ_FAIL: Wrong answer calculated as correct: %', v_result;
  END IF;

  -- 7.3 Lesson question validation
  v_result := public.submit_quiz_attempt(
    p_course_id => 'c-canonical-paid',
    p_lesson_id => 'les-canonical-01',
    p_question_id => v_q_les,
    p_selected_index => 0 -- Correct index is 0
  );
  IF (v_result->>'is_correct')::boolean IS NOT TRUE OR v_result->>'lesson_id' <> 'les-canonical-01' THEN
    RAISE EXCEPTION 'QUIZ_FAIL: Lesson question submission failed: %', v_result;
  END IF;

  -- 7.4 Rejection: Section question passed with lesson_id
  v_caught := false;
  BEGIN
    PERFORM public.submit_quiz_attempt('c-canonical-paid', 'sec-canonical-01', 'les-canonical-01', v_q_sec, 1);
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'QUIZ_FAIL: Section question with lesson_id was not rejected.'; END IF;

  -- 7.5 Rejection: Selected index out of bounds
  v_caught := false;
  BEGIN
    PERFORM public.submit_quiz_attempt('c-canonical-paid', 'sec-canonical-01', NULL, v_q_sec, 99);
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'QUIZ_FAIL: Out of bounds selected index was not rejected.'; END IF;

  -- 7.6 Rejection: Malformed question (no options)
  v_caught := false;
  BEGIN
    PERFORM public.submit_quiz_attempt('c-canonical-paid', 'sec-canonical-01', NULL, v_q_bad, 0);
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'QUIZ_FAIL: Malformed question was not rejected.'; END IF;

  -- 7.7 Rejection: Learner WITHOUT access to paid course
  EXECUTE format('SET LOCAL request.jwt.claims TO ''{"sub": "%s", "role": "authenticated"}''', v_impostor);
  v_caught := false;
  BEGIN
    PERFORM public.submit_quiz_attempt('c-canonical-paid', 'sec-canonical-01', NULL, v_q_sec, 1);
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'QUIZ_FAIL: Learner without course access was not rejected.'; END IF;

  -- Switch back to postgres for free-course question fixture insertion
  EXECUTE 'RESET ROLE';
  EXECUTE 'RESET request.jwt.claims';

  -- 7.8 Free course learner without payment is ALLOWED
  INSERT INTO public.course_section_questions (id, course_id, section_id, lesson_id, sort_order, data)
  VALUES ('q-canonical-free-01', 'c-canonical-free', 'sec-canonical-free-01', NULL, 1, '{"prompt":"Free Question","options":["Yes","No"],"correct_index":0}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE format('SET LOCAL request.jwt.claims TO ''{"sub": "%s", "role": "authenticated"}''', v_impostor);

  v_result := public.submit_quiz_attempt('c-canonical-free', 'sec-canonical-free-01', NULL, 'q-canonical-free-01', 0);
  IF (v_result->>'is_correct')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'QUIZ_FAIL: Free course learner submission failed.';
  END IF;

  -- 7.9 Batch submission atomicity & rollback validation
  EXECUTE format('SET LOCAL request.jwt.claims TO ''{"sub": "%s", "role": "authenticated"}''', v_buyer);

  -- Happy path batch
  v_result := public.submit_quiz_attempts(
    jsonb_build_array(
      jsonb_build_object('course_id', 'c-canonical-paid', 'section_id', 'sec-canonical-01', 'question_id', v_q_sec, 'selected_index', 1),
      jsonb_build_object('course_id', 'c-canonical-paid', 'lesson_id', 'les-canonical-01', 'question_id', v_q_les, 'selected_index', 0)
    )
  );
  IF jsonb_array_length(v_result) <> 2 THEN
    RAISE EXCEPTION 'QUIZ_FAIL: Batch submission array length mismatch.';
  END IF;

  -- Atomic Rollback on Batch Error
  SELECT count(*) INTO v_attempt_count_before FROM public.section_question_attempts WHERE user_id = v_buyer;
  v_caught := false;
  BEGIN
    PERFORM public.submit_quiz_attempts(
      jsonb_build_array(
        jsonb_build_object('course_id', 'c-canonical-paid', 'section_id', 'sec-canonical-01', 'question_id', v_q_sec, 'selected_index', 1),
        jsonb_build_object('course_id', 'c-canonical-paid', 'section_id', 'sec-canonical-01', 'question_id', v_q_bad, 'selected_index', 0) -- Malformed question fails
      )
    );
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'QUIZ_FAIL: Malformed batch item did not trigger exception.'; END IF;
  IF (SELECT count(*) FROM public.section_question_attempts WHERE user_id = v_buyer) <> v_attempt_count_before THEN
    RAISE EXCEPTION 'QUIZ_FAIL: Failed batch attempt left partial writes (not atomic).';
  END IF;

  -- Reset role to postgres for cleanup
  EXECUTE 'RESET ROLE';
  EXECUTE 'RESET request.jwt.claims';

  RAISE NOTICE 'CANONICAL GATE 7: Server-calculated quiz integrity & batch atomicity PASS';

  -- ---------------------------------------------------------------------------
  -- 8. RLS AND CROSS-USER ISOLATION GATES
  -- ---------------------------------------------------------------------------
  -- Ensure test fixtures for User B (v_student2) exist
  INSERT INTO public.payment_transactions (
    id, user_id, course_id, purpose, amount_vnd, provider, status, created_at, updated_at
  )
  VALUES ('CANON-TX-STUDENT2', v_student2, 'c-canonical-paid', 'course_purchase', 250000, 'sepay', 'paid', now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.payment_transaction_items (
    id, payment_transaction_id, product_id, resource_id, unit_price_vnd, quantity, snapshot, fulfillment_status, created_at, updated_at
  )
  VALUES ('ITEM-CANON-TX-STUDENT2', 'CANON-TX-STUDENT2', 'course_access', 'c-canonical-paid', 250000, 1, '{}'::jsonb, 'fulfilled', now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.payment_refunds (
    id, payment_transaction_id, user_id, amount_vnd, status, reason, created_at, updated_at
  )
  VALUES ('CANON-REF-STUDENT2', 'CANON-TX-STUDENT2', v_student2, 250000, 'requested', 'Student 2 Refund', now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- 8.1 Execute under authenticated User A context (v_buyer)
  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE format('SET LOCAL request.jwt.claims TO ''{"sub": "%s", "role": "authenticated"}''', v_buyer);

  -- User A can see own entitlement grants
  SELECT count(*) INTO v_count FROM public.course_entitlement_grants WHERE user_id = v_buyer;
  IF v_count < 1 THEN
    RAISE EXCEPTION 'RLS_FAIL: User A cannot see own course entitlement grants.';
  END IF;

  -- User A cannot see User B entitlement grants (Cross-user isolation)
  SELECT count(*) INTO v_count FROM public.course_entitlement_grants WHERE user_id = v_student2;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'RLS_FAIL: User A was able to read User B course entitlement grants (% rows).', v_count;
  END IF;

  -- User A cannot see User B payment transactions
  SELECT count(*) INTO v_count FROM public.payment_transactions WHERE user_id = v_student2;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'RLS_FAIL: User A was able to read User B payment transactions (% rows).', v_count;
  END IF;

  -- User A cannot see User B payment transaction items
  SELECT count(*) INTO v_count FROM public.payment_transaction_items WHERE payment_transaction_id = 'CANON-TX-STUDENT2';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'RLS_FAIL: User A was able to read User B payment transaction items (% rows).', v_count;
  END IF;

  -- User A cannot see User B payment refunds
  SELECT count(*) INTO v_count FROM public.payment_refunds WHERE user_id = v_student2;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'RLS_FAIL: User A was able to read User B payment refunds (% rows).', v_count;
  END IF;

  -- User A cannot update User B entitlement grants
  UPDATE public.course_entitlement_grants SET status = 'revoked' WHERE user_id = v_student2;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'RLS_FAIL: User A was able to update User B course entitlement grants (% rows updated).', v_count;
  END IF;

  -- User A cannot delete User B entitlement grants
  DELETE FROM public.course_entitlement_grants WHERE user_id = v_student2;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'RLS_FAIL: User A was able to delete User B course entitlement grants (% rows deleted).', v_count;
  END IF;

  -- Reset role to postgres for cleanup
  EXECUTE 'RESET ROLE';
  EXECUTE 'RESET request.jwt.claims';

  RAISE NOTICE 'CANONICAL GATE 8: RLS and cross-user isolation PASS';

  -- ---------------------------------------------------------------------------
  -- Cleanup Test Fixtures
  -- ---------------------------------------------------------------------------
  DELETE FROM public.section_question_attempts WHERE course_id LIKE 'c-canonical-%';
  DELETE FROM public.course_section_questions WHERE course_id LIKE 'c-canonical-%';
  DELETE FROM public.course_lessons WHERE course_id LIKE 'c-canonical-%';
  DELETE FROM public.course_sections WHERE course_id LIKE 'c-canonical-%';
  DELETE FROM public.payment_refunds WHERE payment_transaction_id LIKE 'CANON-%';
  DELETE FROM public.course_entitlement_grants WHERE course_id LIKE 'c-canonical-%' OR source_transaction_id LIKE 'CANON-%';
  DELETE FROM public.course_payment_access WHERE course_id LIKE 'c-canonical-%' OR source_transaction_id LIKE 'CANON-%' OR full_access_transaction_id LIKE 'CANON-%' OR certificate_fee_transaction_id LIKE 'CANON-%';
  DELETE FROM public.enrollments WHERE course_id LIKE 'c-canonical-%' OR paid_order_id LIKE 'CANON-%';
  DELETE FROM public.payment_transaction_items WHERE payment_transaction_id LIKE 'CANON-%';
  DELETE FROM public.payment_transactions WHERE id LIKE 'CANON-%';
  DELETE FROM public.courses WHERE id LIKE 'c-canonical-%';
  DELETE FROM public.profiles WHERE id IN (v_buyer, v_admin, v_student2, v_impostor);
  DELETE FROM auth.users WHERE id IN (v_buyer, v_admin, v_student2, v_impostor);

  RAISE NOTICE 'CANONICAL PAYMENT, ENTITLEMENT & QUIZ INTEGRATION SUITE PASS (100 PERCENT SUCCESS)';
END
$canonical_integration$;

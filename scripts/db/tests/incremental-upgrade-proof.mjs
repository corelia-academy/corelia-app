import { spawnSync, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const configText = readFileSync(resolve(process.cwd(), "supabase", "config.toml"), "utf8");
const projectId = configText.match(/^\s*project_id\s*=\s*"([A-Za-z0-9_-]+)"/m)?.[1] || "corelia-app";
const dbContainer = `supabase_db_${projectId}`;

console.log("===============================================================================");
console.log(" INCREMENTAL UPGRADE PROOF: 20260826120000 -> 20260827120000");
console.log(" Target: Strictly local disposable container (" + dbContainer + ")");
console.log("===============================================================================\n");

// 0. Safety Guard: Never run on remote
if (process.env.SUPABASE_DB_URL && !process.env.SUPABASE_DB_URL.includes("127.0.0.1") && !process.env.SUPABASE_DB_URL.includes("localhost")) {
  console.error("[SAFETY_VIOLATION] Refusing to run incremental proof on non-local database.");
  process.exit(1);
}

function runSql(sql) {
  const result = spawnSync(
    "docker",
    ["exec", "-i", dbContainer, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", "-"],
    { input: sql, encoding: "utf8", windowsHide: true }
  );
  if (result.status !== 0) {
    throw new Error(`Incremental Proof SQL Failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function querySql(sql) {
  const result = spawnSync(
    "docker",
    ["exec", "-i", dbContainer, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-tA", "-f", "-"],
    { input: sql, encoding: "utf8", windowsHide: true }
  );
  if (result.status !== 0) {
    throw new Error(`Incremental Proof Query Failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

// 1. Dựng baseline tới 20260826120000
console.log("[STEP 1/4] Resetting local database to baseline version 20260826120000...");
try {
  const resetArgs = ["exec", "supabase", "db", "reset", "--version", "20260826120000", "--local", "--no-seed", "--yes"];
  execFileSync(command, resetArgs, { stdio: "inherit", shell: true });
  console.log("✓ Local database reset to baseline 20260826120000.\n");
} catch (err) {
  console.error("[BASELINE_RESET_FAILURE] Failed to reset to version 20260826120000:", err.message);
  process.exit(1);
}

// Verify baseline state: candidate migration 20260827120000 must NOT be present
const preMigrations = querySql(`
  SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3;
`);
console.log("Baseline applied migrations top 3:\n" + preMigrations + "\n");
if (preMigrations.includes("20260827120000")) {
  console.error("[BASELINE_VERIFY_FAILURE] Candidate migration 20260827120000 is already applied!");
  process.exit(1);
}

// 2. Seed representative legacy state prior to candidate migration
console.log("[STEP 2/4] Seeding representative legacy fixtures into pre-candidate schema...");
const seedSql = `
DO $seed_legacy$
DECLARE
  v_buyer uuid := '91000000-0000-4000-8000-000000000001'::uuid;
  v_admin uuid := '91000000-0000-4000-8000-000000000002'::uuid;
  v_student_admin uuid := '91000000-0000-4000-8000-000000000003'::uuid;
  v_refund_buyer uuid := '91000000-0000-4000-8000-000000000004'::uuid;
BEGIN
  -- Users & Profiles
  INSERT INTO auth.users (id, email, role, aud, raw_app_meta_data, raw_user_meta_data)
  VALUES
    (v_buyer, 'inc-buyer@test.local', 'authenticated', 'authenticated', '{}', '{}'),
    (v_admin, 'inc-admin@test.local', 'authenticated', 'authenticated', '{}', '{}'),
    (v_student_admin, 'inc-student-admin@test.local', 'authenticated', 'authenticated', '{}', '{}'),
    (v_refund_buyer, 'inc-refund-buyer@test.local', 'authenticated', 'authenticated', '{}', '{}')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, role, full_name, email)
  VALUES
    (v_admin, 'admin', 'Incremental Admin', 'inc-admin@test.local'),
    (v_buyer, 'student', 'Incremental Buyer', 'inc-buyer@test.local'),
    (v_student_admin, 'student', 'Incremental Student Admin Grant', 'inc-student-admin@test.local'),
    (v_refund_buyer, 'student', 'Incremental Refund Buyer', 'inc-refund-buyer@test.local')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

  -- Courses
  INSERT INTO public.courses (id, instructor_id, published, slug, data)
  VALUES
    ('c-inc-paid', v_admin, true, 'c-inc-paid', '{"title":"Incremental Paid Course","access_model":"paid_upfront","price_vnd":350000}'::jsonb),
    ('c-inc-free', v_admin, true, 'c-inc-free', '{"title":"Incremental Free Course","access_model":"free"}'::jsonb),
    ('c-inc-cert', v_admin, true, 'c-inc-cert', '{"title":"Incremental Cert Course","access_model":"paid_upfront","price_vnd":50000}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  -- Legacy Sections & Lessons & Questions
  INSERT INTO public.course_sections (id, course_id, sort_order, data)
  VALUES ('sec-inc-01', 'c-inc-paid', 1, '{"title":"Section 1"}'::jsonb)
  ON CONFLICT (course_id, id) DO NOTHING;

  INSERT INTO public.course_lessons (id, course_id, section_id, sort_order, data)
  VALUES ('les-inc-01', 'c-inc-paid', 'sec-inc-01', 1, '{"title":"Lesson 1"}'::jsonb)
  ON CONFLICT (course_id, id) DO NOTHING;

  INSERT INTO public.course_section_questions (id, course_id, section_id, lesson_id, sort_order, data)
  VALUES
    ('q-inc-01', 'c-inc-paid', 'sec-inc-01', NULL, 1, '{"prompt":"Pre question 1","options":["Option A","Option B"],"correct_index":1}'::jsonb),
    ('q-inc-les-01', 'c-inc-paid', NULL, 'les-inc-01', 1, '{"prompt":"Pre lesson question 1","options":["True","False"],"correct_index":0}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  -- Legacy Attempt (client submitted is_correct under old table)
  INSERT INTO public.section_question_attempts (id, user_id, course_id, section_id, lesson_id, question_id, selected_index, is_correct, attempted_at)
  VALUES ('att-inc-01', v_buyer, 'c-inc-paid', 'sec-inc-01', NULL, 'q-inc-01', 1, true, now() - interval '1 day')
  ON CONFLICT (id) DO NOTHING;

  -- Legacy Paid Transaction & course_payment_access
  INSERT INTO public.payment_transactions (
    id, user_id, course_id, purpose, amount_vnd, original_amount_vnd, discount_code, discount_amount_vnd,
    provider, status, settled_at, created_at, updated_at
  )
  VALUES (
    'INC-TX-PAID-01', v_buyer, 'c-inc-paid', 'course_purchase', 350000, 350000, NULL, 0,
    'sepay', 'paid', now() - interval '2 days', now() - interval '2 days', now() - interval '2 days'
  );

  INSERT INTO public.course_payment_access (
    id, user_id, course_id, full_access_granted, certificate_fee_paid, source, status,
    source_transaction_id, full_access_transaction_id, granted_at, updated_at
  )
  VALUES (
    'cpa-inc-paid-01', v_buyer, 'c-inc-paid', true, false, 'payment', 'active',
    'INC-TX-PAID-01', 'INC-TX-PAID-01', now() - interval '2 days', now() - interval '2 days'
  );

  INSERT INTO public.enrollments (
    id, user_id, course_id, enrolled_at, last_accessed_at, paid_provider, paid_amount_vnd, paid_order_id, paid_at
  )
  VALUES (
    'enr-inc-paid-01', v_buyer, 'c-inc-paid', now() - interval '2 days', now() - interval '2 days',
    'sepay', 350000, 'INC-TX-PAID-01', now() - interval '2 days'
  );

  -- Legacy Admin Grant Access (no payment transaction, granted_by recorded)
  INSERT INTO public.course_payment_access (
    id, user_id, course_id, full_access_granted, certificate_fee_paid, source, status,
    granted_by, granted_at, updated_at
  )
  VALUES (
    'cpa-inc-admin-01', v_student_admin, 'c-inc-paid', true, false, 'admin_grant', 'active',
    v_admin, now() - interval '3 days', now() - interval '3 days'
  );

  INSERT INTO public.enrollments (
    id, user_id, course_id, enrolled_at, last_accessed_at
  )
  VALUES (
    'enr-inc-admin-01', v_student_admin, 'c-inc-paid', now() - interval '3 days', now() - interval '3 days'
  );

  -- Legacy Refund Requested Transaction
  INSERT INTO public.payment_transactions (
    id, user_id, course_id, purpose, amount_vnd, provider, status, settled_at, created_at, updated_at
  )
  VALUES (
    'INC-TX-REFUND-01', v_refund_buyer, 'c-inc-paid', 'course_purchase', 350000, 'sepay', 'refund_requested',
    now() - interval '1 day', now() - interval '1 day', now() - interval '1 day'
  );

  INSERT INTO public.payment_refunds (
    id, payment_transaction_id, user_id, amount_vnd, status, reason, requested_by, created_at, updated_at
  )
  VALUES (
    'INC-REF-01', 'INC-TX-REFUND-01', v_refund_buyer, 350000, 'requested', 'Student requested refund',
    v_admin, now() - interval '1 day', now() - interval '1 day'
  );

  INSERT INTO public.course_payment_access (
    id, user_id, course_id, full_access_granted, certificate_fee_paid, source, status,
    source_transaction_id, full_access_transaction_id, granted_at, updated_at
  )
  VALUES (
    'cpa-inc-refund-01', v_refund_buyer, 'c-inc-paid', true, false, 'payment', 'active',
    'INC-TX-REFUND-01', 'INC-TX-REFUND-01', now() - interval '1 day', now() - interval '1 day'
  );

  -- Legacy Certificate-Only Access (full_access_granted = false, certificate_fee_paid = true)
  INSERT INTO public.payment_transactions (
    id, user_id, course_id, purpose, amount_vnd, provider, status, settled_at, created_at, updated_at
  )
  VALUES (
    'INC-TX-CERT-01', v_buyer, 'c-inc-cert', 'certificate_fee', 50000, 'sepay', 'paid',
    now() - interval '1 day', now() - interval '1 day', now() - interval '1 day'
  );

  INSERT INTO public.course_payment_access (
    id, user_id, course_id, full_access_granted, certificate_fee_paid, source, status,
    source_transaction_id, certificate_fee_transaction_id, granted_at, updated_at
  )
  VALUES (
    'cpa-inc-cert-01', v_buyer, 'c-inc-cert', false, true, 'payment', 'active',
    'INC-TX-CERT-01', 'INC-TX-CERT-01', now() - interval '1 day', now() - interval '1 day'
  );

  -- Legacy Historical AI Transaction (pre-retirement cutoff)
  INSERT INTO public.payment_transactions (
    id, user_id, course_id, purpose, amount_vnd, provider, status, settled_at, created_at, updated_at
  )
  VALUES (
    'INC-TX-AI-HIST-01', v_buyer, 'cora-ai', 'ai_subscription', 149000, 'sepay', 'paid',
    '2026-08-25 14:00:00+00', '2026-08-25 14:00:00+00', '2026-08-25 14:00:00+00'
  );
END
$seed_legacy$;
`;
runSql(seedSql);
console.log("✓ Representative legacy fixtures seeded successfully.\n");

// Capture pre-upgrade counts
const preTxCount = querySql("SELECT count(*) FROM public.payment_transactions WHERE id LIKE 'INC-TX-%';");
const preAccessCount = querySql("SELECT count(*) FROM public.course_payment_access WHERE id LIKE 'cpa-inc-%';");
const preRefundCount = querySql("SELECT count(*) FROM public.payment_refunds WHERE id LIKE 'INC-REF-%';");
const preAttemptCount = querySql("SELECT count(*) FROM public.section_question_attempts WHERE id LIKE 'att-inc-%';");
console.log(`Pre-upgrade counts: TX=${preTxCount}, Access=${preAccessCount}, Refunds=${preRefundCount}, Attempts=${preAttemptCount}\n`);

// 3. Apply candidate migration incrementally
console.log("[STEP 3/4] Applying candidate migration 20260827120000 incrementally via 'supabase migration up --local'...");
try {
  const upArgs = ["exec", "supabase", "migration", "up", "--local"];
  execFileSync(command, upArgs, { stdio: "inherit", shell: true });
  console.log("✓ Candidate migration 20260827120000 applied incrementally without error.\n");
} catch (upErr) {
  console.error("[INCREMENTAL_MIGRATION_FAILURE] Failed to apply candidate migration:", upErr.message);
  process.exit(1);
}

// 4. Assert post-upgrade state and business invariants
console.log("[STEP 4/4] Validating post-upgrade invariants...");
const postVerificationSql = `
DO $verify_upgrade$
DECLARE
  v_buyer uuid := '91000000-0000-4000-8000-000000000001'::uuid;
  v_admin uuid := '91000000-0000-4000-8000-000000000002'::uuid;
  v_student_admin uuid := '91000000-0000-4000-8000-000000000003'::uuid;
  v_refund_buyer uuid := '91000000-0000-4000-8000-000000000004'::uuid;
  v_grant public.course_entitlement_grants%ROWTYPE;
  v_item public.payment_transaction_items%ROWTYPE;
  v_result jsonb;
  v_count int;
  v_caught boolean;
BEGIN
  -- 1. Verify schema tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'billing_products')
     OR NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_transaction_items')
     OR NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'course_entitlement_grants') THEN
    RAISE EXCEPTION 'POST_UPGRADE_FAIL: Required new canonical tables missing.';
  END IF;

  -- 2. Verify Product Catalog baseline seeded
  IF NOT EXISTS (SELECT 1 FROM public.billing_products WHERE id = 'course_access' AND active = true)
     OR NOT EXISTS (SELECT 1 FROM public.billing_products WHERE id = 'certificate_fee' AND active = true) THEN
    RAISE EXCEPTION 'POST_UPGRADE_FAIL: Billing products catalog baseline missing.';
  END IF;

  -- 3. Verify Payment Transactions intact
  IF (SELECT count(*) FROM public.payment_transactions WHERE id LIKE 'INC-TX-%') <> ${preTxCount} THEN
    RAISE EXCEPTION 'POST_UPGRADE_FAIL: Payment transactions row count changed after migration.';
  END IF;

  -- 4. Verify Payment Transaction Items backfill
  -- 4.1 Paid course item
  SELECT * INTO STRICT v_item FROM public.payment_transaction_items WHERE payment_transaction_id = 'INC-TX-PAID-01';
  IF v_item.product_id <> 'course_access'
     OR v_item.resource_id <> 'c-inc-paid'
     OR v_item.fulfillment_status <> 'fulfilled'
     OR v_item.unit_price_vnd <> 350000 THEN
    RAISE EXCEPTION 'POST_UPGRADE_FAIL: Paid course transaction item backfilled incorrectly: %', v_item;
  END IF;

  -- 4.2 Certificate fee item
  SELECT * INTO STRICT v_item FROM public.payment_transaction_items WHERE payment_transaction_id = 'INC-TX-CERT-01';
  IF v_item.product_id <> 'certificate_fee'
     OR v_item.resource_id <> 'c-inc-cert'
     OR v_item.fulfillment_status <> 'fulfilled'
     OR v_item.unit_price_vnd <> 50000 THEN
    RAISE EXCEPTION 'POST_UPGRADE_FAIL: Certificate transaction item backfilled incorrectly: %', v_item;
  END IF;

  -- 4.3 Historical AI transaction item NOT created (wave boundary invariant)
  IF EXISTS (SELECT 1 FROM public.payment_transaction_items WHERE payment_transaction_id = 'INC-TX-AI-HIST-01') THEN
    RAISE EXCEPTION 'POST_UPGRADE_FAIL: Historical AI transaction generated unexpected transaction item.';
  END IF;

  -- 5. Verify Course Entitlement Grants backfill
  -- 5.1 Paid course entitlement
  SELECT * INTO STRICT v_grant
  FROM public.course_entitlement_grants
  WHERE user_id = v_buyer AND course_id = 'c-inc-paid' AND status = 'active';

  IF v_grant.source <> 'payment'
     OR v_grant.source_transaction_id <> 'INC-TX-PAID-01' THEN
    RAISE EXCEPTION 'POST_UPGRADE_FAIL: Paid entitlement backfilled with wrong source or transaction id: %', v_grant;
  END IF;

  -- 5.2 Admin grant entitlement
  SELECT * INTO STRICT v_grant
  FROM public.course_entitlement_grants
  WHERE user_id = v_student_admin AND course_id = 'c-inc-paid' AND status = 'active';

  IF v_grant.source <> 'admin_grant'
     OR v_grant.granted_by <> v_admin
     OR v_grant.source_transaction_id IS NOT NULL THEN
    RAISE EXCEPTION 'POST_UPGRADE_FAIL: Admin grant entitlement backfilled with wrong provenance: %', v_grant;
  END IF;

  -- 5.3 Certificate-only row NOT backfilled as learning entitlement
  IF EXISTS (
    SELECT 1 FROM public.course_entitlement_grants
    WHERE user_id = v_buyer AND course_id = 'c-inc-cert'
  ) THEN
    RAISE EXCEPTION 'POST_UPGRADE_FAIL: Certificate fee row was incorrectly backfilled into course_entitlement_grants.';
  END IF;

  -- 5.4 Unique active entitlement constraint verified
  SELECT count(*) INTO v_count
  FROM public.course_entitlement_grants
  WHERE user_id = v_buyer AND course_id = 'c-inc-paid' AND status = 'active';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'POST_UPGRADE_FAIL: More than 1 active entitlement for buyer on c-inc-paid.';
  END IF;

  -- 6. Verify FK ON DELETE RESTRICT on source_transaction_id
  v_caught := false;
  BEGIN
    DELETE FROM public.payment_transactions WHERE id = 'INC-TX-PAID-01';
  EXCEPTION WHEN SQLSTATE '23503' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'POST_UPGRADE_FAIL: Deletion of INC-TX-PAID-01 was NOT blocked by ON DELETE RESTRICT.';
  END IF;

  -- 7. Verify RPC Function Signatures & Permissions
  -- 7.1 grant_course_access_admin 5-arg canonical
  IF NOT has_function_privilege('service_role', 'public.grant_course_access_admin(uuid,text,boolean,text,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.grant_course_access_admin(uuid,text,boolean,text,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.grant_course_access_admin(uuid,text,boolean,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST_UPGRADE_FAIL: 5-arg grant_course_access_admin privilege misconfigured.';
  END IF;

  -- 7.2 grant_course_access_admin 6-arg compatibility
  IF NOT has_function_privilege('service_role', 'public.grant_course_access_admin(uuid,text,boolean,boolean,text,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.grant_course_access_admin(uuid,text,boolean,boolean,text,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.grant_course_access_admin(uuid,text,boolean,boolean,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST_UPGRADE_FAIL: 6-arg grant_course_access_admin privilege misconfigured.';
  END IF;

  -- 7.3 Quiz RPC execution
  IF NOT has_function_privilege('authenticated', 'public.submit_quiz_attempt(text,text,text,text,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.submit_quiz_attempt(text,text,text,text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST_UPGRADE_FAIL: submit_quiz_attempt privilege misconfigured.';
  END IF;

  -- 8. Runtime RPC Execution on Upgraded Database
  -- 8.1 Server-calculated quiz attempt
  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE format('SET LOCAL request.jwt.claims TO ''{"sub": "%s", "role": "authenticated"}''', v_buyer);

  v_result := public.submit_quiz_attempt('c-inc-paid', 'sec-inc-01', NULL, 'q-inc-01', 1);
  IF (v_result->>'is_correct')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'POST_UPGRADE_FAIL: submit_quiz_attempt returned incorrect: %', v_result;
  END IF;

  -- 8.2 Direct INSERT denial on section_question_attempts
  v_caught := false;
  BEGIN
    INSERT INTO public.section_question_attempts (id, user_id, course_id, section_id, question_id, selected_index, is_correct)
    VALUES ('att-hacked', v_buyer, 'c-inc-paid', 'sec-inc-01', 'q-inc-01', 0, true);
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'POST_UPGRADE_FAIL: Direct insert on section_question_attempts was allowed.';
  END IF;

  EXECUTE 'RESET ROLE';
  EXECUTE 'RESET request.jwt.claims';

  -- 9. Explicit Cleanup in FK-safe dependency order
  DELETE FROM public.section_question_attempts WHERE course_id LIKE 'c-inc-%';
  DELETE FROM public.course_section_questions WHERE course_id LIKE 'c-inc-%';
  DELETE FROM public.course_lessons WHERE course_id LIKE 'c-inc-%';
  DELETE FROM public.course_sections WHERE course_id LIKE 'c-inc-%';
  DELETE FROM public.payment_refunds WHERE payment_transaction_id LIKE 'INC-TX-%';
  DELETE FROM public.course_entitlement_grants WHERE course_id LIKE 'c-inc-%' OR source_transaction_id LIKE 'INC-TX-%';
  DELETE FROM public.course_payment_access WHERE course_id LIKE 'c-inc-%' OR source_transaction_id LIKE 'INC-TX-%' OR full_access_transaction_id LIKE 'INC-TX-%' OR certificate_fee_transaction_id LIKE 'INC-TX-%';
  DELETE FROM public.enrollments WHERE course_id LIKE 'c-inc-%' OR paid_order_id LIKE 'INC-TX-%';
  DELETE FROM public.payment_transaction_items WHERE payment_transaction_id LIKE 'INC-TX-%';
  DELETE FROM public.payment_transactions WHERE id LIKE 'INC-TX-%';
  DELETE FROM public.courses WHERE id LIKE 'c-inc-%';
  DELETE FROM public.profiles WHERE id IN (v_buyer, v_admin, v_student_admin, v_refund_buyer);
  DELETE FROM auth.users WHERE id IN (v_buyer, v_admin, v_student_admin, v_refund_buyer);

  RAISE NOTICE 'INCREMENTAL UPGRADE INVARIANT VERIFICATION PASS (100 PERCENT SUCCESS)';
END
$verify_upgrade$;
`;
runSql(postVerificationSql);
console.log("✓ Post-upgrade assertions and business invariants verified 100% successfully.\n");

console.log("===============================================================================");
console.log(" INCREMENTAL UPGRADE PROOF PASSED (100% SUCCESS)");
console.log(" Baseline 20260826120000 -> Candidate 20260827120000 applied safely.");
console.log("===============================================================================");

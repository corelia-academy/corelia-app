import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

const migration = read("supabase/migrations/20260827120000_canonical_payment_entitlements_and_quiz_integrity.sql");
const handler = read("supabase/functions/corelia-api/payments/handlers.ts");
const quizAttempts = read("src/lib/quizAttempts.ts");
const lessonQuiz = read("src/pages/learn/components/LessonQuiz.tsx");
const sectionQuiz = read("src/pages/learn/components/SectionQuiz.tsx");
const payments = read("src/lib/payments.ts");

test("Product Catalog and Payment Transaction Items schema and FK integrity", () => {
  // Billing products table (Product catalog)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.billing_products/i);
  assert.match(migration, /product_type text NOT NULL/i);
  assert.match(migration, /INSERT INTO public\.billing_products/i);
  assert.match(migration, /'course_access'/i);
  assert.match(migration, /'certificate_fee'/i);

  // Payment transaction items table
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.payment_transaction_items/i);
  assert.match(migration, /product_id text NOT NULL REFERENCES public\.billing_products/i);
  assert.match(migration, /resource_id text NOT NULL/i);
  assert.match(migration, /unit_price_vnd int NOT NULL/i);
  assert.match(migration, /quantity int NOT NULL/i);
  assert.match(migration, /snapshot jsonb NOT NULL/i);
  assert.match(migration, /fulfillment_status text NOT NULL DEFAULT 'pending'/i);
  assert.match(migration, /CHECK \(fulfillment_status IN \('pending', 'fulfilled', 'conflict', 'failed', 'revoked'\)\)/i);

  // Relaxation of payment_transactions constraints for future product expansion
  assert.match(migration, /ALTER TABLE public\.payment_transactions\s+ALTER COLUMN course_id DROP NOT NULL/i);
  assert.match(migration, /ALTER TABLE public\.payment_transactions\s+ALTER COLUMN purpose DROP NOT NULL/i);
});

test("Atomic checkout transaction and item creation via RPC", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.create_payment_checkout_transaction/i);
  assert.match(migration, /PRODUCT_NOT_ACTIVE_OR_FOUND/i);
  assert.match(migration, /RESOURCE_NOT_FOUND/i);
  assert.match(migration, /INSERT INTO public\.payment_transactions/i);
  assert.match(migration, /INSERT INTO public\.payment_transaction_items/i);

  // Checkout handler invokes atomic RPC
  assert.match(handler, /db\.rpc\("create_payment_checkout_transaction"/);
});

test("Course Entitlement Grants schema and Database Uniqueness constraint", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.course_entitlement_grants/i);
  assert.match(migration, /user_id uuid NOT NULL REFERENCES auth\.users/i);
  assert.match(migration, /course_id text NOT NULL REFERENCES public\.courses/i);

  // Strict Invariant: Exactly 0 or 1 active entitlement per (user_id, course_id) without grant_type
  assert.match(
    migration,
    /CREATE UNIQUE INDEX IF NOT EXISTS course_entitlement_grants_active_user_course_uidx\s+ON public\.course_entitlement_grants \(user_id, course_id\)\s+WHERE status = 'active'/i,
    "Active entitlement must enforce unique (user_id, course_id) where status = 'active'"
  );
  assert.doesNotMatch(
    migration,
    /course_entitlement_grants_active_.*\(user_id, course_id, grant_type\)/i,
    "Unique active entitlement must NOT include grant_type (certificate fee is not a course entitlement)"
  );

  // Source provenance check retains all historical sources
  assert.match(migration, /source IN \('payment', 'admin_grant', 'voucher', 'free_enrollment', 'legacy'\)/i);
  assert.match(migration, /\(source = 'payment' AND source_transaction_id IS NOT NULL\)/i);
  assert.match(migration, /\(source = 'admin_grant' AND granted_by IS NOT NULL AND source_transaction_id IS NULL\)/i);
});

test("Admin grant RPC does NOT create payment records, does not set paid_provider on enrollments, and forbids certificate fee", () => {
  const adminGrantRpc = migration.slice(
    migration.indexOf("CREATE OR REPLACE FUNCTION public.grant_course_access_admin"),
    migration.indexOf("CREATE OR REPLACE FUNCTION public.request_payment_refund")
  );

  assert.match(adminGrantRpc, /'status',\s*'already_entitled'/i);
  assert.match(adminGrantRpc, /'admin_grant',\s*'active'/i);
  assert.match(adminGrantRpc, /ADMIN_GRANT_CERTIFICATE_PAYMENT_FORBIDDEN/i);
  assert.match(adminGrantRpc, /pg_advisory_xact_lock/i);
  assert.doesNotMatch(adminGrantRpc, /INSERT INTO public\.payment_transactions/i);
  assert.doesNotMatch(adminGrantRpc, /'admin_grant',\s*0,\s*'ADMIN-GRANT-/i, "Must not write fake admin_grant payment fields to enrollments");
  assert.match(adminGrantRpc, /INSERT INTO public\.course_entitlement_grants/i);

  // Handler does not pass certFeePaid
  assert.doesNotMatch(handler, /p_cert_fee_paid/);
});

test("Atomic payment settlement serializes on advisory lock, handles race condition, records conflict item and requests refund", () => {
  const settlementRpc = migration.slice(
    migration.indexOf("CREATE OR REPLACE FUNCTION public.process_successful_payment"),
    migration.indexOf("CREATE OR REPLACE FUNCTION public.grant_course_access_admin")
  );

  assert.match(settlementRpc, /pg_advisory_xact_lock/i);
  assert.match(settlementRpc, /v_existing_active_grant/i);
  assert.match(settlementRpc, /fulfillment_status.*'conflict'/i);
  assert.match(settlementRpc, /INSERT INTO public\.payment_refunds/i);
  assert.match(settlementRpc, /status = 'refund_requested'/i);
  assert.match(settlementRpc, /'settled_conflict_refund_requested'/i);
  assert.match(settlementRpc, /INVALID_PAYMENT_STATUS_FOR_SETTLEMENT/i);
});

test("Refund lifecycle: Stage A request vs Stage B provider confirmation", () => {
  // Stage A: request_payment_refund
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.request_payment_refund/i);
  const requestRpc = migration.slice(
    migration.indexOf("CREATE OR REPLACE FUNCTION public.request_payment_refund"),
    migration.indexOf("CREATE OR REPLACE FUNCTION private.finalize_provider_payment_refund")
  );
  assert.match(requestRpc, /status = 'refund_requested'/i);
  assert.match(requestRpc, /'requested'/i);
  assert.doesNotMatch(requestRpc, /status = 'refunded'/i);
  assert.doesNotMatch(requestRpc, /UPDATE public\.course_entitlement_grants/i);

  // Stage B: finalize_provider_payment_refund
  assert.match(migration, /CREATE OR REPLACE FUNCTION private\.finalize_provider_payment_refund/i);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.process_provider_payment_refund/i);
  const finalizeRpc = migration.slice(
    migration.indexOf("CREATE OR REPLACE FUNCTION private.finalize_provider_payment_refund"),
    migration.indexOf("CREATE OR REPLACE FUNCTION public.process_payment_refund")
  );
  assert.match(finalizeRpc, /MISSING_PROVIDER_REFUND_ID/i);
  assert.match(finalizeRpc, /status = 'completed'/i);
  assert.match(finalizeRpc, /status = 'refunded'/i);
  assert.match(finalizeRpc, /source = 'payment'\s+AND source_transaction_id = p_payment_transaction_id/i);
  assert.doesNotMatch(finalizeRpc, /UPDATE public\.course_entitlement_grants[^;]*source = 'admin_grant'/i);

  // Wrapper delegates to request_payment_refund
  const wrapperRpc = migration.slice(
    migration.indexOf("CREATE OR REPLACE FUNCTION public.process_payment_refund"),
    migration.indexOf("DROP POLICY IF EXISTS sqa_insert")
  );
  assert.match(wrapperRpc, /public\.request_payment_refund/i);

  // Unique active refund request constraint
  assert.match(migration, /payment_refunds_active_request_uidx/i);
});

test("Server-calculated Quiz Integrity RPC, permission revocation, and client removal of isCorrect", () => {
  assert.match(migration, /DROP POLICY IF EXISTS sqa_insert/i);
  assert.match(migration, /REVOKE INSERT ON public\.section_question_attempts FROM anon, authenticated/i);
  assert.match(migration, /CREATE OR REPLACE FUNCTION private\.check_user_course_quiz_access/i);
  assert.match(migration, /COURSE_ACCESS_REQUIRED/i);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.submit_quiz_attempt/i);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.submit_quiz_attempts/i);
  assert.match(migration, /v_is_correct := \(p_selected_index = v_correct_index\)/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.submit_quiz_attempt.*TO authenticated, service_role/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.submit_quiz_attempts.*TO authenticated, service_role/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.submit_quiz_attempt.*FROM anon/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.submit_quiz_attempts.*FROM anon/i);

  // Client uses RPC and does not compute isCorrect
  assert.match(quizAttempts, /supabase\.rpc\("submit_quiz_attempts"/);
  assert.doesNotMatch(quizAttempts, /isCorrect:/);
  assert.doesNotMatch(lessonQuiz, /isCorrect:/);
  assert.doesNotMatch(sectionQuiz, /isCorrect:/);
});

test("Checkout pre-checks existing active entitlement", () => {
  assert.match(handler, /if \(purpose === "course_purchase"\)/);
  assert.match(handler, /\.from\("course_entitlement_grants"\)/);
  assert.match(handler, /\.eq\("status",\s*"active"\)/);
  assert.match(handler, /ALREADY_ENTITLED/);
});

test("Backfill only maps true learning access and preflight validates consistency", () => {
  assert.match(migration, /DO \$canonical_migration_preflight\$/);
  assert.match(migration, /PREFLIGHT_FAIL/);
  assert.match(migration, /\(a\.full_access_granted = true OR a\.full_access_transaction_id IS NOT NULL OR a\.source = 'admin_grant'\)/);
});

test("TypeScript canonical types exported in payments.ts", () => {
  assert.match(payments, /export interface CourseEntitlementGrant/);
  assert.match(payments, /export interface BillingProduct/);
  assert.match(payments, /export interface PaymentTransactionItem/);
});

test("Financial and Admin RPCs are strictly service-only and schema private USAGE is preserved", () => {
  // Schema private USAGE is preserved for public wrappers
  assert.match(migration, /GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;/);
  assert.doesNotMatch(migration, /REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;/);

  // Private functions explicitly revoked from client roles
  assert.match(migration, /REVOKE ALL ON FUNCTION private\.finalize_provider_payment_refund.*FROM PUBLIC, anon, authenticated;/);
  assert.match(migration, /REVOKE ALL ON FUNCTION private\.check_user_course_quiz_access.*FROM PUBLIC, anon, authenticated;/);

  // Financial RPCs revoked from PUBLIC, anon, authenticated and granted strictly to service_role
  const financialRpcs = [
    "create_payment_checkout_transaction",
    "process_successful_payment",
    "request_payment_refund",
    "process_provider_payment_refund",
    "process_payment_refund",
    "grant_course_access_admin",
  ];

  for (const rpc of financialRpcs) {
    assert.match(
      migration,
      new RegExp(`REVOKE ALL ON FUNCTION public\\.${rpc}.*FROM PUBLIC, anon, authenticated;`),
      `public.${rpc} must be revoked from PUBLIC, anon, authenticated`
    );
    assert.match(
      migration,
      new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}.*TO service_role;`),
      `public.${rpc} must be granted to service_role`
    );
    assert.doesNotMatch(
      migration,
      new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}.*TO (?:authenticated|anon)`),
      `public.${rpc} must NOT be granted to authenticated or anon`
    );
  }
});

test("Preflight validation enforces fail-closed checks on duplicate active, orphan FKs, and invalid domains", () => {
  assert.match(migration, /PREFLIGHT_FAIL_DUPLICATE_ACTIVE/);
  assert.match(migration, /PREFLIGHT_FAIL_PAYMENT_MISSING_TX/);
  assert.match(migration, /PREFLIGHT_FAIL_ORPHAN_TX_PROVENANCE/);
  assert.match(migration, /PREFLIGHT_FAIL_ADMIN_GRANT_MISSING_ACTOR/);
  assert.match(migration, /PREFLIGHT_FAIL_ORPHAN_USER_OR_COURSE/);
  assert.match(migration, /PREFLIGHT_FAIL_INVALID_SOURCE_DOMAIN/);
  assert.match(migration, /PREFLIGHT_FAIL_UNMAPPABLE_TX_PURPOSE/);
  assert.match(migration, /PREFLIGHT_FAIL_TX_INVALID_RESOURCE/);
});

test("Checkout and admin grant validate actor/user identity and reject unsupported options", () => {
  assert.match(migration, /USER_NOT_FOUND.*p_user_id/);
  assert.match(migration, /UNSUPPORTED_PRODUCT_FOR_CHECKOUT/);
  assert.match(migration, /USER_NOT_FOUND.*p_target_user_id/);
  assert.match(migration, /INVALID_GRANT_TYPE/);
  assert.match(migration, /p_full_access IS DISTINCT FROM true/, "Must reject NULL and FALSE full_access");
});

test("Actor provenance and role verification strictly use public.profiles and fail closed", () => {
  assert.doesNotMatch(migration, /user_roles/i, "Migration must NOT reference non-existent public.user_roles");
  assert.match(migration, /FROM public\.profiles p/, "Role checks must query public.profiles");
  assert.match(migration, /UNAUTHENTICATED: Refund actor identity is required\./, "Refund request without actor must fail closed");
  assert.match(migration, /UNAUTHENTICATED: Admin actor identity is required\./, "Admin grant without actor must fail closed");
  assert.match(migration, /FORBIDDEN: Authenticated caller cannot spoof/, "Actor spoofing must be rejected");
});

test("Grant course access admin overloads are both locked down to service_role only", () => {
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.grant_course_access_admin\(uuid, text, boolean, text, uuid\) FROM PUBLIC, anon, authenticated;/
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.grant_course_access_admin\(uuid, text, boolean, text, uuid\) TO service_role;/
  );
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.grant_course_access_admin\(uuid, text, boolean, boolean, text, uuid\) FROM PUBLIC, anon, authenticated;/
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.grant_course_access_admin\(uuid, text, boolean, boolean, text, uuid\) TO service_role;/
  );
});

test("Course Entitlement Grants source_transaction_id uses ON DELETE RESTRICT and forbids CASCADE/SET NULL", () => {
  // FK reference must exist and use ON DELETE RESTRICT
  assert.match(
    migration,
    /source_transaction_id\s+text\s+REFERENCES\s+public\.payment_transactions\s*\((?:id)?\)\s+ON\s+DELETE\s+RESTRICT/i,
    "course_entitlement_grants.source_transaction_id must specify ON DELETE RESTRICT"
  );
  // Migration must NOT contain ON DELETE CASCADE on source_transaction_id
  assert.doesNotMatch(
    migration,
    /source_transaction_id[^\n;]*ON\s+DELETE\s+CASCADE/i,
    "course_entitlement_grants must NOT use ON DELETE CASCADE on source_transaction_id"
  );
  // Migration must NOT contain ON DELETE SET NULL on source_transaction_id
  assert.doesNotMatch(
    migration,
    /source_transaction_id[^\n;]*ON\s+DELETE\s+SET\s+NULL/i,
    "course_entitlement_grants must NOT use ON DELETE SET NULL on source_transaction_id"
  );
  // Payment provenance check constraint must mandate source_transaction_id IS NOT NULL when source = 'payment'
  assert.match(
    migration,
    /\(source\s*=\s*'payment'\s+AND\s+source_transaction_id\s+IS\s+NOT\s+NULL\)/i,
    "Provenance check constraint must mandate source_transaction_id IS NOT NULL for payment source"
  );
});

test("RPC functions strictly declare SECURITY DEFINER and immutable search_path", () => {
  const rpcs = [
    "create_payment_checkout_transaction",
    "process_successful_payment",
    "grant_course_access_admin",
    "request_payment_refund",
    "process_provider_payment_refund",
    "process_payment_refund",
    "submit_quiz_attempt",
    "submit_quiz_attempts",
  ];

  for (const rpc of rpcs) {
    const fnRegex = new RegExp(`CREATE OR REPLACE FUNCTION (?:public|private)\\.${rpc}[\\s\\S]*?SET search_path = ([^;\\n]+)`, "i");
    const match = migration.match(fnRegex);
    assert.ok(match, `RPC ${rpc} must be defined with explicit search_path`);
    assert.match(migration, new RegExp(`CREATE OR REPLACE FUNCTION (?:public|private)\\.${rpc}[\\s\\S]*?SECURITY DEFINER`, "i"), `RPC ${rpc} must be SECURITY DEFINER`);
  }
});

test("Instructor-facing AI generator files and functionality preserved according to Issue #327", () => {
  const descriptionGeneratorCode = read("src/lib/descriptionGenerator.ts");
  const descriptionGeneratorTest = read("src/lib/descriptionGenerator.test.ts");

  assert.ok(descriptionGeneratorCode.length > 0, "src/lib/descriptionGenerator.ts must exist");
  assert.ok(descriptionGeneratorTest.length > 0, "src/lib/descriptionGenerator.test.ts must exist");
  assert.match(descriptionGeneratorCode, /invokeGenerateDescription/i);
  assert.match(descriptionGeneratorCode, /serializeGenerateDescriptionRequest/i);
  assert.match(descriptionGeneratorCode, /descriptionGeneratorFunctionUrl/i);
});


test("Candidate migration is forward-only, properly named, and does not alter historical migrations", () => {
  const candidateFilename = "20260827120000_canonical_payment_entitlements_and_quiz_integrity.sql";
  const baseline = JSON.parse(read("docs/db-baseline/baseline.json"));
  assert.equal(baseline.frozenMigrationCount, 139);
  assert.equal(baseline.latestMigration.version, "20260818120000");
  const inBaseline = baseline.migrations.some((m) => m.fileName === candidateFilename);
  assert.equal(inBaseline, false, "Candidate migration must be forward-only and not in historical baseline");
});

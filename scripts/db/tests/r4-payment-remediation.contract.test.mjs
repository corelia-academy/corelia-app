import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");
const handler = read("supabase/functions/corelia-api/payments/handlers.ts");
const grantAccess = read("supabase/functions/corelia-api/payments/grant_access.ts");
const migration = read("supabase/migrations/20260825150000_r4_atomic_payment_refund_and_ai_retirement.sql");
const reconciliation = read("supabase/migrations/20260825151000_r4_staging_catalog_reconciliation.sql");
const functionReconciliation = read("supabase/migrations/20260825152000_r4_function_definition_reconciliation.sql");

test("R4 handler delegates ORDER_PAID to the atomic RPC without pre-marking paid", () => {
  const paidBlock = handler.slice(
    handler.indexOf('if (type === "ORDER_PAID")'),
    handler.indexOf('if (type === "ORDER_REFUND"'),
  );
  assert.ok(paidBlock.includes("grantPaymentAccessForTransaction"));
  assert.ok(!paidBlock.includes('status: "paid"'));
  assert.ok(!paidBlock.includes("payment_transactions"));
  assert.match(paidBlock, /AI_SUBSCRIPTION_RETIRED/);
});

test("R4 removes non-atomic application fallbacks", () => {
  assert.match(grantAccess, /db\.rpc\("process_successful_payment"/);
  assert.doesNotMatch(grantAccess, /\.from\(/);
  assert.doesNotMatch(grantAccess, /Fallback path|compatibility mode/i);
  const refundBlock = handler.slice(
    handler.indexOf('if (type === "ORDER_REFUND"'),
    handler.indexOf('if (type === "ORDER_CANCELLED"'),
  );
  assert.match(refundBlock, /throw new Error\(rpcErr\.message\)/);
  assert.doesNotMatch(refundBlock, /Fallback update|status:\s*"refunded"/);
});

test("R4 settlement is fail-closed, repairs paid retries, and retires AI settlement", () => {
  assert.match(migration, /v_tx\.status NOT IN \('pending', 'paid'\)/);
  assert.match(migration, /already_paid_reconciled/);
  assert.match(migration, /AI_SUBSCRIPTION_RETIRED/);
  assert.match(migration, /full_access_transaction_id/);
  assert.match(migration, /certificate_fee_transaction_id/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS settled_at/);
});

test("R4 refund accounting caps cumulative refunds and preserves exact provenance", () => {
  assert.match(migration, /sum\(amount_vnd\)/i);
  assert.match(migration, /REFUND_AMOUNT_EXCEEDS_REMAINING/);
  assert.match(migration, /partially_refunded/);
  assert.match(migration, /full_access_transaction_id = p_payment_transaction_id/);
  assert.match(migration, /certificate_fee_transaction_id = p_payment_transaction_id/);
  assert.doesNotMatch(migration, /source_transaction_id\s*=\s*p_payment_transaction_id\s+OR\s+source\s*=\s*'payment'/i);
});

test("R4 financial SECURITY DEFINER RPCs revoke PUBLIC client execution", () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.process_successful_payment[\s\S]*FROM PUBLIC/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.process_payment_refund[\s\S]*FROM PUBLIC/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.process_successful_payment[\s\S]*TO service_role/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.process_payment_refund[\s\S]*TO service_role/);
});

test("R4 reconciliation restores guards, preserves multi-session history, and adds delayed search indexes", () => {
  assert.match(reconciliation, /guard_ai_chat_session_message_count/);
  assert.match(reconciliation, /trg_guard_ai_chat_session_message_count/);
  assert.match(reconciliation, /DROP INDEX IF EXISTS public\.ai_chat_sessions_course_unique/);
  assert.match(reconciliation, /public_profiles_username_trgm_idx/);
  assert.match(reconciliation, /public_profiles_ocid_trgm_idx/);
  assert.match(reconciliation, /public_profiles_full_name_trgm_idx/);
  assert.doesNotMatch(reconciliation, /DROP\s+(?:TABLE|FUNCTION).*CASCADE/i);
});

test("R4 forward function reconciliation restores canonical credential activity payload", () => {
  assert.match(functionReconciliation, /private\.emit_activity_on_credential_issuance/);
  assert.match(functionReconciliation, /private\.credential_template_activity_payload\(NEW\.template_id\)/);
  assert.match(functionReconciliation, /internal\.delete_public_profile/);
  assert.match(functionReconciliation, /NOT \(e\.payload \? 'title'\)/);
  assert.doesNotMatch(functionReconciliation, /DROP\s+.*CASCADE/i);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");
const handler = read("supabase/functions/corelia-api/payments/handlers.ts");
const migration = read("supabase/migrations/20260826120000_issue_329_payment_retirement_safety.sql");
const billing = read("src/pages/account/AccountBillingRoute.tsx");
const billingPurpose = read("src/pages/account/billingPurpose.ts");
const localMigrationGate = read("scripts/db/verify-local-migration-apply.mjs");
const en = JSON.parse(read("src/locales/en/account.json"));
const vi = JSON.parse(read("src/locales/vi/account.json"));

test("#329 historical AI reconciliation is pre-retirement, provider-verified, and transaction-only", () => {
  const aiFunction = migration.slice(
    migration.indexOf("CREATE OR REPLACE FUNCTION public.reconcile_historical_ai_payment"),
    migration.indexOf("CREATE OR REPLACE FUNCTION public.process_unsuccessful_payment_callback"),
  );
  assert.match(aiFunction, /v_tx\.created_at >= v_cutoff/);
  assert.match(aiFunction, /v_tx\.provider <> 'sepay'/);
  assert.match(aiFunction, /notification_type' = 'ORDER_PAID'/);
  assert.match(aiFunction, /order_invoice_number.*= v_tx\.id/);
  assert.match(aiFunction, /round\(v_ipn_amount::numeric\) = v_tx\.amount_vnd/);
  assert.match(aiFunction, /verify_endpoint_sepay_lookup/);
  assert.match(aiFunction, /SET status = 'paid',[\s\S]*provider_payload = p_provider_payload,[\s\S]*settled_at = v_effective_settled_at/);
  assert.doesNotMatch(aiFunction, /INSERT INTO public\.(ai_subscriptions|ai_voucher_redemptions|course_payment_access|enrollments)/);
  assert.doesNotMatch(aiFunction, /UPDATE public\.(ai_subscriptions|ai_voucher_redemptions|profiles|course_payment_access|enrollments)/);
  assert.match(handler, /purpose === "ai_subscription"[\s\S]*reconcileHistoricalAiPayment/);
  assert.match(handler, /AI_PAYMENT_RETIREMENT_CUTOFF_MS/);
});

test("#329 failed and cancelled callbacks use one pending-only atomic RPC", () => {
  const callbackFunction = migration.slice(
    migration.indexOf("CREATE OR REPLACE FUNCTION public.process_unsuccessful_payment_callback"),
    migration.indexOf("CREATE OR REPLACE FUNCTION public.process_provider_payment_refund"),
  );
  assert.match(callbackFunction, /FOR UPDATE/);
  assert.match(callbackFunction, /IF v_tx\.status <> 'pending'/);
  assert.match(callbackFunction, /WHERE id = p_payment_transaction_id\s+AND status = 'pending'/);
  assert.match(callbackFunction, /UPDATE public\.ai_voucher_redemptions/);
  assert.match(handler, /db\.rpc\("process_unsuccessful_payment_callback"/);
  assert.doesNotMatch(handler, /releaseVoucherReservationForPayment/);
});

test("#329 provider refund RPC deduplicates before accounting", () => {
  const refundFunction = migration.slice(
    migration.indexOf("CREATE OR REPLACE FUNCTION public.process_provider_payment_refund"),
    migration.indexOf("REVOKE ALL ON FUNCTION public.reconcile_historical_ai_payment"),
  );
  assert.match(migration, /ISSUE_329_PROVIDER_REFUND_ID_DUPLICATE_PREFLIGHT/);
  assert.match(migration, /payment_refunds_provider_refund_id_uidx/);
  assert.match(migration, /ON public\.payment_refunds \(provider_refund_id\)/);
  assert.doesNotMatch(migration, /ON public\.payment_refunds \(payment_transaction_id, provider_refund_id\)/);
  assert.match(refundFunction, /FOR UPDATE/);
  assert.match(refundFunction, /pg_advisory_xact_lock/);
  assert.ok(
    refundFunction.indexOf("WHERE provider_refund_id = v_normalized_provider_refund_id") <
      refundFunction.indexOf("public.process_payment_refund("),
  );
  assert.match(refundFunction, /'idempotent_replay', true/);
  assert.match(refundFunction, /PROVIDER_REFUND_ID_TRANSACTION_MISMATCH/);
  assert.match(handler, /sePayProviderRefundEventId/);
  assert.match(handler, /db\.rpc\("process_provider_payment_refund"/);
  assert.match(handler, /Missing provider refund\/event id/);
});

test("#329 billing maps AI history separately on mobile and desktop with en/vi text", () => {
  assert.match(billingPurpose, /purpose === "ai_subscription"\) return "billing\.purpose\.historicalAiTransaction"/);
  assert.match(billingPurpose, /billing\.meta\.historicalAiProviderOrder/);
  assert.equal(
    billing.match(/t\(billingPurposeTranslationKey\(tx\.purpose\)\)/g)?.length,
    2,
  );
  assert.equal(billing.match(/<BillingMetadata/g)?.length, 2);
  assert.match(billing, /billingMetadataTranslation\(transaction\)/);
  assert.doesNotMatch(billing, /billing\.meta\.course/);
  assert.equal(en.billing.purpose.historicalAiTransaction, "Historical AI transaction");
  assert.equal(vi.billing.purpose.historicalAiTransaction, "Giao dịch AI lịch sử");
  assert.equal(
    en.billing.meta.historicalAiProviderOrder,
    "Historical AI purchase · Provider: {{provider}} · Order: {{order}}",
  );
  assert.equal(
    vi.billing.meta.historicalAiProviderOrder,
    "Giao dịch AI lịch sử · Nhà cung cấp: {{provider}} · Mã đơn: {{order}}",
  );
});

test("#329 SQL integration assertions are part of the canonical local migration gate", () => {
  assert.match(localMigrationGate, /issue-329-payment-retirement-integration\.sql/);
  assert.match(localMigrationGate, /issue329QueryArgs/);
});

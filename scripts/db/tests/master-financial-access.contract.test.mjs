import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "../../..");
const migration1Path = resolve(
  repoRoot,
  "supabase/migrations/20260825100000_payment_refund_and_access_provenance_schema.sql"
);
const migration2Path = resolve(
  repoRoot,
  "supabase/migrations/20260825110000_atomic_payment_settlement_and_enrollment_rpcs.sql"
);

test("Master Wave Migration 1 contract: payment refunds, transaction statuses, and access provenance", () => {
  const sql = readFileSync(migration1Path, "utf8");

  // Expanded transaction status check
  assert.match(
    sql,
    /CHECK\s*\(\s*status\s+IN\s*\(\s*'pending',\s*'paid',\s*'failed',\s*'cancelled',\s*'refund_requested',\s*'refunded',\s*'partially_refunded'\s*\)\s*\)/i,
    "Must expand payment_transactions status check to include refund states"
  );

  // Payment refunds table
  assert.match(
    sql,
    /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.payment_refunds/i,
    "Must create public.payment_refunds table"
  );
  assert.match(
    sql,
    /payment_transaction_id\s+text\s+NOT\s+NULL\s+REFERENCES\s+public\.payment_transactions\s*\(id\)\s+ON\s+DELETE\s+RESTRICT/i,
    "Must link payment_refunds to payment_transactions with ON DELETE RESTRICT to preserve financial auditability"
  );
  assert.match(
    sql,
    /user_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+auth\.users/i,
    "Must link payment_refunds to auth.users"
  );

  // RLS on payment refunds
  assert.match(
    sql,
    /ALTER\s+TABLE\s+public\.payment_refunds\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
    "Must enable RLS on public.payment_refunds"
  );
  assert.match(
    sql,
    /CREATE\s+POLICY\s+payment_refunds_select_own_or_staff/i,
    "Must create select policy for own refunds or staff"
  );

  // Course payment access provenance
  assert.match(
    sql,
    /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+source\s+text/i,
    "Must add source column to course_payment_access"
  );
  assert.match(
    sql,
    /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+status\s+text/i,
    "Must add status column to course_payment_access"
  );
  assert.match(
    sql,
    /CHECK\s*\(\s*source\s+IN\s*\(\s*'payment',\s*'admin_grant',\s*'voucher',\s*'free_enrollment',\s*'legacy'\s*\)\s*\)/i,
    "Must enforce allowed provenance source values"
  );
  assert.match(
    sql,
    /CHECK\s*\(\s*status\s+IN\s*\(\s*'active',\s*'revoked',\s*'expired'\s*\)\s*\)/i,
    "Must enforce access status values"
  );

  // AI subscription status
  assert.match(
    sql,
    /CHECK\s*\(\s*status\s+IN\s*\(\s*'active',\s*'expired',\s*'cancelled',\s*'superseded',\s*'refunded'\s*\)\s*\)/i,
    "Must include 'refunded' in ai_subscriptions status check"
  );
});

test("Master Wave Migration 2 contract: atomic settlement, refund, enrollment and trigger guards", () => {
  const sql = readFileSync(migration2Path, "utf8");

  // 1. process_successful_payment RPC
  assert.match(
    sql,
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.process_successful_payment/i,
    "Must define process_successful_payment RPC"
  );
  assert.match(
    sql,
    /FOR\s+UPDATE/i,
    "process_successful_payment must acquire row-level lock FOR UPDATE"
  );
  assert.match(
    sql,
    /SECURITY\s+DEFINER/i,
    "Must be SECURITY DEFINER"
  );
  assert.match(
    sql,
    /SET\s+search_path\s*=\s*public,\s*pg_temp/i,
    "Must have safe search_path"
  );

  // 2. process_payment_refund RPC
  assert.match(
    sql,
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.process_payment_refund/i,
    "Must define process_payment_refund RPC"
  );
  assert.match(
    sql,
    /status\s+=\s+'revoked'/i,
    "process_payment_refund must revoke course access"
  );

  // 3. enroll_in_course RPC
  assert.match(
    sql,
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.enroll_in_course/i,
    "Must define enroll_in_course RPC"
  );
  assert.match(
    sql,
    /access_model\s*=\s*'paid_upfront'/i,
    "enroll_in_course must check paid_upfront model"
  );

  // 4. grant_course_access_admin RPC
  assert.match(
    sql,
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.grant_course_access_admin/i,
    "Must define grant_course_access_admin RPC"
  );
  assert.match(
    sql,
    /public\.is_admin_or_support\(\)/i,
    "grant_course_access_admin must check is_admin_or_support()"
  );

  // 5. trg_guard_course_enrollment_access Trigger Guard
  assert.match(
    sql,
    /CREATE\s+TRIGGER\s+trg_guard_course_enrollment_access/i,
    "Must create trigger guard on enrollments table"
  );
  assert.match(
    sql,
    /BEFORE\s+INSERT\s+OR\s+UPDATE\s+ON\s+public\.enrollments/i,
    "Trigger must fire BEFORE INSERT OR UPDATE ON public.enrollments"
  );

  // 6. Security grants / revokes
  assert.match(
    sql,
    /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.process_successful_payment.*FROM\s+anon/i,
    "Must revoke anonymous execute on payment settlement"
  );
  assert.match(
    sql,
    /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.process_payment_refund.*FROM\s+anon/i,
    "Must revoke anonymous execute on payment refund"
  );
});

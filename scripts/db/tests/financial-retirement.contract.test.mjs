import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20260831230000_remove_all_financial_features.sql", import.meta.url),
  "utf8",
);
const appRouter = readFileSync(new URL("../../../src/App.tsx", import.meta.url), "utf8");
const courseTypes = readFileSync(new URL("../../../src/types/courses.ts", import.meta.url), "utf8");
const newCourseForm = readFileSync(
  new URL("../../../src/pages/instructor-course-new/hooks/useInstructorCourseNewForm.ts", import.meta.url),
  "utf8",
);
const certificateHandler = readFileSync(
  new URL("../../../supabase/functions/corelia-api/certificates/handlers.ts", import.meta.url),
  "utf8",
);
const enrollmentBoundary = readFileSync(
  new URL("../../../supabase/migrations/20260831232819_restore_enrollment_rpc_security_boundary.sql", import.meta.url),
  "utf8",
);

test("financial retirement removes every runtime financial table and snapshot", () => {
  for (const table of [
    "payment_refunds",
    "payment_transaction_items",
    "course_payment_access",
    "course_entitlement_grants",
    "payment_transactions",
    "billing_products",
    "course_discounts",
  ]) {
    assert.match(migration, new RegExp(`DROP TABLE IF EXISTS public\\.${table}`));
  }
  for (const column of ["paid_provider", "paid_amount_vnd", "paid_order_id", "paid_at"]) {
    assert.match(migration, new RegExp(`DROP COLUMN IF EXISTS ${column}`));
  }
});

test("financial retirement preserves free enrollment and makes storage cleanup fail closed", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.enroll_in_course/);
  assert.match(migration, /FINANCIAL_RETIREMENT_ABORTED/);
  assert.match(migration, /course-partner-docs/);
  assert.match(migration, /instructor-partner-docs/);
});

test("retired routes and course payloads cannot reintroduce commerce metadata", () => {
  assert.doesNotMatch(appRouter, /checkout|account\/billing|instructor\/(contracts|invoices|payments)/i);
  assert.doesNotMatch(
    `${courseTypes}\n${newCourseForm}`,
    /access_model|price_vnd|promo_price|certificate_fee|revenue_share/i,
  );
});

test("certificate eligibility no longer depends on payment state", () => {
  assert.doesNotMatch(certificateHandler, /payment|certificate_fee_paid|fee_unpaid/i);
});

test("free enrollment keeps privileged code behind an invoker RPC boundary", () => {
  assert.match(enrollmentBoundary, /CREATE OR REPLACE FUNCTION private\.enroll_in_course/);
  assert.match(enrollmentBoundary, /CREATE FUNCTION public\.enroll_in_course[\s\S]*SECURITY INVOKER/);
  assert.doesNotMatch(enrollmentBoundary, /CREATE FUNCTION public\.enroll_in_course[\s\S]*SECURITY DEFINER/);
});

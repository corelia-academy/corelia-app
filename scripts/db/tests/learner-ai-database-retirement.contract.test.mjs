import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260830212012_remove_learner_facing_ai_database.sql",
  "utf8",
);

const retiredTables = [
  "ai_chat_sessions", "ai_conversations", "ai_subscriptions",
  "ai_usage_daily", "ai_usage_monthly", "ai_usage_log", "ai_model_pricing",
  "knowledge_chunks", "user_learning_profile", "learning_observations",
  "ai_voucher_batches", "ai_vouchers", "ai_voucher_redemptions",
  "lesson_summaries", "flashcard_decks", "lesson_readiness_checks", "learning_paths",
];

test("learner AI retirement drops every retired table without CASCADE", () => {
  assert.doesNotMatch(migration, /DROP\s+(?:TABLE|FUNCTION)[^;]*\sCASCADE\b/i);
  for (const table of retiredTables) {
    assert.match(migration, new RegExp(`DROP TABLE public\\.${table};`));
  }
});

test("learner AI retirement removes payment and quota database contracts", () => {
  assert.match(migration, /DELETE FROM public\.payment_transactions WHERE purpose = 'ai_subscription'/);
  assert.match(migration, /CHECK \(purpose IN \('course_purchase', 'certificate_fee'\)\)/);
  for (const column of ["monthly_messages", "haiku_only", "monthly_tokens", "rolling_3h_tokens"]) {
    assert.match(migration, new RegExp(`DROP COLUMN ${column}`));
  }
});

test("shared payment RPCs remain while retired AI RPCs are removed", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.process_unsuccessful_payment_callback/);
  assert.match(migration, /process_successful_payment\(text,jsonb,timestamptz\)/);
  assert.match(migration, /reconcile_historical_ai_payment/);
  const sharedRpc = migration.slice(
    migration.indexOf("CREATE OR REPLACE FUNCTION public.process_unsuccessful_payment_callback"),
    migration.indexOf("-- Remove triggers explicitly"),
  );
  assert.doesNotMatch(sharedRpc, /UPDATE public\.ai_voucher_redemptions/);
});

test("instructor generators remain stateless and independent of retired tables", () => {
  for (const file of [
    "supabase/functions/generate-description/index.ts",
    "supabase/functions/generate-questions/index.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    for (const table of retiredTables) {
      assert.doesNotMatch(source, new RegExp(`(?:from|rpc)\\([\"']${table}[\"']`));
    }
    assert.match(source, /ensureCanManageCourse/);
  }
});

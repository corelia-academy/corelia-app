import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260823121000_ai_quota_semantic_normalization.sql"),
  "utf8",
);
const guards = readFileSync(resolve(process.cwd(), "supabase/functions/ai-tutor/accessGuards.ts"), "utf8");
const handler = readFileSync(resolve(process.cwd(), "supabase/functions/ai-tutor/index.ts"), "utf8");

test("C-08 records only successful provider responses as quota usage", () => {
  assert.match(migration, /usage_kind IN \('successful_message'\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.record_ai_successful_usage/);
  assert.match(migration, /ON CONFLICT \(feature, conversation_id\)[\s\S]*DO NOTHING/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.record_ai_successful_usage[\s\S]*TO service_role/);
});

test("C-08 keeps token telemetry and request-rate controls out of business quota enforcement", () => {
  assert.doesNotMatch(guards, /quota_unit/);
  assert.doesNotMatch(guards, /monthly_tokens/);
  assert.match(guards, /successfulMessagesUsed/);
  assert.match(guards, /rollingAttemptCount/);
});

test("C-08 accounts for success before assistant persistence can make the response retryable", () => {
  const usageIndex = handler.indexOf("await upsertUsage(");
  const assistantUpdateIndex = handler.search(/\.from\("ai_conversations"\)\s*\.update\(\{/);
  assert.ok(usageIndex >= 0, "handler must invoke atomic successful usage accounting");
  assert.ok(assistantUpdateIndex >= 0, "handler must persist the assistant response");
  assert.ok(usageIndex < assistantUpdateIndex, "usage accounting must happen before assistant persistence");
});

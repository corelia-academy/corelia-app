import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260823121000_ai_quota_semantic_normalization.sql"),
  "utf8",
);
test("C-08 historical migration records only successful provider responses as quota usage", () => {
  assert.match(migration, /usage_kind IN \('successful_message'\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.record_ai_successful_usage/);
  assert.match(migration, /ON CONFLICT \(feature, conversation_id\)[\s\S]*DO NOTHING/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.record_ai_successful_usage[\s\S]*TO service_role/);
});

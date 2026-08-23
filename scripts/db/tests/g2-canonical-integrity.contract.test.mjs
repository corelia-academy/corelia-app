import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const g2Migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260823130000_g2_canonical_state_and_data_integrity.sql"),
  "utf8",
);
const g2R1Migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260823140000_g2_r1_remediation.sql"),
  "utf8",
);
const guards = readFileSync(resolve(process.cwd(), "supabase/functions/ai-tutor/accessGuards.ts"), "utf8");
const handler = readFileSync(resolve(process.cwd(), "supabase/functions/ai-tutor/index.ts"), "utf8");
const vouchers = readFileSync(resolve(process.cwd(), "supabase/functions/corelia-api/payments/vouchers.ts"), "utf8");
const payments = readFileSync(resolve(process.cwd(), "src/lib/payments.ts"), "utf8");
const hackathons = readFileSync(resolve(process.cwd(), "src/lib/hackathons.ts"), "utf8");
const usage = readFileSync(resolve(process.cwd(), "supabase/functions/ai-tutor/usageAccounting.ts"), "utf8");

test("G2-A: Streak canonical state derives from user_daily_streaks", () => {
  assert.match(g2Migration, /COMMENT ON COLUMN public\.profiles\.streak_days IS 'DEPRECATED/);
  assert.match(guards, /from\("user_daily_streaks"\)/);
  assert.match(guards, /select\("current_streak"\)/);
  assert.match(guards, /streak_days:\s*Number\(streakRow\?\.current_streak\s*\?\?\s*0\)/);
});

test("G2-B (FV-G2-01): AI entitlement canonicalization enforces ai_subscriptions truth and eliminates profiles.tier fallback", () => {
  assert.match(guards, /from\("ai_subscriptions"\)/);
  assert.match(guards, /if\s*\(data\?\.tier\)\s*return\s*data\.tier;/);
  assert.match(guards, /return\s*"free";/);
  assert.doesNotMatch(guards, /return\s*profileTier\s*\?\?\s*"free";/);
  assert.match(payments, /export function isAiSubscriptionActive/);
  assert.match(payments, /export function resolveEffectiveAiTier/);
  assert.match(payments, /gt\("expires_at",\s*nowIso\)/);
});

test("G2-C: AI session message_count integrity is enforced atomically via database trigger", () => {
  assert.match(g2Migration, /CREATE OR REPLACE FUNCTION public\.sync_ai_chat_session_message_count/);
  assert.match(g2Migration, /CREATE TRIGGER trg_sync_ai_chat_session_message_count/);
  assert.match(g2Migration, /UPDATE public\.ai_chat_sessions AS s/);
  // Verify manual prevCount + 2 is removed from ai-tutor handler
  assert.doesNotMatch(handler, /message_count:\s*prevCount\s*\+\s*2/);
});

test("G2-C (FV-G2-02): Conversation <-> Session composite user_id ownership invariant", () => {
  assert.match(g2R1Migration, /ADD CONSTRAINT ai_chat_sessions_id_user_id_unique UNIQUE \(id, user_id\)/);
  assert.match(g2R1Migration, /FOREIGN KEY \(session_id, user_id\)\s+REFERENCES public\.ai_chat_sessions \(id, user_id\)/);
  assert.match(g2R1Migration, /WITH CHECK \([\s\S]*session_id IS NULL[\s\S]*user_id = auth\.uid\(\)/);
  assert.match(g2R1Migration, /WHERE id = v_new_session_id\s+AND user_id = v_new_user_id/);
});

test("G2-D: Voucher archival columns and foreign key RESTRICT preserve historical redemptions", () => {
  assert.match(g2Migration, /ALTER TABLE public\.ai_voucher_batches[\s\S]*ADD COLUMN IF NOT EXISTS archived_at/);
  assert.match(g2Migration, /FOREIGN KEY \(batch_id\) REFERENCES public\.ai_voucher_batches \(id\) ON DELETE RESTRICT/);
  assert.match(g2Migration, /FOREIGN KEY \(voucher_id\) REFERENCES public\.ai_vouchers \(id\) ON DELETE RESTRICT/);
  assert.match(vouchers, /if\s*\(hasRedemptions\)\s*\{[\s\S]*archived_at:\s*now/);
  assert.match(vouchers, /if\s*\(batch\.archived_at\s*!=\s*null\)/);
});

test("G2-E (FV-G2-03): Hackathon metrics refresh uses atomic JSONB patch RPC to prevent lost updates", () => {
  assert.match(g2R1Migration, /CREATE OR REPLACE FUNCTION public\.patch_hackathon_metrics_snapshot/);
  assert.match(g2R1Migration, /jsonb_set\([\s\S]*'\{metrics_snapshot\}'/);
  assert.match(hackathons, /supabase\.rpc\("patch_hackathon_metrics_snapshot"/);
  assert.doesNotMatch(hackathons, /refreshContestMetricsSnapshot[\s\S]*updateContest\(contestId,\s*\{\s*metrics_snapshot/);
});

test("G2-F: AI model pricing runtime source is TypeScript and ai_model_pricing is marked deprecation candidate", () => {
  assert.match(g2Migration, /COMMENT ON TABLE public\.ai_model_pricing IS 'DEPRECATION_CANDIDATE_PENDING_REVIEW/);
  assert.match(usage, /G2-F: Runtime Model Pricing Source of Truth/);
  assert.match(usage, /export function estimateCostUsd/);
});


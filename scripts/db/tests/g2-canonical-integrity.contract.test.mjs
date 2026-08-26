import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
const hackathons = readFileSync(resolve(process.cwd(), "src/lib/hackathons.ts"), "utf8");

test("G2-A: Historical migration deprecates profiles.streak_days", () => {
  assert.match(g2Migration, /COMMENT ON COLUMN public\.profiles\.streak_days IS 'DEPRECATED/);
});

test("G2-C: AI session message_count integrity is enforced atomically via database trigger", () => {
  assert.match(g2Migration, /CREATE OR REPLACE FUNCTION public\.sync_ai_chat_session_message_count/);
  assert.match(g2Migration, /CREATE TRIGGER trg_sync_ai_chat_session_message_count/);
  assert.match(g2Migration, /UPDATE public\.ai_chat_sessions AS s/);
});

test("G2-C (FV-G2-02): Conversation <-> Session composite user_id ownership invariant", () => {
  assert.match(g2R1Migration, /ADD CONSTRAINT ai_chat_sessions_id_user_id_unique UNIQUE \(id, user_id\)/);
  assert.match(g2R1Migration, /FOREIGN KEY \(session_id, user_id\)\s+REFERENCES public\.ai_chat_sessions \(id, user_id\)/);
  assert.match(g2R1Migration, /WITH CHECK \([\s\S]*session_id IS NULL[\s\S]*user_id = auth\.uid\(\)/);
  assert.match(g2R1Migration, /WHERE id = v_new_session_id\s+AND user_id = v_new_user_id/);
});

test("G2-D: Migration-level voucher archival and RESTRICT constraints preserve historical redemptions", () => {
  assert.match(g2Migration, /ALTER TABLE public\.ai_voucher_batches[\s\S]*ADD COLUMN IF NOT EXISTS archived_at/);
  assert.match(g2Migration, /FOREIGN KEY \(batch_id\) REFERENCES public\.ai_voucher_batches \(id\) ON DELETE RESTRICT/);
  assert.match(g2Migration, /FOREIGN KEY \(voucher_id\) REFERENCES public\.ai_vouchers \(id\) ON DELETE RESTRICT/);
  assert.equal(
    existsSync(resolve(process.cwd(), "supabase/functions/corelia-api/payments/vouchers.ts")),
    false,
    "retired AI voucher mutation implementation must not remain in runtime source",
  );
});

test("G2-E (FV-G2-03): Hackathon metrics refresh uses atomic JSONB patch RPC to prevent lost updates", () => {
  assert.match(g2R1Migration, /CREATE OR REPLACE FUNCTION public\.patch_hackathon_metrics_snapshot/);
  assert.match(g2R1Migration, /jsonb_set\([\s\S]*'\{metrics_snapshot\}'/);
  assert.match(hackathons, /supabase\.rpc\("patch_hackathon_metrics_snapshot"/);
  assert.doesNotMatch(hackathons, /refreshContestMetricsSnapshot[\s\S]*updateContest\(contestId,\s*\{\s*metrics_snapshot/);
});

test("G2-F: Historical migration marks ai_model_pricing as a deprecation candidate", () => {
  assert.match(g2Migration, /COMMENT ON TABLE public\.ai_model_pricing IS 'DEPRECATION_CANDIDATE_PENDING_REVIEW/);
});


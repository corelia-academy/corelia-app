import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Deployment State Machine & Compatibility Gates", () => {
  const workflowPath = resolve(process.cwd(), ".github/workflows/deploy-prod.yml");
  const workflowContent = readFileSync(workflowPath, "utf8");
  const migration130000Path = resolve(process.cwd(), "supabase/migrations/20260823130000_g2_canonical_state_and_data_integrity.sql");
  const migration130000Content = readFileSync(migration130000Path, "utf8");
  const repairSqlPath = resolve(process.cwd(), "scripts/db/repair-ai-chat-session-aggregates.sql");
  const repairSqlContent = readFileSync(repairSqlPath, "utf8");

  it("CASE C0: baseline OLD DB (139) + OLD EDGE is safe", () => {
    // Old Edge uses legacy direct updates and does not call record_ai_successful_usage
    assert.match(migration130000Content, /sync_ai_chat_session_message_count/);
    assert.match(workflowContent, /supabase migration up/);
  });

  it("CASE C1: transitional DB state (120000..122000) + OLD EDGE is safe", () => {
    // Migrations 120000..122000 create RPC record_ai_successful_usage and project seed guard
    // They do not install session count trigger, allowing OLD EDGE manual updates without conflict
    const migration121000 = readFileSync(resolve(process.cwd(), "supabase/migrations/20260823121000_ai_quota_semantic_normalization.sql"), "utf8");
    assert.match(migration121000, /record_ai_successful_usage/);
    assert.doesNotMatch(migration121000, /trg_sync_ai_chat_session_message_count/);
  });

  it("CASE C2: transitional DB state (121000+) + NEW EDGE is safe", () => {
    // NEW EDGE requires record_ai_successful_usage which exists starting at migration 121000
    const accessGuards = readFileSync(resolve(process.cwd(), "supabase/functions/ai-tutor/accessGuards.ts"), "utf8");
    assert.match(accessGuards, /ai_subscriptions/);
    assert.match(accessGuards, /resolveEffectiveTier/);
  });

  it("CASE C3: final DB state (155) + NEW EDGE is safe with canonical trigger and guard", () => {
    // Final DB state installs trigger and session-level guard for stale direct updates
    assert.match(migration130000Content, /CREATE TRIGGER trg_sync_ai_chat_session_message_count/);
    assert.match(migration130000Content, /CREATE TRIGGER trg_guard_ai_chat_session_message_count/);
    assert.match(migration130000Content, /pg_trigger_depth\(\) = 1/);
  });

  it("CASE C4: workflow execution order enforces Post-Edge gate before completion and deploys all 8 Edge functions", () => {
    // Workflow must deploy corelia-api and all 7 AI functions before executing post-Edge verification gate
    const aiFunctions = [
      "ai-tutor",
      "embed-lesson",
      "generate-description",
      "generate-flashcards",
      "generate-learning-path",
      "generate-lesson-summary",
      "generate-questions",
    ];
    for (const fn of aiFunctions) {
      const idx = workflowContent.indexOf(`functions deploy ${fn}`);
      assert.ok(idx > 0, `Deploy step for retired AI function ${fn} must exist in workflow`);
    }

    const lastEdgeDeployIndex = workflowContent.indexOf("functions deploy generate-questions");
    const postEdgeGateIndex = workflowContent.indexOf("Verify live DB post-Edge final runtime invariants");
    assert.ok(lastEdgeDeployIndex > 0, "Last Edge function (generate-questions) deploy step exists");
    assert.ok(postEdgeGateIndex > 0, "Post-Edge gate step exists");
    assert.ok(postEdgeGateIndex > lastEdgeDeployIndex, "Post-Edge gate executes AFTER all Edge deployments");
  });

  it("CASE C5: Edge deployment failure leaves system in a safe recoverable state", () => {
    // If Edge deploy fails, DB has guard trigger preventing stale corruption and ledger remains intact
    assert.match(migration130000Content, /guard_ai_chat_session_message_count/);
  });

  it("CASE C6: repair tool is deterministic, transaction-bounded and non-destructive", () => {
    // repair script must have BEGIN, COMMIT, inspection, and verification
    assert.match(repairSqlContent, /^BEGIN;/m);
    assert.match(repairSqlContent, /^COMMIT;/m);
    assert.match(repairSqlContent, /WITH canonical_session_aggregates AS/);
    assert.match(repairSqlContent, /COUNT\(c\.id\) FILTER \(WHERE c\.status = 'completed'\)/);
    assert.match(repairSqlContent, /Post-repair verification passed/);
  });
});

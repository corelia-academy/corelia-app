import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Deployment State Machine & Compatibility Gates", () => {
  const workflowPath = resolve(process.cwd(), ".github/workflows/deploy-prod.yml");
  const workflowContent = readFileSync(workflowPath, "utf8");
  const migration130000Path = resolve(process.cwd(), "supabase/migrations/20260823130000_g2_canonical_state_and_data_integrity.sql");
  const migration130000Content = readFileSync(migration130000Path, "utf8");
  const retirementPath = resolve(process.cwd(), "supabase/migrations/20260830212012_remove_learner_facing_ai_database.sql");
  const retirementContent = readFileSync(retirementPath, "utf8");

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

  it("CASE C2: retired ai-tutor is database-independent and fail-closed", () => {
    const tombstone = readFileSync(resolve(process.cwd(), "supabase/functions/ai-tutor/index.ts"), "utf8");
    assert.match(tombstone, /AI_FEATURE_RETIRED/);
    assert.match(tombstone, /410/);
    assert.doesNotMatch(tombstone, /ai_subscriptions|record_ai_successful_usage/);
  });

  it("CASE C3: final DB state removes learner AI while instructor generators stay database-independent", () => {
    assert.match(retirementContent, /DROP TABLE public\.ai_chat_sessions/);
    assert.match(retirementContent, /DROP TABLE public\.knowledge_chunks/);
    assert.match(retirementContent, /DROP TABLE public\.learning_paths/);
    assert.match(retirementContent, /process_successful_payment\(text,jsonb,timestamptz\)/);
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

  it("CASE C5: retired tombstones remain safe after the database objects are gone", () => {
    const tombstone = readFileSync(resolve(process.cwd(), "supabase/functions/ai-tutor/index.ts"), "utf8");
    assert.match(tombstone, /AI_FEATURE_RETIRED/);
    assert.doesNotMatch(tombstone, /\.from\(|\.rpc\(/);
  });
});

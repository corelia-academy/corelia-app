import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Learner AI Edge retirement rollout gates", () => {
  const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/deploy-prod.yml"), "utf8");
  const cleanup = readFileSync(resolve(process.cwd(), "scripts/retire-learner-ai-edge.sh"), "utf8");
  const retired = [
    "ai-tutor",
    "embed-lesson",
    "generate-flashcards",
    "generate-learning-path",
    "generate-lesson-summary",
  ];

  it("keeps only instructor AI sources deployable", () => {
    for (const name of retired) {
      assert.equal(existsSync(resolve(process.cwd(), "supabase/functions", name, "index.ts")), false);
    }
    assert.equal(existsSync(resolve(process.cwd(), "supabase/functions/generate-description/index.ts")), true);
    assert.equal(existsSync(resolve(process.cwd(), "supabase/functions/generate-questions/index.ts")), true);
  });

  it("deploys retained functions before idempotent remote cleanup", () => {
    const cleanupIndex = workflow.indexOf("scripts/retire-learner-ai-edge.sh");
    assert.ok(cleanupIndex > workflow.indexOf("functions deploy generate-description"));
    assert.ok(cleanupIndex > workflow.indexOf("functions deploy generate-questions"));
    for (const name of retired) {
      assert.doesNotMatch(workflow, new RegExp(`functions deploy ${name}\\b`));
      assert.match(cleanup, new RegExp(`\\b${name}\\b`));
    }
    assert.match(cleanup, /supabase functions delete/);
    assert.match(cleanup, /supabase secrets unset/);
  });

  it("runs the post-Edge database gate after remote cleanup", () => {
    assert.ok(workflow.indexOf("Verify live DB post-Edge final runtime invariants") >
      workflow.indexOf("scripts/retire-learner-ai-edge.sh"));
  });

  it("drops vector without CASCADE", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20260830230917_drop_unused_vector_extension.sql"),
      "utf8",
    );
    assert.match(migration, /DROP EXTENSION IF EXISTS vector;/);
    assert.doesNotMatch(migration, /CASCADE\s*;/i);
  });
});

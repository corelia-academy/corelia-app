import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

test("Jobs release wiring deploys both Edge Functions and fails closed on a missing scheduler secret", () => {
  for (const [path, projectRef] of [
    [".github/workflows/deploy-staging.yml", "opoozbmfbezkrpzxsusx"],
    [".github/workflows/deploy-prod.yml", "lawhkvyyoznwygzsycan"],
  ]) {
    const workflow = read(path);
    assert.match(workflow, new RegExp(`test \\\"\\$SUPABASE_PROJECT_REF\\\" = \\\"${projectRef}\\\"`));
    assert.match(workflow, /supabase secrets list[^\n]+--output json/);
    assert.match(workflow, /index\("CORELIA_JOBS_CRON_SECRET"\) != null/);
    assert.match(workflow, /supabase functions deploy corelia-api\b/);
    assert.match(workflow, /supabase functions deploy cron-jobs\b/);
    assert.ok(
      workflow.lastIndexOf("supabase functions deploy cron-jobs") > workflow.indexOf("supabase migration"),
      `${path} must deploy cron-jobs after its migration step`,
    );
  }
});

test("Jobs scheduler keeps JWT verification off only because both hops enforce the custom secret", () => {
  const config = read("supabase/config.toml");
  const cron = read("supabase/functions/cron-jobs/index.ts");
  const api = read("supabase/functions/corelia-api/index.ts");
  const handlers = read("supabase/functions/corelia-api/jobs/handlers.ts");

  assert.match(config, /\[functions\.cron-jobs\][\s\S]*?verify_jwt = false/);
  assert.match(cron, /CORELIA_JOBS_CRON_SECRET/);
  assert.match(cron, /x-corelia-jobs-cron-secret/);
  assert.match(api, /op === "jobs\.runScheduled" && hasJobsCronSecret\(req\)/);
  assert.match(handlers, /provided !== expected/);
});

test("Jobs migration is an approved forward migration", async () => {
  const release = await import("../production-release-migrations.mjs");
  assert.equal(
    release.CURRENT_PENDING_VERSIONS.at(-1),
    "20260903033132",
  );
  assert.equal(
    release.EXPECTED_POST_MIGRATION_LATEST,
    "20260903033132",
  );
});

test("Jobs crawl failures remain operational failures instead of quality rejections", () => {
  const pipeline = read("supabase/functions/corelia-api/jobs/pipeline.ts");
  const handlers = read("supabase/functions/corelia-api/jobs/handlers.ts");

  assert.match(pipeline, /counters\.failed_count \+= 1/);
  assert.match(pipeline, /status: partial \? "partial" : "succeeded"/);
  assert.match(pipeline, /writeCoverage\(db, source, company, !partial/);
  assert.match(handlers, /ok: !result\.partial/);
});

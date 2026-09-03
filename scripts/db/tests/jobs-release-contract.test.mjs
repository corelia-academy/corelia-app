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
    "20260903103822",
  );
  assert.equal(
    release.EXPECTED_POST_MIGRATION_LATEST,
    "20260903103822",
  );
});

test("CryptoJobsList uses its documented API contract and stays disabled until access review", () => {
  const migration = read("supabase/migrations/20260903100928_add_cryptojobslist_adapter_contract.sql");
  const adapter = read("supabase/functions/corelia-api/jobs/adapters.ts");
  const pipeline = read("supabase/functions/corelia-api/jobs/pipeline.ts");

  assert.match(migration, /https:\/\/api\.cryptojobslist\.com\/public\/jobs/);
  assert.match(migration, /canonicalURL/);
  assert.match(migration, /policy_reviewed_at = NULL/);
  assert.match(migration, /enabled = false/);
  assert.match(adapter, /missing_secret:CRYPTOJOBS_LIST_API_KEY/);
  assert.match(adapter, /"x-api-key": apiKey/);
  assert.match(adapter, /source_type === "cryptojobslist"/);
  assert.match(pipeline, /Deno\.env\.get\("CRYPTOJOBS_LIST_API_KEY"\)/);
});

test("Jobs revalidation and operational alerts are independently observable", () => {
  const migration = read("supabase/migrations/20260903094501_jobs_operational_alerts.sql");
  const pipeline = read("supabase/functions/corelia-api/jobs/pipeline.ts");
  const handlers = read("supabase/functions/corelia-api/jobs/handlers.ts");

  assert.match(migration, /CREATE TABLE public\.job_operational_alerts/);
  assert.match(migration, /ADD COLUMN last_revalidated_at/);
  assert.match(migration, /job_operational_alerts_open_identity_unique/);
  assert.match(pipeline, /export async function revalidateCompany/);
  assert.match(handlers, /mode === "revalidation"/);
  assert.match(handlers, /action === "alerts\.list"/);
  assert.match(handlers, /action === "alerts\.resolve"/);
});

test("Jobs records AI fallback attempts separately from ingestion failures", () => {
  const migration = read("supabase/migrations/20260903103822_add_jobs_ai_failure_observability.sql");
  const pipeline = read("supabase/functions/corelia-api/jobs/pipeline.ts");
  const operations = read("supabase/functions/corelia-api/jobs/operations.ts");

  assert.match(migration, /ADD COLUMN ai_failed_count integer NOT NULL DEFAULT 0/);
  assert.match(pipeline, /classification\.model === "deterministic"[\s\S]*?counters\.ai_failed_count \+= 1/);
  assert.match(operations, /classificationFailedCount \/ context\.fetchedCount >= 0\.25/);
});

test("generic RSS uses provider-specific source policy instances", () => {
  const migration = read("supabase/migrations/20260903091501_jobs_source_instances_and_operations.sql");
  const handlers = read("supabase/functions/corelia-api/jobs/handlers.ts");

  assert.match(migration, /ADD COLUMN source_id uuid REFERENCES public\.job_sources/);
  assert.match(migration, /DROP INDEX IF EXISTS public\.job_sources_source_type_unique/);
  assert.match(migration, /job_companies \(source_id, lower\(source_identifier\), source_region\)/);
  assert.match(handlers, /action === "sources\.save"/);
  assert.match(handlers, /source_type: "rss"/);
  assert.match(handlers, /feed_urls: feedUrls/);
});

test("structured API and RSS feeds stay policy-gated until rollout", () => {
  const migration = read("supabase/migrations/20260903090353_add_structured_job_feed_adapters.sql");
  const adapter = read("supabase/functions/corelia-api/jobs/adapters.ts");

  for (const source of ["himalayas", "weworkremotely", "remotive", "remoteok"]) {
    assert.match(migration, new RegExp(`'${source}'`));
  }
  assert.match(migration, /'Himalayas'[\s\S]*?false, true/);
  assert.match(migration, /'We Work Remotely'[\s\S]*?false, true/);
  assert.match(migration, /'Remotive'[\s\S]*?false, true/);
  assert.match(migration, /'Remote OK'[\s\S]*?false, true/);
  assert.match(migration, /'CryptoJobsList'[\s\S]*?null/);
  assert.match(adapter, /source_missing_feed_url/);
  assert.match(adapter, /sourceHasCompleteSnapshot/);
});

test("web3.career source is token-gated and preserves provider apply URLs", () => {
  const migration = read("supabase/migrations/20260903084000_add_web3career_jobs_source.sql");
  const adapter = read("supabase/functions/corelia-api/jobs/adapters.ts");
  const pipeline = read("supabase/functions/corelia-api/jobs/pipeline.ts");

  assert.match(migration, /'web3career'/);
  assert.match(migration, /Jobs sourced from web3\.career/);
  assert.match(migration, /false,[\s\S]*true,[\s\S]*'Jobs sourced from web3\.career'/);
  assert.match(adapter, /missing_secret:WEB3_CAREER_API_TOKEN/);
  assert.match(adapter, /preserveApplyUrl: true/);
  assert.match(pipeline, /validateExternalUrl\(job\.applyUrl \|\| job\.sourceUrl\)/);
});

test("Jobs Social backfill preserves engineering titles and staff overrides", () => {
  const migration = read("supabase/migrations/20260903081100_repair_social_engineering_job_type.sql");

  assert.match(migration, /primary_role = 'general-software-engineering'/);
  assert.match(migration, /title ~\* '[^']*engineer/);
  assert.match(migration, /NOT \(manual_overrides \?\| ARRAY\['job_type', 'primary_role', 'roles'\]\)/);
});

test("Jobs type migration adds the public contract and non-tech role taxonomy", () => {
  const migration = read("supabase/migrations/20260903071137_add_job_type_and_non_tech_roles.sql");

  assert.match(migration, /ADD COLUMN job_type text NOT NULL DEFAULT 'tech'/);
  assert.match(migration, /CHECK \(job_type IN \('tech', 'non_tech'\)\)/);
  assert.match(migration, /\('social-media', 'Social Media'/);
  assert.match(migration, /GRANT SELECT \(job_type\) ON public\.jobs TO anon, authenticated/);
  assert.match(migration, /NEW\.job_type/);
});

test("Jobs classifier scale repair normalizes historical ratios without overriding staff decisions", () => {
  const migration = read("supabase/migrations/20260903062207_normalize_job_ai_quality_score.sql");
  const classifier = read("supabase/functions/corelia-api/jobs/classify.ts");

  assert.match(migration, /quality_score > 0[\s\S]*quality_score <= 1/);
  assert.match(migration, /NOT \(manual_overrides \? 'status'\)/);
  assert.match(migration, /processing_status = 'processed'/);
  assert.match(classifier, /CLASSIFIER_VERSION = "jobs-ai-3"/);
  assert.match(classifier, /score > 0 && score <= 1 \? score \* 100 : score/);
});

test("Jobs scheduler permits only the exact non-relocatable pg_net advisor warning", () => {
  for (const workflowPath of [
    ".github/workflows/deploy-staging.yml",
    ".github/workflows/deploy-prod.yml",
  ]) {
    const workflow = read(workflowPath);
    assert.match(workflow, /\.name == "extension_in_public"/);
    assert.match(workflow, /\.metadata\.name == "pg_net"/);
    assert.match(workflow, /\.metadata\.schema == "public"/);
  }
});

test("Jobs advisor remediation covers foreign keys and avoids overlapping read policies", () => {
  const migration = read("supabase/migrations/20260903055155_jobs_advisor_remediation.sql");

  for (const index of [
    "crawler_runs_company_id_idx",
    "crawler_runs_created_by_idx",
    "crawler_runs_source_id_idx",
    "job_events_source_id_idx",
  ]) {
    assert.match(migration, new RegExp(`CREATE INDEX ${index}\\b`));
  }
  for (const policy of [
    "job_sources_read",
    "job_companies_read",
    "job_roles_read",
    "job_domains_read",
    "job_skills_read",
    "jobs_read",
    "job_source_links_read",
  ]) {
    assert.match(migration, new RegExp(`CREATE POLICY ${policy}\\b[^;]+FOR SELECT`, "s"));
  }
  assert.doesNotMatch(migration, /CREATE POLICY \w+_staff_manage[^;]+FOR ALL/);
});

test("Jobs crawl failures remain operational failures instead of quality rejections", () => {
  const pipeline = read("supabase/functions/corelia-api/jobs/pipeline.ts");
  const handlers = read("supabase/functions/corelia-api/jobs/handlers.ts");

  assert.match(pipeline, /counters\.failed_count \+= 1/);
  assert.match(pipeline, /status: partial \? "partial" : "succeeded"/);
  assert.match(pipeline, /writeCoverage\(db, source, company, !partial/);
  assert.match(handlers, /ok: !result\.partial/);
});

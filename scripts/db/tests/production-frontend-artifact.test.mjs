import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  PRODUCTION_SUPABASE_URL,
  STAGING_PROJECT_REF,
  verifyProductionFrontendArtifact,
} from "../verify-production-frontend-artifact.mjs";

const PRODUCTION_CDN_URL = "https://cdn.corelia.academy";
const APP_VERSION = "0.8.0";
const WORKFLOW_PATH = fileURLToPath(new URL("../../../.github/workflows/deploy-prod.yml", import.meta.url));

async function createArtifact(scriptContents) {
  const root = await mkdtemp(path.join(os.tmpdir(), "corelia-production-frontend-"));
  await mkdir(path.join(root, "assets"));
  await writeFile(path.join(root, "index.html"), '<script type="module" src="/assets/app.js"></script>');
  await writeFile(path.join(root, "assets", "app.js"), scriptContents);
  return root;
}

function validBundle(extra = "") {
  return [
    `window.__CORELIA_BUILD__={version:${JSON.stringify(APP_VERSION)}};`,
    `const supabaseUrl=${JSON.stringify(PRODUCTION_SUPABASE_URL)};`,
    `const cdnUrl=${JSON.stringify(PRODUCTION_CDN_URL)};`,
    extra,
  ].join("\n");
}

async function verify(root, overrides = {}) {
  return verifyProductionFrontendArtifact({
    distDir: root,
    expectedSupabaseUrl: PRODUCTION_SUPABASE_URL,
    expectedCdnUrl: PRODUCTION_CDN_URL,
    expectedAppVersion: APP_VERSION,
    ...overrides,
  });
}

test("exact Production artifact passes and produces a deterministic SHA-256", async (t) => {
  const root = await createArtifact(validBundle());
  t.after(() => rm(root, { recursive: true, force: true }));

  const first = await verify(root);
  const second = await verify(root);

  assert.equal(first.status, "PRODUCTION_FRONTEND_ARTIFACT_VERIFIED");
  assert.match(first.artifactSha256, /^[a-f0-9]{64}$/);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.equal(first.supabaseProjectRef, "lawhkvyyoznwygzsycan");
  assert.equal(first.appVersion, APP_VERSION);
});

test("fails when the exact Production Supabase target is absent", async (t) => {
  const root = await createArtifact(validBundle().replace(PRODUCTION_SUPABASE_URL, "https://example.supabase.co"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(() => verify(root), /exact Production Supabase target/);
});

test("fails when the Staging project ref appears anywhere in the artifact", async (t) => {
  const root = await createArtifact(validBundle(`const forbidden=${JSON.stringify(STAGING_PROJECT_REF)};`));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(() => verify(root), /Staging Supabase project ref/);
});

test("fails when configured Supabase URL is not the canonical Production URL", async (t) => {
  const root = await createArtifact(validBundle());
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(
    () => verify(root, { expectedSupabaseUrl: "https://opoozbmfbezkrpzxsusx.supabase.co" }),
    /must target lawhkvyyoznwygzsycan/,
  );
});

test("fails when configured CDN URL is not an approved Production target", async (t) => {
  const root = await createArtifact(validBundle());
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(
    () => verify(root, { expectedCdnUrl: "https://staging-cdn.example.com" }),
    /not an approved Corelia Production CDN target/,
  );
});

test("fails when artifact does not contain configured Production CDN", async (t) => {
  const root = await createArtifact(validBundle().replace(PRODUCTION_CDN_URL, "https://assets.example.com"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(() => verify(root), /expected Production CDN target/);
});

test("fails when app version or build marker is absent", async (t) => {
  const root = await createArtifact(validBundle().replace("__CORELIA_BUILD__", "OTHER_BUILD"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(() => verify(root), /app version and Corelia build marker/);
});

test("fails when artifact app version does not match package version", async (t) => {
  const root = await createArtifact(validBundle());
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(
    () => verify(root, { expectedAppVersion: "0.8.1" }),
    /app version and Corelia build marker/,
  );
});

test("fails closed for an empty artifact", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "corelia-production-frontend-empty-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(() => verify(root), /artifact directory is empty/);
});

test("artifact SHA-256 changes when artifact content changes", async (t) => {
  const firstRoot = await createArtifact(validBundle("const revision='one';"));
  const secondRoot = await createArtifact(validBundle("const revision='two';"));
  t.after(() => Promise.all([
    rm(firstRoot, { recursive: true, force: true }),
    rm(secondRoot, { recursive: true, force: true }),
  ]));

  const first = await verify(firstRoot);
  const second = await verify(secondRoot);
  assert.notEqual(first.artifactSha256, second.artifactSha256);
});

test("Production workflow uses the technical frontend gate and preserves deployment safety", async () => {
  const workflow = await readFile(WORKFLOW_PATH, "utf8");

  assert.match(workflow, /^on:\s*\r?\n\s+workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s+push:/m);
  assert.doesNotMatch(workflow, /frontend_env_verified/i);
  const productionEnvironments = [...workflow.matchAll(/environment:\s*\r?\n\s+name: production/g)];
  assert.equal(productionEnvironments.length, 2);
  assert.match(workflow, /VITE_SUPABASE_URL: https:\/\/\$\{\{ secrets\.SUPABASE_PROJECT_REF \}\}\.supabase\.co/);
  assert.match(workflow, /VITE_SUPABASE_PUBLISHABLE_KEY: \$\{\{ secrets\.VITE_SUPABASE_PUBLISHABLE_KEY \}\}/);
  assert.match(workflow, /VITE_CDN_BASE_URL: \$\{\{ vars\.VITE_CDN_BASE_URL \}\}/);
  assert.match(workflow, /pnpm build:prod[\s\S]*verify-production-frontend-artifact\.mjs/);
  assert.doesNotMatch(workflow, /migration repair|--include-all/);

  assert.doesNotMatch(workflow, /APPROVED_PRODUCTION_RELEASE_SHA|APPROVED_RELEASE_SHA/);
  assert.doesNotMatch(workflow, /inputs\.release_sha|ref: \$\{\{ inputs\.release_sha \}\}/);

  const migrationIndex = workflow.indexOf("Verify exact Production migration state and apply approved migrations");
  const postGateIndex = workflow.indexOf("Verify live DB post-migration state and data invariants");
  const coreliaApiIndex = workflow.indexOf("Deploy Edge Function (corelia-api)");
  const cleanupIndex = workflow.indexOf("scripts/retire-learner-ai-edge.sh");
  assert.ok(coreliaApiIndex >= 0 && coreliaApiIndex < migrationIndex && migrationIndex < postGateIndex && postGateIndex < cleanupIndex);

  const deployedFunctions = [...workflow.matchAll(/supabase functions deploy ([a-z0-9-]+)/g)]
    .map((match) => match[1]);
  assert.deepEqual(deployedFunctions, [
    "corelia-api",
    "cron-jobs",
    "generate-description",
    "generate-questions",
  ]);
});

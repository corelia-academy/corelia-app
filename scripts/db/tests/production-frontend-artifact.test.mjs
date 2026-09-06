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
const WRANGLER_PATH = fileURLToPath(new URL("../../../wrangler.jsonc", import.meta.url));

const REQUIRED_HEADERS = `/
  Cache-Control: no-cache

/index.html
  Cache-Control: no-cache

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;

async function createArtifact(scriptContents) {
  const root = await mkdtemp(path.join(os.tmpdir(), "corelia-production-frontend-"));
  await mkdir(path.join(root, "assets"));
  await writeFile(path.join(root, "index.html"), '<script type="module" src="/assets/app.js"></script>');
  await writeFile(path.join(root, "_headers"), REQUIRED_HEADERS);
  await writeFile(path.join(root, "assets", "app.js"), scriptContents);
  return root;
}

function validBundle(extra = "") {
  return [
    `window.__CORELIA_BUILD__={version:${JSON.stringify(APP_VERSION)}};`,
    `const supabaseUrl=${JSON.stringify(PRODUCTION_SUPABASE_URL)};`,
    `const cdnUrl=${JSON.stringify(PRODUCTION_CDN_URL)};`,
    `window.addEventListener("vite:preloadError",()=>{});`,
    `const staleChunkGuard="corelia:stale-chunk-reload-at";`,
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

test("fails when stale chunk recovery is absent", async (t) => {
  const root = await createArtifact(
    validBundle()
      .replace("vite:preloadError", "other:event")
      .replace("corelia:stale-chunk-reload-at", "other-key"),
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(() => verify(root), /stale chunk recovery handler and reload guard/);
});

test("fails when _headers is missing or has unsafe cache policies", async (t) => {
  const missingHeadersRoot = await createArtifact(validBundle());
  const unsafeHeadersRoot = await createArtifact(validBundle());
  t.after(() => Promise.all([
    rm(missingHeadersRoot, { recursive: true, force: true }),
    rm(unsafeHeadersRoot, { recursive: true, force: true }),
  ]));

  await rm(path.join(missingHeadersRoot, "_headers"));
  await writeFile(path.join(unsafeHeadersRoot, "_headers"), "/\n  Cache-Control: max-age=86400\n");

  await assert.rejects(() => verify(missingHeadersRoot), /artifact is missing _headers/);
  await assert.rejects(() => verify(unsafeHeadersRoot), /required HTML and hashed-asset cache policies/);
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
  assert.match(workflow, /verify-production-frontend-artifact\.mjs dist\/client/);
  assert.doesNotMatch(workflow, /migration repair|--include-all/);

  assert.doesNotMatch(workflow, /APPROVED_PRODUCTION_RELEASE_SHA|APPROVED_RELEASE_SHA/);
  assert.doesNotMatch(workflow, /inputs\.release_sha|ref: \$\{\{ inputs\.release_sha \}\}/);

  const preflightIndex = workflow.indexOf("Verify exact Production migration state before deployment");
  const migrationIndex = workflow.indexOf("Re-verify exact Production migration state and apply approved migrations");
  const postGateIndex = workflow.indexOf("Verify live DB post-migration state and data invariants");
  const coreliaApiIndex = workflow.indexOf("Deploy Edge Function (corelia-api)");
  const storageCleanupIndex = workflow.indexOf("Purge retired financial Storage objects");
  const cleanupIndex = workflow.indexOf("scripts/retire-learner-ai-edge.sh");
  assert.ok(
    preflightIndex >= 0 &&
      preflightIndex < coreliaApiIndex &&
      coreliaApiIndex < storageCleanupIndex &&
      storageCleanupIndex < migrationIndex &&
      migrationIndex < postGateIndex &&
      postGateIndex < cleanupIndex,
  );
  assert.equal(
    workflow.slice(0, coreliaApiIndex).match(/verify-production-migration-state\.mjs/g)?.length,
    1,
    "Production must verify exact migration state before its first mutation",
  );

  const deployedFunctions = [...workflow.matchAll(/supabase functions deploy ([a-z0-9-]+)/g)]
    .map((match) => match[1]);
  assert.deepEqual(deployedFunctions, [
    "corelia-api",
    "cron-jobs",
    "generate-description",
    "generate-questions",
  ]);
});

test("Wrangler keeps SPA routing and sends missing assets through the Worker guard", async () => {
  const config = JSON.parse(await readFile(WRANGLER_PATH, "utf8"));

  assert.equal(config.main, "./worker/index.ts");
  assert.equal(config.assets?.binding, "ASSETS");
  assert.equal(config.assets?.not_found_handling, "single-page-application");
  assert.notEqual(config.assets?.run_worker_first, true);
});

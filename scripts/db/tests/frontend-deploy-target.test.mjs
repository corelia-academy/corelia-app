import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { prepareWorkerTarget } from "../../deploy/worker-target.mjs";
import { verifyFrontendTarget } from "../../deploy/verify-frontend-target.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "corelia-frontend-target-"));
  mkdirSync(join(root, "corelia_app"));
  mkdirSync(join(root, "client/assets"), { recursive: true });
  const configPath = join(root, "corelia_app/wrangler.json");
  const entryPath = join(root, "client/assets/index-abc123.js");
  writeFileSync(configPath, JSON.stringify({ name: "corelia-app", assets: { directory: "../client" } }));
  writeFileSync(join(root, "client/index.html"), '<script type="module" src="/assets/index-abc123.js"></script>');
  writeFileSync(entryPath, '"https://opoozbmfbezkrpzxsusx.supabase.co" "https://cdn-staging.corelia.academy" "sb_publishable_test"');
  return { root, configPath, entryPath };
}

test("Staging build pins the generated Worker and Supabase target", async (t) => {
  const f = fixture();
  t.after(() => rmSync(f.root, { recursive: true, force: true }));
  await prepareWorkerTarget("staging", f.configPath);
  assert.equal(JSON.parse(readFileSync(f.configPath, "utf8")).name, "corelia-staging");
  assert.equal(JSON.parse(readFileSync(f.configPath, "utf8")).vars.CORELIA_API_URL,
    "https://opoozbmfbezkrpzxsusx.supabase.co/functions/v1/corelia-api");
  assert.equal(JSON.parse(readFileSync(f.configPath, "utf8")).vars.CORELIA_OG_FUNCTION_URL,
    "https://opoozbmfbezkrpzxsusx.supabase.co/functions/v1/corelia-api");
  assert.equal(JSON.parse(readFileSync(f.configPath, "utf8")).vars.CORELIA_APP_ORIGIN,
    "https://staging.corelia.academy");
  assert.equal((await verifyFrontendTarget("staging", f.root)).assetPath, "/assets/index-abc123.js");
});

test("Staging deployment rejects a Production Worker or Supabase bundle", async (t) => {
  const f = fixture();
  t.after(() => rmSync(f.root, { recursive: true, force: true }));
  await assert.rejects(verifyFrontendTarget("staging", f.root), /Worker configuration/);
  await prepareWorkerTarget("staging", f.configPath);
  const wrongConfig = JSON.parse(readFileSync(f.configPath, "utf8"));
  wrongConfig.vars.CORELIA_API_URL = "https://lawhkvyyoznwygzsycan.supabase.co/functions/v1/corelia-api";
  writeFileSync(f.configPath, JSON.stringify(wrongConfig));
  await assert.rejects(verifyFrontendTarget("staging", f.root), /Worker avatar API/);
  await prepareWorkerTarget("staging", f.configPath);
  wrongConfig.vars.CORELIA_API_URL = "https://opoozbmfbezkrpzxsusx.supabase.co/functions/v1/corelia-api";
  wrongConfig.vars.CORELIA_OG_FUNCTION_URL = "https://lawhkvyyoznwygzsycan.supabase.co/functions/v1/corelia-api";
  writeFileSync(f.configPath, JSON.stringify(wrongConfig));
  await assert.rejects(verifyFrontendTarget("staging", f.root), /Worker OG configuration/);
  await prepareWorkerTarget("staging", f.configPath);
  writeFileSync(f.entryPath, '"https://lawhkvyyoznwygzsycan.supabase.co" "https://cdn-staging.corelia.academy" "sb_publishable_test"');
  await assert.rejects(verifyFrontendTarget("staging", f.root), /missing the staging Supabase/);
});

test("Production build pins the avatar API to Production Supabase", async (t) => {
  const f = fixture();
  t.after(() => rmSync(f.root, { recursive: true, force: true }));
  await prepareWorkerTarget("production", f.configPath);
  const config = JSON.parse(readFileSync(f.configPath, "utf8"));
  assert.equal(config.name, "corelia-app");
  assert.equal(config.vars.CORELIA_API_URL,
    "https://lawhkvyyoznwygzsycan.supabase.co/functions/v1/corelia-api");
  assert.equal(config.vars.CORELIA_OG_FUNCTION_URL,
    "https://lawhkvyyoznwygzsycan.supabase.co/functions/v1/corelia-api");
  assert.equal(config.vars.CORELIA_APP_ORIGIN, "https://app.corelia.academy");
});

test("Package scripts do not expose an ambiguous default deployment command", () => {
  const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
  assert.equal(packageJson.scripts.deploy, undefined);
});

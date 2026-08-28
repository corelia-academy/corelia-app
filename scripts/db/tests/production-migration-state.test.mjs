import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  parseMigrationList,
  validateProductionMigrationState,
  PRODUCTION_PROJECT_REF,
  PRODUCTION_BASELINE_COUNT,
  PRODUCTION_BASELINE_LATEST,
  APPROVED_PENDING_VERSIONS,
} from "../verify-production-migration-state.mjs";

const baselineJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "docs/db-baseline/baseline.json"), "utf8")
);
const realReleasedVersions = baselineJson.migrations.map((m) => m.version);

function validate(overrides = {}) {
  return validateProductionMigrationState({
    projectRef: PRODUCTION_PROJECT_REF,
    localVersions: [...realReleasedVersions, ...APPROVED_PENDING_VERSIONS],
    remoteVersions: [...realReleasedVersions],
    releasedVersions: realReleasedVersions,
    expectedProjectRef: PRODUCTION_PROJECT_REF,
    expectedBaselineCount: PRODUCTION_BASELINE_COUNT,
    expectedBaselineLatest: PRODUCTION_BASELINE_LATEST,
    expectedPendingVersions: APPROVED_PENDING_VERSIONS,
    ...overrides,
  });
}

test("CASE P0: exact frozen baseline + approved pending set => PASS", () => {
  const result = validate();
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.deepEqual(result.pendingVersions, APPROVED_PENDING_VERSIONS);
});

test("CASE P0b: repository migrations exactly match the frozen baseline plus approved pending set", () => {
  const localVersions = readdirSync(resolve(process.cwd(), "supabase/migrations"))
    .map((name) => name.match(/^(\d{14})_[^/]+\.sql$/)?.[1])
    .filter(Boolean)
    .sort();

  assert.deepEqual(localVersions, [...realReleasedVersions, ...APPROVED_PENDING_VERSIONS]);
});

test("CASE P0c: exact fully released remote chain is accepted for an idempotent retry", () => {
  const fullRelease = [...realReleasedVersions, ...APPROVED_PENDING_VERSIONS];
  const result = validate({ remoteVersions: fullRelease });
  assert.equal(result.ok, true);
  assert.deepEqual(result.pendingVersions, []);
});

test("CASE P1: latest != 20260818120000 => FAIL", () => {
  const mutatedReleased = [...realReleasedVersions];
  mutatedReleased[mutatedReleased.length - 1] = "20260817030000";
  const result = validate({ releasedVersions: mutatedReleased });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Frozen released baseline latest differs/);
});

test("CASE P2: missing 20260709000009 from remote ledger => FAIL", () => {
  const missingHistorical = realReleasedVersions.filter((v) => v !== "20260709000009");
  const result = validate({ remoteVersions: missingHistorical });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Remote ledger is neither the frozen baseline nor the exact fully released chain/);
});

test("CASE P3: extra historical pending migration => FAIL", () => {
  const extraHistoricalLocal = [
    ...realReleasedVersions.slice(0, 50),
    "20260515000000",
    ...realReleasedVersions.slice(50),
    ...APPROVED_PENDING_VERSIONS,
  ];
  const result = validate({ localVersions: extraHistoricalLocal });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Local migration chain is not the released baseline plus the exact approved pending set/);
});

test("CASE P4: extra future migration pending => FAIL", () => {
  const extraFutureLocal = [
    ...realReleasedVersions,
    ...APPROVED_PENDING_VERSIONS,
    "20260901000000",
  ];
  const result = validate({ localVersions: extraFutureLocal });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Pending migration set differs|Local migration chain is not the released baseline/);
});

test("CASE P5: one approved migration missing => FAIL", () => {
  const missingOneApproved = [
    ...realReleasedVersions,
    ...APPROVED_PENDING_VERSIONS.slice(0, 4), // missing 20260823140000
  ];
  const result = validate({ localVersions: missingOneApproved });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Pending migration set differs|Local migration chain is not the released baseline/);
});

test("CASE P6: historical baseline mutation (reordered/changed) => FAIL", () => {
  const reordered = [...realReleasedVersions];
  const tmp = reordered[10];
  reordered[10] = reordered[11];
  reordered[11] = tmp;
  const result = validate({ remoteVersions: reordered });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Remote ledger is neither the frozen baseline nor the exact fully released chain/);
});

test("CASE P7: wrong project ref => FAIL", () => {
  const result = validate({ projectRef: "opoozbmfbezkrpzxsusx" }); // staging ref
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Wrong Production project ref/);
});

test("CASE P8: malformed CLI output => FAIL", () => {
  assert.throws(
    () => parseMigrationList("Error: Connection refused\nFailed to reach database"),
    /Could not parse any migration rows/
  );
});

test("CASE P9: remote already contains one approved migration unexpectedly (partial migration state) => FAIL", () => {
  const partiallyMigratedRemote = [...realReleasedVersions, APPROVED_PENDING_VERSIONS[0]];
  const result = validate({ remoteVersions: partiallyMigratedRemote });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Remote ledger is neither the frozen baseline nor the exact fully released chain/);
});

test("Production workflow structure safety", () => {
  const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/deploy-prod.yml"), "utf8");
  const guard = "node scripts/db/verify-production-migration-state.mjs";
  const migrationUp = "supabase migration up --linked --dns-resolver https";

  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\n\s+push:/);
  assert.match(workflow, /test "\$SUPABASE_PROJECT_REF" = "lawhkvyyoznwygzsycan"/);
  assert.ok(workflow.indexOf(guard) >= 0, "workflow must invoke the Production migration guard");
  assert.ok(workflow.indexOf(guard) < workflow.indexOf(migrationUp), "guard must run before migration up");
  assert.doesNotMatch(workflow, /migration repair/);
  assert.doesNotMatch(workflow, /--include-all/);
});

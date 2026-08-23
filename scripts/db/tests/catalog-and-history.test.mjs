import assert from "node:assert/strict";
import test from "node:test";
import { fingerprintCatalog } from "../lib/catalog-fingerprint.mjs";
import { validateDriftAllowlist } from "../lib/drift-allowlist.mjs";
import { compareLiveHistory } from "../lib/live-history.mjs";

test("catalog semantic fingerprint ignores CRLF and trailing whitespace only", () => {
  const base = { objects: { rlsPolicies: [{ name: "read_own", using: "(auth.uid() = user_id)\r\n" }] } };
  const formatted = { objects: { rlsPolicies: [{ name: "read_own", using: "(auth.uid() = user_id)\n" }] } };
  const changed = { objects: { rlsPolicies: [{ name: "read_own", using: "(auth.uid() = owner_id)\n" }] } };
  assert.equal(fingerprintCatalog(base).categories.rlsPolicies.semanticSha256, fingerprintCatalog(formatted).categories.rlsPolicies.semanticSha256);
  assert.notEqual(fingerprintCatalog(base).categories.rlsPolicies.semanticSha256, fingerprintCatalog(changed).categories.rlsPolicies.semanticSha256);
});

const baseline = {
  liveMigrationHistory: {
    main: { appliedMigrationCount: 2, latestMigration: "20260102000000" },
  },
};
const matchingCapture = {
  projectRef: "lawhkvyyoznwygzsycan",
  migrations: [{ version: "20260101000000" }, { version: "20260102000000" }],
};

test("CASE F: known historical migration drift is accepted with a warning", () => {
  const result = compareLiveHistory({
    baseline,
    capture: { ...matchingCapture, migrations: [{ version: "20260101000000" }] },
    allowlist: { entries: [{ kind: "EXPECTED_HISTORICAL_DRIFT", surface: "migration_history", environments: ["main"] }] },
    environment: "main",
    expectedProjectRef: "lawhkvyyoznwygzsycan",
  });
  assert.equal(result.ok, true);
  assert.equal(result.warnings.length, 1);
});

test("CASE G: unexpected migration drift fails", () => {
  const result = compareLiveHistory({
    baseline,
    capture: { ...matchingCapture, migrations: [{ version: "20260101000000" }] },
    allowlist: { entries: [] },
    environment: "main",
    expectedProjectRef: "lawhkvyyoznwygzsycan",
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /unexpected drift/);
});

test("live history comparison fails closed on a wrong project ref", () => {
  const result = compareLiveHistory({
    baseline,
    capture: { ...matchingCapture, projectRef: "opoozbmfbezkrpzxsusx" },
    allowlist: { entries: [] },
    environment: "main",
    expectedProjectRef: "lawhkvyyoznwygzsycan",
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Refusing history comparison/);
});

test("intentional drift must have ownership, release and review metadata", () => {
  const result = validateDriftAllowlist({
    intentionalStagingFeatureDrift: [{ feature: "course locale" }],
  }, { now: new Date("2026-08-23T00:00:00.000Z") });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /missing owner/);
});

test("expired intentional drift fails", () => {
  const result = validateDriftAllowlist({
    intentionalStagingFeatureDrift: [{
      feature: "course locale",
      object: "public.courses",
      migrationOrCommit: "abc1234",
      owner: "database-maintainers",
      reason: "staging rollout",
      expectedMainRelease: "2026.09",
      reviewDate: "2026-08-22",
      expectedCatalogDelta: "one column",
      stagingValidationResult: "pass",
    }],
  }, { now: new Date("2026-08-23T00:00:00.000Z") });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /expired/);
});

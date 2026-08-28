import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  APPROVED_PENDING_VERSIONS,
  PRODUCTION_BASELINE_COUNT,
  PRODUCTION_BASELINE_LATEST,
} from "./production-release-migrations.mjs";

export { APPROVED_PENDING_VERSIONS, PRODUCTION_BASELINE_COUNT, PRODUCTION_BASELINE_LATEST };

export const PRODUCTION_PROJECT_REF = "lawhkvyyoznwygzsycan";

function unique(values) {
  return [...new Set(values)];
}

function sameOrderedValues(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function describe(values) {
  return values.length === 0 ? "none" : values.join(", ");
}

export function parseMigrationList(output) {
  const rows = [];
  const normalized = output.replace(/\u001b\[[0-9;]*m/g, "");

  for (const line of normalized.split(/\r?\n/)) {
    if (!line.includes("|")) continue;
    const [localCell = "", remoteCell = ""] = line.split("|").map((cell) => cell.trim());
    const localVersion = /^\d{14}$/.test(localCell) ? localCell : null;
    const remoteVersion = /^\d{14}$/.test(remoteCell) ? remoteCell : null;
    if (localVersion || remoteVersion) rows.push({ localVersion, remoteVersion });
  }

  if (rows.length === 0) {
    throw new Error("Could not parse any migration rows from `supabase migration list --linked` output.");
  }

  return {
    localVersions: rows.flatMap((row) => row.localVersion ? [row.localVersion] : []),
    remoteVersions: rows.flatMap((row) => row.remoteVersion ? [row.remoteVersion] : []),
  };
}

export function validateProductionMigrationState({
  projectRef,
  localVersions,
  remoteVersions,
  releasedVersions,
  expectedProjectRef = PRODUCTION_PROJECT_REF,
  expectedBaselineCount = PRODUCTION_BASELINE_COUNT,
  expectedBaselineLatest = PRODUCTION_BASELINE_LATEST,
  expectedPendingVersions = APPROVED_PENDING_VERSIONS,
}) {
  const errors = [];
  const duplicateLocal = localVersions.length !== unique(localVersions).length;
  const duplicateRemote = remoteVersions.length !== unique(remoteVersions).length;

  if (projectRef !== expectedProjectRef) {
    errors.push(`Wrong Production project ref: expected ${expectedProjectRef}, got ${projectRef || "missing"}.`);
  }
  if (duplicateLocal) errors.push("Local migration list contains duplicate versions.");
  if (duplicateRemote) errors.push("Remote migration ledger contains duplicate versions.");
  if (releasedVersions.length !== expectedBaselineCount) {
    errors.push(`Frozen released baseline is invalid: expected ${expectedBaselineCount} versions, got ${releasedVersions.length}.`);
  }
  if (releasedVersions.at(-1) !== expectedBaselineLatest) {
    errors.push(`Frozen released baseline latest differs: expected ${expectedBaselineLatest}, got ${releasedVersions.at(-1) ?? "none"}.`);
  }
  if (!sameOrderedValues(remoteVersions, releasedVersions)) {
    errors.push(`Remote historical ledger differs from the frozen released baseline. Remote: ${describe(remoteVersions)}.`);
  }

  const expectedLocalVersions = [...releasedVersions, ...expectedPendingVersions];
  if (!sameOrderedValues(localVersions, expectedLocalVersions)) {
    errors.push(`Local migration chain is not the released baseline plus the exact approved pending set. Local: ${describe(localVersions)}.`);
  }

  const remoteSet = new Set(remoteVersions);
  const pendingVersions = localVersions.filter((version) => !remoteSet.has(version));
  if (!sameOrderedValues(pendingVersions, expectedPendingVersions)) {
    errors.push(`Pending migration set differs. Expected: ${describe(expectedPendingVersions)}. Actual: ${describe(pendingVersions)}.`);
  }

  return { ok: errors.length === 0, errors, pendingVersions };
}

function run() {
  const [migrationListPath, baselinePathArg] = process.argv.slice(2);
  if (!migrationListPath) {
    console.error("Usage: node scripts/db/verify-production-migration-state.mjs <migration-list-output> [baseline.json]");
    process.exit(1);
  }

  const baselinePath = resolve(process.cwd(), baselinePathArg ?? "docs/db-baseline/baseline.json");
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const parsed = parseMigrationList(readFileSync(resolve(process.cwd(), migrationListPath), "utf8"));
  const result = validateProductionMigrationState({
    projectRef: process.env.SUPABASE_PROJECT_REF,
    ...parsed,
    releasedVersions: baseline.migrations.map((migration) => migration.version),
  });

  if (!result.ok) {
    console.error("Production migration pre-deploy guard failed closed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`Production migration pre-deploy guard passed: ${PRODUCTION_BASELINE_COUNT} released migrations and exact pending set ${result.pendingVersions.join(", ")}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) run();

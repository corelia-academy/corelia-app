import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import test from "node:test";
import { assertSafeOutputPath } from "../build-production-release-candidate.mjs";
import {
  DEFAULT_MANIFEST_PATH,
  EXPECTED_BASE_MAIN_SHA,
  EXPECTED_FORWARD_MIGRATIONS,
  readGitBlobAtCommit,
  sha256,
  validateManifestSchema,
  validateReleaseArtifactState,
  verifyManifestIntegrity,
} from "../verify-production-release-artifact.mjs";

const WORKFLOW_PATH = ".github/workflows/deploy-prod.yml";
const ROLLOUT_PLAN_PATH = "docs/db-baseline/main-g2-r1-rollout-plan.md";
const SOURCE_SHA = "82ac342c3b239be4e35eb836db2e2d74d93a420f";
const TREE_SHA = "a".repeat(64);

function clone(value) {
  return structuredClone(value);
}

function buildFixture() {
  const baseline = Array.from({ length: 138 }, (_, index) => {
    const version = (20250101000000n + BigInt(index)).toString();
    const path = `supabase/migrations/${version}_baseline_${String(index + 1).padStart(3, "0")}.sql`;
    const content = Buffer.from(`baseline-${index + 1}\n`);
    return { path, content, sha256: sha256(content) };
  });
  baseline.push((() => {
    const path = "supabase/migrations/20260818120000_clean_legacy_manual_mint_templates.sql";
    const content = Buffer.from("baseline-139\n");
    return { path, content, sha256: sha256(content) };
  })());
  const forward = EXPECTED_FORWARD_MIGRATIONS.map((path, index) => {
    const content = Buffer.from(`forward-${index + 1}\n`);
    return { path, content, sha256: sha256(content) };
  });
  const otherFiles = [
    { path: "src/components/layouts/Header.tsx", content: Buffer.from("export const header = true;\n") },
    { path: "src/components/layouts/G2HeaderDependency.tsx", content: Buffer.from("export const dependency = true;\n") },
    { path: "docs/db-baseline/release-control.json", content: Buffer.from("{}\n") },
  ].map((entry) => ({ ...entry, sha256: sha256(entry.content) }));
  const baselineManifestContent = Buffer.from(
    `${JSON.stringify({ frozenMigrationCount: 139, migrations: baseline.map(({ path, sha256: digest }) => ({ path, sha256: digest })) })}\n`,
  );
  const baselineManifestFile = {
    path: "docs/db-baseline/baseline.json",
    content: baselineManifestContent,
    sha256: sha256(baselineManifestContent),
  };
  const allFiles = [...baseline, ...forward, ...otherFiles, baselineManifestFile];
  const deletedFiles = ["src/components/course-ai/CoraPlanSummary.tsx", "src/hooks/useCoraAI.ts"];
  const manifest = {
    schema_version: 1,
    artifact_id: "R5_RELEASE_CANDIDATE",
    rc_sha: SOURCE_SHA,
    git_tree_sha: "c".repeat(40),
    production_base_sha: EXPECTED_BASE_MAIN_SHA,
    target_production_project_ref: "lawhkvyyoznwygzsycan",
    migration_count: 156,
    latest_migration: "20260826120000_issue_329_payment_retirement_safety.sql",
    base_sha: EXPECTED_BASE_MAIN_SHA,
    source_sha: SOURCE_SHA,
    manifest_path: DEFAULT_MANIFEST_PATH,
    candidate_tree_sha256: TREE_SHA,
    recipe: {
      patches: [{ commit: "1".repeat(40), parent: "2".repeat(40), paths: ["src/components/layouts/Header.tsx"] }],
      materialized_files: [],
      workspace_files: [],
    },
    files: allFiles.map(({ path, sha256: digest }) => ({ path, sha256: digest })),
    deleted_files: deletedFiles,
    migration_chain: {
      baseline_manifest: {
        path: baselineManifestFile.path,
        sha256: baselineManifestFile.sha256,
        count: 139,
        latest: baseline.at(-1).path.split("/").at(-1),
      },
      forward: forward.map(({ path, sha256: digest }) => ({ path, sha256: digest })),
    },
  };
  const state = {
    baseSha: EXPECTED_BASE_MAIN_SHA,
    sourceSha: SOURCE_SHA,
    sourceTreeSha: "c".repeat(40),
    changedFiles: [...allFiles.map((entry) => entry.path), ...deletedFiles, DEFAULT_MANIFEST_PATH],
    files: new Map(allFiles.map((entry) => [entry.path, entry.content])),
    migrations: [...baseline, ...forward].map(({ path, sha256: digest }) => ({ path, sha256: digest })),
    candidateTreeSha256: TREE_SHA,
  };
  return { manifest, state };
}

function expectFailure(manifest, state, pattern) {
  const result = validateReleaseArtifactState(manifest, state);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), pattern);
}

test("exact candidate passes exact file, hash, tree and 139+17 migration checks", () => {
  const { manifest, state } = buildFixture();
  const result = validateReleaseArtifactState(manifest, state);
  assert.deepEqual(result, { ok: true, errors: [], totalFiles: 163, totalMigrations: 156 });
});

test("missing required file fails closed", () => {
  const { manifest, state } = buildFixture();
  const missing = manifest.files.at(-1).path;
  state.changedFiles = state.changedFiles.filter((path) => path !== missing);
  state.files.delete(missing);
  expectFailure(manifest, state, /missing required file|Cannot read required file content/);
});

test("deleted Wave B files do not remain required as present files", () => {
  const { manifest, state } = buildFixture();
  // Deleted files are in deleted_files, and they should NOT be in state.files
  for (const deleted of manifest.deleted_files) {
    assert.equal(state.files.has(deleted), false);
  }
  const result = validateReleaseArtifactState(manifest, state);
  assert.equal(result.ok, true);
});

test("unexpected Wave B/C files cause manifest failure", () => {
  const { manifest, state } = buildFixture();
  state.changedFiles.push("src/unexpected/ExtraFile.ts");
  expectFailure(manifest, state, /contains unexpected file/);
});

test("candidate tree/hash tampering fails closed", () => {
  const { manifest, state } = buildFixture();
  state.candidateTreeSha256 = "0".repeat(64);
  expectFailure(manifest, state, /Candidate tree SHA-256 mismatch/);
});

test("extra unexpected file fails closed", () => {
  const { manifest, state } = buildFixture();
  state.changedFiles.push("src/unreviewed.ts");
  expectFailure(manifest, state, /contains unexpected file: src\/unreviewed\.ts/);
});

test("missing or extra manifest entries fail closed", () => {
  const missing = buildFixture();
  missing.manifest.files.pop();
  expectFailure(missing.manifest, missing.state, /contains unexpected file/);

  const extra = buildFixture();
  extra.manifest.files.push({ path: "src/not-in-candidate.ts", sha256: sha256("not present") });
  expectFailure(extra.manifest, extra.state, /missing required file/);
});

test("modified approved file fails content integrity", () => {
  const { manifest, state } = buildFixture();
  state.files.set("src/components/layouts/Header.tsx", Buffer.from("modified\n"));
  expectFailure(manifest, state, /Content SHA-256 mismatch for src\/components\/layouts\/Header\.tsx/);
});

test("same approved path with different content cannot substitute the reviewed blob", () => {
  const { manifest, state } = buildFixture();
  const path = manifest.migration_chain.forward[0].path;
  state.files.set(path, Buffer.from("same-path-different-content\n"));
  expectFailure(manifest, state, /Content SHA-256 mismatch/);
});

test("wrong or malformed base SHA fails closed", () => {
  const { manifest, state } = buildFixture();
  state.baseSha = "f".repeat(40);
  expectFailure(manifest, state, /Wrong base SHA/);
  const malformed = buildFixture();
  malformed.manifest.base_sha = "not-a-sha";
  expectFailure(malformed.manifest, malformed.state, /base_sha is malformed/);
});

test("missing historical migration fails exact 139 baseline chain", () => {
  const { manifest, state } = buildFixture();
  state.migrations.splice(40, 1);
  expectFailure(manifest, state, /Migration chain count mismatch|Migration order\/path mismatch/);
});

test("unreviewed fifteenth forward migration fails exact migration chain", () => {
  const { manifest, state } = buildFixture();
  state.migrations.push({
    path: "supabase/migrations/20260825154000_unreviewed_fifteenth.sql",
    sha256: sha256("unreviewed"),
  });
  expectFailure(manifest, state, /Migration chain count mismatch/);
});

test("reordered migration chain fails even when names and hashes are otherwise valid", () => {
  const { manifest, state } = buildFixture();
  [state.migrations[20], state.migrations[21]] = [state.migrations[21], state.migrations[20]];
  expectFailure(manifest, state, /Migration order\/path mismatch/);
});

test("missing frontend transitive dependency is caught as an exact required-file failure", () => {
  const { manifest, state } = buildFixture();
  const dependency = "src/components/layouts/G2HeaderDependency.tsx";
  state.changedFiles = state.changedFiles.filter((path) => path !== dependency);
  state.files.delete(dependency);
  expectFailure(manifest, state, /G2HeaderDependency/);
});

test("broad governance substitution fails with both missing and unexpected paths", () => {
  const { manifest, state } = buildFixture();
  const reviewed = "docs/db-baseline/release-control.json";
  state.changedFiles = state.changedFiles.filter((path) => path !== reviewed);
  state.changedFiles.push("docs/db-baseline/unreviewed-control.json");
  state.files.delete(reviewed);
  state.files.set("docs/db-baseline/unreviewed-control.json", Buffer.from("{}\n"));
  expectFailure(manifest, state, /missing required file.*release-control|unexpected file.*unreviewed-control/s);
});

test("candidate tree identity mismatch fails closed", () => {
  const { manifest, state } = buildFixture();
  state.candidateTreeSha256 = "b".repeat(64);
  expectFailure(manifest, state, /Candidate tree SHA-256 mismatch/);
});

test("manifest itself requires an external immutable SHA-256", () => {
  const raw = Buffer.from('{"manifest":"reviewed"}\n');
  assert.equal(verifyManifestIntegrity(raw, sha256(raw)), sha256(raw));
  assert.throws(() => verifyManifestIntegrity(raw, "0".repeat(64)), /Release manifest SHA-256 mismatch/);
  assert.throws(() => verifyManifestIntegrity(raw, "bad"), /expected manifest SHA-256 is malformed/);
});

test("manifest identity uses immutable Git blob bytes across LF and CRLF checkouts", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "corelia-manifest-blob-"));
  const manifestPath = "docs/db-baseline/production-release-artifact-manifest.json";
  const absoluteManifestPath = join(repoRoot, ...manifestPath.split("/"));
  mkdirSync(join(repoRoot, "docs", "db-baseline"), { recursive: true });
  execFileSync("git", ["init"], { cwd: repoRoot });
  execFileSync("git", ["config", "user.email", "release-test@corelia.invalid"], { cwd: repoRoot });
  execFileSync("git", ["config", "user.name", "Corelia Release Test"], { cwd: repoRoot });

  const lf = Buffer.from('{"artifact":"reviewed","entries":["a","b"]}\n');
  writeFileSync(absoluteManifestPath, lf);
  execFileSync("git", ["add", manifestPath], { cwd: repoRoot });
  execFileSync("git", ["commit", "-m", "fixture manifest"], { cwd: repoRoot });
  const reviewedCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  const expectedHash = sha256(lf);

  assert.equal(verifyManifestIntegrity(readGitBlobAtCommit(repoRoot, reviewedCommit, manifestPath), expectedHash), expectedHash);

  writeFileSync(absoluteManifestPath, Buffer.from(lf.toString("utf8").replaceAll("\n", "\r\n")));
  assert.equal(verifyManifestIntegrity(readGitBlobAtCommit(repoRoot, reviewedCommit, manifestPath), expectedHash), expectedHash);

  writeFileSync(absoluteManifestPath, Buffer.from('{"artifact":"mutated","entries":["a","b"]}\n'));
  execFileSync("git", ["add", manifestPath], { cwd: repoRoot });
  execFileSync("git", ["commit", "-m", "mutated manifest"], { cwd: repoRoot });
  const mutatedCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  assert.throws(
    () => verifyManifestIntegrity(readGitBlobAtCommit(repoRoot, mutatedCommit, manifestPath), expectedHash),
    /Release manifest SHA-256 mismatch/,
  );

  rmSync(repoRoot, { recursive: true, force: true });
});

test("Production workflow is manual-only and does not require an approved release SHA", () => {
  const workflow = readFileSync(WORKFLOW_PATH, "utf8");

  assert.match(workflow, /^on:\s*\r?\n\s+workflow_dispatch: \{\}/m);
  assert.doesNotMatch(workflow, /^\s+push:/m);
  assert.doesNotMatch(workflow, /APPROVED_PRODUCTION_RELEASE_SHA|APPROVED_RELEASE_SHA/);
  assert.doesNotMatch(workflow, /release_sha:|inputs\.release_sha/);

  // F-02 check: Workflow must deploy corelia-api and all 7 retired AI Edge Functions
  const expectedEdgeFunctions = [
    "corelia-api",
    "ai-tutor",
    "embed-lesson",
    "generate-description",
    "generate-flashcards",
    "generate-learning-path",
    "generate-lesson-summary",
    "generate-questions",
  ];
  for (const fn of expectedEdgeFunctions) {
    assert.match(workflow, new RegExp(`supabase functions deploy ${fn}\\b`), `Workflow must deploy function ${fn}`);
  }
});

test("candidate builder rejects destructive, outside-temp and symlinked output targets", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "corelia-r3-output-guard-"));
  const sourceRepo = join(fixtureRoot, "source");
  const workspaceRoot = join(fixtureRoot, "workspace");
  const safeOutput = join(fixtureRoot, "candidates", "r3");
  mkdirSync(sourceRepo);
  mkdirSync(workspaceRoot);
  assert.equal(assertSafeOutputPath({ output: safeOutput, sourceRepo, workspaceRoot, cwd: workspaceRoot }), safeOutput);
  assert.throws(
    () => assertSafeOutputPath({ output: tmpdir(), sourceRepo, workspaceRoot, cwd: workspaceRoot }),
    /strict descendant|protected path/,
  );
  assert.throws(
    () => assertSafeOutputPath({ output: sourceRepo, sourceRepo, workspaceRoot, cwd: workspaceRoot }),
    /protected path/,
  );
  assert.throws(
    () => assertSafeOutputPath({ output: join(sourceRepo, "nested-candidate"), sourceRepo, workspaceRoot, cwd: workspaceRoot }),
    /protected path/,
  );
  assert.throws(
    () => assertSafeOutputPath({ output: fixtureRoot, sourceRepo, workspaceRoot, cwd: workspaceRoot }),
    /protected path/,
  );
  assert.throws(
    () => assertSafeOutputPath({ output: parse(fixtureRoot).root, sourceRepo, workspaceRoot, cwd: workspaceRoot }),
    /strict descendant|protected path/,
  );

  const realParent = join(fixtureRoot, "real-parent");
  const linkedParent = join(fixtureRoot, "linked-parent");
  mkdirSync(realParent);
  symlinkSync(realParent, linkedParent, "junction");
  assert.throws(
    () => assertSafeOutputPath({ output: join(linkedParent, "candidate"), sourceRepo, workspaceRoot, cwd: workspaceRoot }),
    /symlink|junction/,
  );
  rmSync(fixtureRoot, { recursive: true, force: true });
});

test("production manifest has the canonical exact 139+17 shape", () => {
  const manifest = JSON.parse(readFileSync(DEFAULT_MANIFEST_PATH, "utf8"));
  validateManifestSchema(manifest);
  assert.equal(manifest.migration_chain.baseline_manifest.count, 139);
  assert.deepEqual(manifest.migration_chain.forward.map((entry) => entry.path), EXPECTED_FORWARD_MIGRATIONS);
});

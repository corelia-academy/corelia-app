import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_MANIFEST_PATH = "docs/db-baseline/production-release-artifact-manifest.json";
export const EXPECTED_BASE_MAIN_SHA = "66981c2044b515a6fa07a71d06f8265d171d6a74";
export const EXPECTED_BASELINE_MIGRATION_COUNT = 139;
export const EXPECTED_FORWARD_MIGRATIONS = Object.freeze([
  "supabase/migrations/20260823120000_seed_projects_without_overwrite.sql",
  "supabase/migrations/20260823121000_ai_quota_semantic_normalization.sql",
  "supabase/migrations/20260823122000_hackathon_canonical_project_compatibility.sql",
  "supabase/migrations/20260823130000_g2_canonical_state_and_data_integrity.sql",
  "supabase/migrations/20260823140000_g2_r1_remediation.sql",
  "supabase/migrations/20260825100000_payment_refund_and_access_provenance_schema.sql",
  "supabase/migrations/20260825110000_atomic_payment_settlement_and_enrollment_rpcs.sql",
  "supabase/migrations/20260825120000_master_schema_classification_lifecycle_and_index_optimization.sql",
  "supabase/migrations/20260825130000_harden_enrollment_provenance_and_security_guards.sql",
  "supabase/migrations/20260825140000_harden_enrollment_payment_purpose_and_timestamp.sql",
]);

const SHA1_RE = /^[0-9a-f]{40}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const MIGRATION_PATH_RE = /^supabase\/migrations\/(\d{14})_[^/]+\.sql$/;

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeRepositoryPath(value) {
  if (typeof value !== "string" || value.length === 0) throw new Error("Repository paths must be non-empty strings.");
  const normalized = value.replaceAll("\\", "/");
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`Unsafe repository path: ${value}`);
  }
  return normalized;
}

function assertExactKeys(value, expectedKeys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} has unexpected or missing keys.`);
}

function assertSha(value, regex, label) {
  if (typeof value !== "string" || !regex.test(value)) throw new Error(`${label} is malformed.`);
}

function validateUniquePaths(entries, label) {
  const seen = new Set();
  for (const entry of entries) {
    const path = normalizeRepositoryPath(entry.path);
    if (seen.has(path)) throw new Error(`${label} contains duplicate path: ${path}`);
    seen.add(path);
  }
}

function validateMigrationEntries(entries, label) {
  if (!Array.isArray(entries)) throw new Error(`${label} must be an array.`);
  validateUniquePaths(entries, label);
  let previousVersion = "";
  for (const entry of entries) {
    assertExactKeys(entry, ["path", "sha256"], `${label} entry`);
    const path = normalizeRepositoryPath(entry.path);
    const match = path.match(MIGRATION_PATH_RE);
    if (!match) throw new Error(`${label} contains a non-migration path: ${path}`);
    if (match[1] <= previousVersion) throw new Error(`${label} is not in strict migration version order at ${path}.`);
    previousVersion = match[1];
    assertSha(entry.sha256, SHA256_RE, `${label} SHA-256 for ${path}`);
  }
}

function validateRecipe(recipe, sourceSha) {
  assertExactKeys(recipe, ["patches", "materialized_files", "workspace_files"], "recipe");
  if (!Array.isArray(recipe.patches) || !Array.isArray(recipe.materialized_files) || !Array.isArray(recipe.workspace_files)) {
    throw new Error("recipe lists must be arrays.");
  }
  for (const patch of recipe.patches) {
    assertExactKeys(patch, ["commit", "parent", "paths"], "recipe patch");
    assertSha(patch.commit, SHA1_RE, "recipe patch commit");
    assertSha(patch.parent, SHA1_RE, "recipe patch parent");
    if (!Array.isArray(patch.paths) || patch.paths.length === 0) throw new Error("recipe patch paths must be non-empty.");
    const paths = patch.paths.map(normalizeRepositoryPath);
    if (new Set(paths).size !== paths.length) throw new Error("recipe patch paths contain duplicates.");
  }
  for (const entry of recipe.materialized_files) {
    assertExactKeys(entry, ["path", "source_sha", "sha256"], "materialized file");
    normalizeRepositoryPath(entry.path);
    assertSha(entry.source_sha, SHA1_RE, "materialized source_sha");
    if (entry.source_sha !== sourceSha) throw new Error("Materialized file source_sha must equal manifest source_sha.");
    assertSha(entry.sha256, SHA256_RE, "materialized file SHA-256");
  }
  for (const entry of recipe.workspace_files) {
    assertExactKeys(entry, ["path", "sha256"], "workspace file");
    normalizeRepositoryPath(entry.path);
    assertSha(entry.sha256, SHA256_RE, "workspace file SHA-256");
  }
}

export function validateManifestSchema(manifest) {
  assertExactKeys(
    manifest,
    ["schema_version", "artifact_id", "base_sha", "source_sha", "manifest_path", "candidate_tree_sha256", "recipe", "files", "migration_chain"],
    "release manifest",
  );
  if (manifest.schema_version !== 1) throw new Error("Unsupported release manifest schema_version.");
  if (manifest.artifact_id !== "R3_PROPOSED_RELEASE_CANDIDATE") throw new Error("Unexpected release artifact_id.");
  assertSha(manifest.base_sha, SHA1_RE, "base_sha");
  assertSha(manifest.source_sha, SHA1_RE, "source_sha");
  if (manifest.base_sha !== EXPECTED_BASE_MAIN_SHA) {
    throw new Error(`base_sha must equal the reviewed Production base ${EXPECTED_BASE_MAIN_SHA}.`);
  }
  const manifestPath = normalizeRepositoryPath(manifest.manifest_path);
  if (manifestPath !== DEFAULT_MANIFEST_PATH) throw new Error("Unexpected manifest_path.");
  assertSha(manifest.candidate_tree_sha256, SHA256_RE, "candidate_tree_sha256");

  if (!Array.isArray(manifest.files) || manifest.files.length === 0) throw new Error("files must be a non-empty exact release file list.");
  validateUniquePaths(manifest.files, "files");
  for (const file of manifest.files) {
    assertExactKeys(file, ["path", "sha256"], "files entry");
    const path = normalizeRepositoryPath(file.path);
    if (path === manifestPath) throw new Error("The manifest must be protected externally, not self-hashed.");
    assertSha(file.sha256, SHA256_RE, `files SHA-256 for ${path}`);
  }

  assertExactKeys(manifest.migration_chain, ["baseline_manifest", "forward"], "migration_chain");
  assertExactKeys(manifest.migration_chain.baseline_manifest, ["path", "sha256", "count", "latest"], "migration_chain.baseline_manifest");
  normalizeRepositoryPath(manifest.migration_chain.baseline_manifest.path);
  assertSha(manifest.migration_chain.baseline_manifest.sha256, SHA256_RE, "baseline manifest SHA-256");
  if (manifest.migration_chain.baseline_manifest.count !== EXPECTED_BASELINE_MIGRATION_COUNT) {
    throw new Error(`Historical migration baseline must contain exactly ${EXPECTED_BASELINE_MIGRATION_COUNT} files.`);
  }
  if (manifest.migration_chain.baseline_manifest.latest !== "20260818120000_clean_legacy_manual_mint_templates.sql") {
    throw new Error("Unexpected historical baseline latest migration.");
  }
  validateMigrationEntries(manifest.migration_chain.forward, "migration_chain.forward");
  const forwardPaths = manifest.migration_chain.forward.map((entry) => normalizeRepositoryPath(entry.path));
  if (JSON.stringify(forwardPaths) !== JSON.stringify(EXPECTED_FORWARD_MIGRATIONS)) {
    throw new Error("Forward migration set must be the exact reviewed ten in canonical order.");
  }
  validateRecipe(manifest.recipe, manifest.source_sha);
  return manifest;
}

export function verifyManifestIntegrity(rawManifest, expectedSha256) {
  assertSha(expectedSha256, SHA256_RE, "expected manifest SHA-256");
  const actual = sha256(rawManifest);
  if (actual !== expectedSha256) throw new Error(`Release manifest SHA-256 mismatch: expected ${expectedSha256}, got ${actual}.`);
  return actual;
}

function compareExactPaths(actual, expected, label, errors) {
  const actualSet = new Set(actual.map(normalizeRepositoryPath));
  const expectedSet = new Set(expected.map(normalizeRepositoryPath));
  for (const path of expectedSet) if (!actualSet.has(path)) errors.push(`${label} missing required file: ${path}`);
  for (const path of actualSet) if (!expectedSet.has(path)) errors.push(`${label} contains unexpected file: ${path}`);
}

export function validateReleaseArtifactState(manifestInput, state) {
  const errors = [];
  let manifest;
  try {
    manifest = validateManifestSchema(manifestInput);
  } catch (error) {
    return { ok: false, errors: [error.message] };
  }
  if (state.baseSha !== manifest.base_sha) errors.push(`Wrong base SHA: expected ${manifest.base_sha}, got ${state.baseSha ?? "<missing>"}.`);
  const expectedChanged = [...manifest.files.map((entry) => entry.path), manifest.manifest_path];
  compareExactPaths(state.changedFiles ?? [], expectedChanged, "Release artifact", errors);

  const actualFiles = state.files instanceof Map ? state.files : new Map(Object.entries(state.files ?? {}));
  for (const expected of manifest.files) {
    const content = actualFiles.get(expected.path);
    if (content === undefined) {
      errors.push(`Cannot read required file content: ${expected.path}`);
      continue;
    }
    const actualHash = sha256(content);
    if (actualHash !== expected.sha256) {
      errors.push(`Content SHA-256 mismatch for ${expected.path}: expected ${expected.sha256}, got ${actualHash}.`);
    }
  }

  let baselineEntries = [];
  const baselineManifest = manifest.migration_chain.baseline_manifest;
  const baselineContent = actualFiles.get(baselineManifest.path);
  if (baselineContent === undefined) {
    errors.push(`Cannot read canonical historical baseline manifest: ${baselineManifest.path}`);
  } else if (sha256(baselineContent) !== baselineManifest.sha256) {
    errors.push(`Historical baseline manifest SHA-256 mismatch for ${baselineManifest.path}.`);
  } else {
    try {
      const parsed = JSON.parse(Buffer.from(baselineContent).toString("utf8"));
      if (parsed.frozenMigrationCount !== EXPECTED_BASELINE_MIGRATION_COUNT || !Array.isArray(parsed.migrations)) {
        throw new Error("baseline count/list mismatch");
      }
      baselineEntries = parsed.migrations.map((entry) => ({ path: normalizeRepositoryPath(entry.path), sha256: entry.sha256 }));
      validateMigrationEntries(baselineEntries, "canonical baseline manifest migrations");
      if (baselineEntries.length !== EXPECTED_BASELINE_MIGRATION_COUNT) throw new Error("baseline entry count mismatch");
      if (baselineEntries.at(-1)?.path.split("/").at(-1) !== baselineManifest.latest) throw new Error("baseline latest mismatch");
    } catch (error) {
      errors.push(`Canonical historical baseline manifest is malformed or incomplete: ${error.message}`);
    }
  }
  const expectedMigrations = [...baselineEntries, ...manifest.migration_chain.forward];
  const actualMigrations = state.migrations ?? [];
  if (actualMigrations.length !== expectedMigrations.length) {
    errors.push(`Migration chain count mismatch: expected ${expectedMigrations.length}, got ${actualMigrations.length}.`);
  }
  const max = Math.max(actualMigrations.length, expectedMigrations.length);
  for (let index = 0; index < max; index += 1) {
    const expected = expectedMigrations[index];
    const actual = actualMigrations[index];
    if (!expected || !actual) continue;
    if (actual.path !== expected.path) {
      errors.push(`Migration order/path mismatch at index ${index}: expected ${expected.path}, got ${actual.path}.`);
    } else if (actual.sha256 !== expected.sha256) {
      errors.push(`Migration SHA-256 mismatch for ${expected.path}: expected ${expected.sha256}, got ${actual.sha256}.`);
    }
  }
  if (state.candidateTreeSha256 !== manifest.candidate_tree_sha256) {
    errors.push(`Candidate tree SHA-256 mismatch: expected ${manifest.candidate_tree_sha256}, got ${state.candidateTreeSha256 ?? "<missing>"}.`);
  }
  return { ok: errors.length === 0, errors, totalFiles: expectedChanged.length, totalMigrations: expectedMigrations.length };
}

function git(repoRoot, args, options = {}) {
  return execFileSync("git", ["-c", `safe.directory=${repoRoot.replaceAll("\\", "/")}`, "-C", repoRoot, ...args], {
    encoding: options.encoding ?? "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

export function resolveGitCommit(repoRoot, ref) {
  return git(repoRoot, ["rev-parse", "--verify", `${ref}^{commit}`]).trim();
}

export function readGitBlobAtCommit(repoRoot, commitRef, repositoryPath) {
  const commitSha = resolveGitCommit(repoRoot, commitRef);
  const path = normalizeRepositoryPath(repositoryPath);
  return git(repoRoot, ["show", `${commitSha}:${path}`], { encoding: "buffer" });
}

function listGitTree(repoRoot, targetSha) {
  const raw = git(repoRoot, ["ls-tree", "-r", "-z", targetSha], { encoding: "buffer" });
  return raw
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(\w+)\s+([0-9a-f]+)\t(.+)$/s);
      if (!match) throw new Error(`Malformed git ls-tree row: ${line}`);
      return { mode: match[1], type: match[2], object: match[3], path: normalizeRepositoryPath(match[4]) };
    });
}

export function computeCandidateTreeSha256(entries, readContent, excludedPaths = [DEFAULT_MANIFEST_PATH]) {
  const excluded = new Set(excludedPaths.map(normalizeRepositoryPath));
  const hash = createHash("sha256");
  for (const entry of [...entries].sort((a, b) => a.path.localeCompare(b.path, "en"))) {
    if (excluded.has(entry.path)) continue;
    hash.update(entry.mode ?? "100644");
    hash.update("\0");
    hash.update(entry.path);
    hash.update("\0");
    hash.update(sha256(readContent(entry.path)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function collectGitArtifactState({ repoRoot, baseRef, targetRef, manifest }) {
  const baseSha = resolveGitCommit(repoRoot, baseRef);
  const targetSha = resolveGitCommit(repoRoot, targetRef);
  const changedFiles = git(repoRoot, ["diff", "--name-only", `${baseSha}..${targetSha}`])
    .split(/\r?\n/)
    .filter(Boolean)
    .map(normalizeRepositoryPath);
  const readTargetFile = (path) => git(repoRoot, ["show", `${targetSha}:${path}`], { encoding: "buffer" });
  const files = new Map();
  for (const entry of manifest.files) {
    try {
      files.set(entry.path, readTargetFile(entry.path));
    } catch {
      // The validator reports missing content without trusting git stderr.
    }
  }
  const treeEntries = listGitTree(repoRoot, targetSha);
  const migrations = treeEntries
    .filter((entry) => MIGRATION_PATH_RE.test(entry.path))
    .sort((a, b) => a.path.localeCompare(b.path, "en"))
    .map((entry) => ({ path: entry.path, sha256: sha256(readTargetFile(entry.path)) }));
  const candidateTreeSha256 = computeCandidateTreeSha256(treeEntries, readTargetFile, [manifest.manifest_path]);
  return { baseSha, targetSha, changedFiles, files, migrations, candidateTreeSha256 };
}

function readCliArguments(argv) {
  const positional = [];
  let manifestPath = DEFAULT_MANIFEST_PATH;
  let expectedManifestSha256 = process.env.PRODUCTION_RELEASE_MANIFEST_SHA256 ?? "";
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--manifest") manifestPath = argv[++index] ?? "";
    else if (argv[index] === "--manifest-sha256") expectedManifestSha256 = argv[++index] ?? "";
    else positional.push(argv[index]);
  }
  return { baseRef: positional[0] ?? "origin/main", targetRef: positional[1] ?? "HEAD", manifestPath, expectedManifestSha256 };
}

function run() {
  try {
    const repoRoot = resolve(process.cwd());
    const args = readCliArguments(process.argv.slice(2));
    const rawManifest = readGitBlobAtCommit(repoRoot, args.targetRef, args.manifestPath);
    verifyManifestIntegrity(rawManifest, args.expectedManifestSha256);
    const manifest = validateManifestSchema(JSON.parse(rawManifest.toString("utf8")));
    const state = collectGitArtifactState({ repoRoot, baseRef: args.baseRef, targetRef: args.targetRef, manifest });
    const result = validateReleaseArtifactState(manifest, state);
    if (!result.ok) throw new Error(result.errors.join("\n"));
    console.log(`Exact Production release artifact verified: ${result.totalFiles} changed files, ${result.totalMigrations} migrations, tree ${state.candidateTreeSha256}.`);
  } catch (error) {
    console.error(`Production release artifact verification failed:\n${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) run();

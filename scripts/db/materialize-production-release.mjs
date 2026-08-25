import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCandidate } from "./build-production-release-candidate.mjs";
import {
  DEFAULT_MANIFEST_PATH,
  EXPECTED_BASE_MAIN_SHA,
  computeCandidateTreeSha256,
  normalizeRepositoryPath,
  sha256,
  validateReleaseArtifactState,
} from "./verify-production-release-artifact.mjs";

const STAGE_A_EXACT_FILES = Object.freeze([
  ".github/workflows/deploy-prod.yml",
  "docs/db-baseline/g2-r1-db-harness-remediation-report.md",
  "docs/db-baseline/main-g2-r1-rollout-plan.md",
  "docs/db-baseline/production-release-artifact-manifest.json",
  "scripts/db/build-production-release-candidate.mjs",
  "scripts/db/production-post-migration-inspect.sql",
  "scripts/db/repair-ai-chat-session-aggregates.sql",
  "scripts/db/tests/g2-r1-concurrency.integration.mjs",
  "scripts/db/tests/production-frontend-artifact.test.mjs",
  "scripts/db/tests/production-migration-state.test.mjs",
  "scripts/db/tests/production-post-migration.test.mjs",
  "scripts/db/tests/production-release-artifact.test.mjs",
  "scripts/db/tests/rollout-compatibility.test.mjs",
  "scripts/db/verify-production-frontend-artifact.mjs",
  "scripts/db/verify-production-migration-state.mjs",
  "scripts/db/verify-production-post-migration.mjs",
  "scripts/db/verify-production-release-artifact.mjs",
]);

function git(repoRoot, args, options = {}) {
  return execFileSync("git", ["-c", `safe.directory=${repoRoot.replaceAll("\\", "/")}`, "-C", repoRoot, ...args], {
    encoding: options.encoding ?? "utf8",
    input: options.input,
    maxBuffer: 64 * 1024 * 1024,
    stdio: options.stdio,
    env: options.env ?? process.env,
  });
}

export function materializeReleases({
  sourceRepo = process.cwd(),
  workspaceRoot = process.cwd(),
  manifestPath = DEFAULT_MANIFEST_PATH,
  stageABranch = "feat/production-release-stage-a",
  stageBBranch = "feat/production-release-stage-b",
} = {}) {
  const absoluteSourceRepo = resolve(sourceRepo);
  const absoluteWorkspaceRoot = resolve(workspaceRoot);
  const tempOutput = resolve(tmpdir(), "corelia-candidate-materialization");
  const manifest = JSON.parse(readFileSync(resolve(absoluteWorkspaceRoot, manifestPath), "utf8"));
  const expectedCandidateTreeSha256 = manifest.candidate_tree_sha256;

  console.log("===============================================================================");
  console.log(" CORELIA R4: IMMUTABLE RELEASE ARTIFACT MATERIALIZATION (LOCAL ONLY)");
  console.log("===============================================================================");

  // 1. Verify base Main commit exists
  const baseObjectKind = git(absoluteSourceRepo, ["cat-file", "-t", EXPECTED_BASE_MAIN_SHA]).trim();
  if (baseObjectKind !== "commit") {
    throw new Error(`Base Main ${EXPECTED_BASE_MAIN_SHA} is not a valid commit in ${absoluteSourceRepo}.`);
  }
  console.log(`✓ Base Main verified: ${EXPECTED_BASE_MAIN_SHA}`);

  // 2. Build and verify Stage B candidate in temp workspace
  console.log("Building isolated Stage B candidate from manifest...");
  const candidate = buildCandidate({
    sourceRepo: absoluteSourceRepo,
    workspaceRoot: absoluteWorkspaceRoot,
    manifestPath,
    output: tempOutput,
  });

  if (candidate.state.candidateTreeSha256 !== expectedCandidateTreeSha256) {
    throw new Error(
      `CANDIDATE_DRIFT_DETECTED: expected tree SHA-256 ${expectedCandidateTreeSha256}, got ${candidate.state.candidateTreeSha256}`,
    );
  }
  console.log(`✓ Candidate tree SHA-256 verified: ${candidate.state.candidateTreeSha256}`);
  console.log(`✓ Candidate total changed files: ${candidate.result.totalFiles}`);

  // 3. Create Stage A (Control-Plane Bootstrap) commit
  console.log("Materializing Stage A (Control-Plane Bootstrap)...");
  const stageATempDir = resolve(tmpdir(), "corelia-stage-a-materialization");
  if (existsSync(stageATempDir)) rmSync(stageATempDir, { recursive: true, force: true });
  mkdirSync(dirname(stageATempDir), { recursive: true });
  execFileSync("git", ["clone", "--shared", "--no-checkout", absoluteSourceRepo, stageATempDir], { stdio: "pipe" });
  git(stageATempDir, ["config", "core.autocrlf", "false"]);
  git(stageATempDir, ["checkout", "--detach", EXPECTED_BASE_MAIN_SHA]);

  // Copy Stage A files from workspace
  for (const relativePath of STAGE_A_EXACT_FILES) {
    const sourceFile = resolve(absoluteWorkspaceRoot, relativePath);
    if (!existsSync(sourceFile)) {
      throw new Error(`Required Stage A file is missing: ${relativePath}`);
    }
    const targetFile = resolve(stageATempDir, relativePath);
    mkdirSync(dirname(targetFile), { recursive: true });
    const content = readFileSync(sourceFile);
    git(stageATempDir, ["hash-object", "-w", "--stdin"], { input: content });
    // Add to index
    const blobHash = sha256(content);
    const gitBlobSha = execFileSync(
      "git",
      ["-C", stageATempDir, "hash-object", "-w", "--stdin"],
      { input: content, encoding: "utf8" },
    ).trim();
    git(stageATempDir, ["update-index", "--add", "--cacheinfo", "100644", gitBlobSha, relativePath]);
  }

  // Write Stage A tree and commit
  const stageATreeSha = git(stageATempDir, ["write-tree"]).trim();
  const stageACommitMessage = `chore(release): bootstrap production deployment control-plane (Stage A)

Control-plane bootstrap commit introducing safe deployment workflow,
migration pre-state guard, live DB post-gate, release manifest verifier,
and rollback documentation.

Base Main: ${EXPECTED_BASE_MAIN_SHA}
Runtime Application Delta: 0 bytes (0 files in src/, public/, supabase/migrations/, supabase/functions/)
`;
  const stageACommitSha = git(stageATempDir, [
    "commit-tree",
    stageATreeSha,
    "-p",
    EXPECTED_BASE_MAIN_SHA,
    "-m",
    stageACommitMessage,
  ]).trim();

  // Fetch Stage A commit and branch into main repo
  git(absoluteSourceRepo, ["fetch", stageATempDir, `+${stageACommitSha}:refs/heads/${stageABranch}`]);
  console.log(`✓ Stage A commit materialized: ${stageACommitSha} (${stageABranch})`);

  // Verify Stage A runtime neutrality
  const stageADiff = git(absoluteSourceRepo, [
    "diff",
    "--name-only",
    EXPECTED_BASE_MAIN_SHA,
    stageACommitSha,
  ])
    .split(/\r?\n/)
    .filter(Boolean)
    .map(normalizeRepositoryPath);

  const forbiddenRuntimePatterns = [/^(src|public|supabase\/migrations|supabase\/functions)\//];
  for (const file of stageADiff) {
    if (forbiddenRuntimePatterns.some((pattern) => pattern.test(file))) {
      throw new Error(`Stage A contains forbidden runtime file: ${file}`);
    }
  }
  console.log(`✓ Stage A runtime delta verified: 0 runtime files (total ${stageADiff.length} control-plane files)`);

  // 4. Create Stage B (Isolated G2 Application) commit on top of Stage A
  console.log("Materializing Stage B (Isolated G2 Application Release)...");
  // Fetch Stage A into candidate repo so it can be used as parent
  git(candidate.candidateRoot, ["fetch", stageATempDir, `${stageACommitSha}:refs/heads/${stageABranch}`]);
  const stageBTreeSha = git(candidate.candidateRoot, ["write-tree"]).trim();
  const stageBCommitMessage = `feat(release): isolated G2 application release candidate (Stage B)

Materialized release candidate containing the approved Wave 0 / M1 / G2 / G2-R1 / R4 delta:
- 14 forward migrations (20260823120000 .. 20260825153000)
- Edge Functions: corelia-api and 7 retired AI tombstones
- Frontend, payment/refund, entitlement, catalog reconciliation, and release-control changes
- Candidate tree SHA-256: ${expectedCandidateTreeSha256}

Base Main: ${EXPECTED_BASE_MAIN_SHA}
Stage A Parent: ${stageACommitSha}
Release Manifest: ${manifestPath}
`;
  const stageBCommitSha = git(candidate.candidateRoot, [
    "commit-tree",
    stageBTreeSha,
    "-p",
    stageACommitSha,
    "-m",
    stageBCommitMessage,
  ]).trim();

  git(absoluteSourceRepo, ["fetch", candidate.candidateRoot, `+${stageBCommitSha}:refs/heads/${stageBBranch}`]);
  console.log(`✓ Stage B commit materialized: ${stageBCommitSha} (${stageBBranch})`);

  // 5. Verify Stage B candidate tree SHA-256 directly from the created commit
  const rawIndex = git(absoluteSourceRepo, ["ls-tree", "-r", stageBCommitSha]);
  const stageBChangedAgainstMain = git(absoluteSourceRepo, [
    "diff",
    "--name-only",
    EXPECTED_BASE_MAIN_SHA,
    stageBCommitSha,
  ])
    .split(/\r?\n/)
    .filter(Boolean)
    .map(normalizeRepositoryPath);

  console.log(`✓ Stage B changed files against base Main: ${stageBChangedAgainstMain.length}`);

  // Re-verify release artifact validator against Stage B commit
  const entries = git(absoluteSourceRepo, ["ls-tree", "-r", "-z", stageBCommitSha], { encoding: "buffer" })
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(\w+)\s+([0-9a-f]+)\t(.+)$/s);
      if (!match) throw new Error(`Malformed ls-tree line: ${line}`);
      return { mode: match[1], object: match[3], path: normalizeRepositoryPath(match[4]) };
    });

  const readObject = (path) => git(absoluteSourceRepo, ["show", `${stageBCommitSha}:${path}`], { encoding: "buffer" });
  const recomputedTreeSha = computeCandidateTreeSha256(entries, readObject, [manifest.manifest_path]);

  if (recomputedTreeSha !== expectedCandidateTreeSha256) {
    throw new Error(
      `Stage B recomputed tree SHA-256 mismatch: expected ${expectedCandidateTreeSha256}, got ${recomputedTreeSha}`,
    );
  }
  console.log(`✓ Stage B recomputed tree SHA-256: ${recomputedTreeSha}`);

  // Clean temp directories
  rmSync(tempOutput, { recursive: true, force: true });
  rmSync(stageATempDir, { recursive: true, force: true });

  return {
    baseMainSha: EXPECTED_BASE_MAIN_SHA,
    candidateTreeSha256: expectedCandidateTreeSha256,
    stageA: {
      sha: stageACommitSha,
      branch: stageABranch,
      files: stageADiff,
      runtimeFilesCount: 0,
    },
    stageB: {
      sha: stageBCommitSha,
      branch: stageBBranch,
      totalFiles: stageBChangedAgainstMain.length,
      candidateTreeSha256: recomputedTreeSha,
    },
  };
}

function run() {
  try {
    const result = materializeReleases();
    console.log("\n===============================================================================");
    console.log(" MATERIALIZATION SUCCESSFUL (LOCAL REFS CREATED)");
    console.log("===============================================================================");
    console.log(`Base Main SHA:       ${result.baseMainSha}`);
    console.log(`Candidate Tree Hash: ${result.candidateTreeSha256}`);
    console.log(`Stage A Commit SHA:  ${result.stageA.sha} (${result.stageA.branch})`);
    console.log(`Stage A Files:       ${result.stageA.files.length} (Runtime delta: 0)`);
    console.log(`Stage B Commit SHA:  ${result.stageB.sha} (${result.stageB.branch})`);
    console.log(`Stage B Files:       ${result.stageB.totalFiles}`);
    console.log("===============================================================================");
  } catch (error) {
    console.error(`Materialization failed:\n${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  run();
}

import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, parse, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_MANIFEST_PATH,
  computeCandidateTreeSha256,
  normalizeRepositoryPath,
  sha256,
  validateManifestSchema,
  validateReleaseArtifactState,
} from "./verify-production-release-artifact.mjs";

function git(repoRoot, args, options = {}) {
  return execFileSync("git", ["-c", `safe.directory=${repoRoot.replaceAll("\\", "/")}`, "-C", repoRoot, ...args], {
    encoding: options.encoding ?? "utf8",
    input: options.input,
    maxBuffer: 64 * 1024 * 1024,
    stdio: options.stdio,
  });
}

function parseArgs(argv) {
  const result = {
    sourceRepo: process.cwd(),
    workspaceRoot: process.cwd(),
    manifestPath: DEFAULT_MANIFEST_PATH,
    output: "",
    printState: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--source-repo") result.sourceRepo = argv[++index] ?? "";
    else if (value === "--workspace-root") result.workspaceRoot = argv[++index] ?? "";
    else if (value === "--manifest") result.manifestPath = argv[++index] ?? "";
    else if (value === "--output") result.output = argv[++index] ?? "";
    else if (value === "--print-state") result.printState = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!result.output) throw new Error("--output is required.");
  return result;
}

function assertGitObject(repoRoot, sha, kind) {
  const actual = git(repoRoot, ["cat-file", "-t", sha]).trim();
  if (actual !== kind) throw new Error(`Expected ${sha} to be a ${kind}, got ${actual}.`);
}

function canonicalizeWithExistingAncestor(targetPath) {
  const missingSegments = [];
  let cursor = resolve(targetPath);
  while (!existsSync(cursor)) {
    const parent = dirname(cursor);
    if (parent === cursor) throw new Error(`Cannot resolve an existing ancestor for candidate output: ${targetPath}`);
    missingSegments.unshift(cursor.slice(parent.length).replace(/^[/\\]+/, ""));
    cursor = parent;
  }
  if (lstatSync(cursor).isSymbolicLink()) throw new Error(`Candidate output ancestor is a symlink or junction: ${cursor}`);
  let canonical = realpathSync.native(cursor);
  for (const segment of missingSegments) canonical = resolve(canonical, segment);
  return canonical;
}

export function assertSafeOutputPath({ output, sourceRepo, workspaceRoot, cwd = process.cwd(), tempRoot = tmpdir() }) {
  if (!output || typeof output !== "string") throw new Error("Candidate output path must be a non-empty string.");
  const resolvedOutput = resolve(output);
  const canonicalTemp = realpathSync.native(resolve(tempRoot));
  const canonicalOutput = canonicalizeWithExistingAncestor(resolvedOutput);
  const outputRelativeToTemp = relative(canonicalTemp, canonicalOutput);
  if (!outputRelativeToTemp || outputRelativeToTemp.startsWith(`..`) || isAbsolute(outputRelativeToTemp)) {
    throw new Error(`Candidate output must be a strict descendant of the OS temp directory: ${canonicalTemp}`);
  }

  const protectedRoots = [
    realpathSync.native(resolve(sourceRepo)),
    realpathSync.native(resolve(workspaceRoot)),
    realpathSync.native(resolve(cwd)),
  ];
  const overlaps = (left, right) => {
    const leftToRight = relative(left, right);
    const rightToLeft = relative(right, left);
    const contains = (value) => value === "" || (!value.startsWith("..") && !isAbsolute(value));
    return contains(leftToRight) || contains(rightToLeft);
  };
  if (
    canonicalOutput.toLowerCase() === canonicalTemp.toLowerCase() ||
    canonicalOutput.toLowerCase() === parse(canonicalOutput).root.toLowerCase() ||
    protectedRoots.some((path) => overlaps(path, canonicalOutput))
  ) {
    throw new Error(`Candidate output resolves to a protected path: ${canonicalOutput}`);
  }

  let cursor = canonicalTemp;
  for (const segment of outputRelativeToTemp.split(/[\\/]+/)) {
    cursor = resolve(cursor, segment);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) {
      throw new Error(`Candidate output path traverses a symlink or junction: ${cursor}`);
    }
  }
  return canonicalOutput;
}

function applyExactPatch(sourceRepo, candidateRoot, patch) {
  assertGitObject(sourceRepo, patch.parent, "commit");
  assertGitObject(sourceRepo, patch.commit, "commit");
  const actualParent = git(sourceRepo, ["rev-parse", `${patch.commit}^`]).trim();
  if (actualParent !== patch.parent) throw new Error(`Patch parent mismatch for ${patch.commit}.`);
  const diff = git(sourceRepo, ["diff", "--binary", patch.parent, patch.commit, "--", ...patch.paths], { encoding: "buffer" });
  if (diff.length === 0) throw new Error(`Patch ${patch.commit} produced an empty diff for its exact path list.`);
  const applied = spawnSync("git", ["-C", candidateRoot, "apply", "--index", "--whitespace=nowarn", "-"], {
    input: diff,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (applied.status !== 0) {
    throw new Error(`Failed to apply exact patch ${patch.commit}: ${applied.stderr?.toString("utf8") ?? "unknown error"}`);
  }
}

function copyWorkspaceFile(workspaceRoot, candidateRoot, entry, verifyHash = true) {
  const source = resolve(workspaceRoot, entry.path);
  if (!existsSync(source)) throw new Error(`Stage A workspace file is missing: ${entry.path}`);
  const actualHash = sha256(readFileSync(source));
  if (verifyHash && actualHash !== entry.sha256) {
    throw new Error(`Stage A workspace SHA-256 mismatch for ${entry.path}: expected ${entry.sha256}, got ${actualHash}.`);
  }
  const target = resolve(candidateRoot, entry.path);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target);
}

function readIndexFile(candidateRoot, path) {
  return git(candidateRoot, ["show", `:${path}`], { encoding: "buffer" });
}

function listIndexEntries(candidateRoot) {
  const raw = git(candidateRoot, ["ls-files", "-s", "-z"], { encoding: "buffer" });
  return raw
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+([0-9a-f]+)\s+0\t(.+)$/s);
      if (!match) throw new Error(`Malformed git index row: ${line}`);
      return { mode: match[1], object: match[2], path: normalizeRepositoryPath(match[3]) };
    });
}

export function collectCandidateIndexState(candidateRoot, manifest) {
  const changedFiles = git(candidateRoot, ["diff", "--cached", "--name-only", manifest.base_sha])
    .split(/\r?\n/)
    .filter(Boolean)
    .map(normalizeRepositoryPath);
  const entries = listIndexEntries(candidateRoot);
  const files = new Map();
  for (const path of changedFiles) {
    if (path === manifest.manifest_path) continue;
    try {
      files.set(path, readIndexFile(candidateRoot, path));
    } catch {
      // Validation reports missing content.
    }
  }
  const migrations = entries
    .filter((entry) => /^supabase\/migrations\/\d{14}_[^/]+\.sql$/.test(entry.path))
    .sort((a, b) => a.path.localeCompare(b.path, "en"))
    .map((entry) => ({ path: entry.path, sha256: sha256(readIndexFile(candidateRoot, entry.path)) }));
  const candidateTreeSha256 = computeCandidateTreeSha256(entries, (path) => readIndexFile(candidateRoot, path), [manifest.manifest_path]);
  return { baseSha: manifest.base_sha, changedFiles, files, migrations, candidateTreeSha256 };
}

export function buildCandidate({ sourceRepo, workspaceRoot, manifestPath, output, printState = false }) {
  const absoluteSourceRepo = resolve(sourceRepo);
  const absoluteWorkspaceRoot = resolve(workspaceRoot);
  const absoluteManifestPath = resolve(absoluteWorkspaceRoot, manifestPath);
  const manifest = JSON.parse(readFileSync(absoluteManifestPath, "utf8"));
  if (!printState) validateManifestSchema(manifest);

  const candidateRoot = assertSafeOutputPath({ output, sourceRepo: absoluteSourceRepo, workspaceRoot: absoluteWorkspaceRoot });
  if (existsSync(candidateRoot)) rmSync(candidateRoot, { recursive: true, force: true });
  mkdirSync(dirname(candidateRoot), { recursive: true });
  execFileSync("git", ["clone", "--shared", "--no-checkout", absoluteSourceRepo, candidateRoot], { stdio: "pipe" });
  git(candidateRoot, ["config", "core.autocrlf", "false"]);
  git(candidateRoot, ["checkout", "--detach", manifest.base_sha]);

  for (const patch of manifest.recipe.patches) applyExactPatch(absoluteSourceRepo, candidateRoot, patch);
  for (const entry of manifest.recipe.materialized_files) {
    assertGitObject(absoluteSourceRepo, entry.source_sha, "commit");
    git(candidateRoot, ["checkout", entry.source_sha, "--", entry.path]);
    const actualHash = sha256(readIndexFile(candidateRoot, entry.path));
    if (!printState && actualHash !== entry.sha256) {
      throw new Error(`Materialized SHA-256 mismatch for ${entry.path}: expected ${entry.sha256}, got ${actualHash}.`);
    }
  }
  for (const entry of manifest.recipe.workspace_files) copyWorkspaceFile(absoluteWorkspaceRoot, candidateRoot, entry, !printState);
  const targetManifest = resolve(candidateRoot, manifest.manifest_path);
  mkdirSync(dirname(targetManifest), { recursive: true });
  cpSync(absoluteManifestPath, targetManifest);
  git(candidateRoot, ["add", "--all"]);

  const state = collectCandidateIndexState(candidateRoot, manifest);
  if (printState) return { candidateRoot, state };
  const result = validateReleaseArtifactState(manifest, state);
  if (!result.ok) throw new Error(result.errors.join("\n"));
  return { candidateRoot, state, result };
}

function run() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = buildCandidate(args);
    if (args.printState) {
      const serializable = {
        changedFiles: result.state.changedFiles,
        files: [...result.state.files].map(([path, content]) => ({ path, sha256: sha256(content) })),
        migrations: result.state.migrations,
        candidateTreeSha256: result.state.candidateTreeSha256,
      };
      console.log(JSON.stringify(serializable, null, 2));
    } else {
      console.log(`R4_RELEASE_CANDIDATE built at ${result.candidateRoot}`);
      console.log(`Changed files: ${result.result.totalFiles}`);
      console.log(`Migrations: ${result.result.totalMigrations}`);
      console.log(`Candidate tree SHA-256: ${result.state.candidateTreeSha256}`);
    }
  } catch (error) {
    console.error(`Production release candidate build failed:\n${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) run();

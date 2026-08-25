#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  computeCandidateTreeSha256,
  DEFAULT_MANIFEST_PATH,
  EXPECTED_BASE_MAIN_SHA,
  EXPECTED_BASELINE_MIGRATION_COUNT,
  EXPECTED_FORWARD_MIGRATIONS,
  normalizeRepositoryPath,
  sha256,
  validateManifestSchema,
} from "./verify-production-release-artifact.mjs";

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: options.encoding ?? "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

export function generateCanonicalManifest() {
  const baseSha = EXPECTED_BASE_MAIN_SHA;
  const targetRef = "HEAD";

  // 1. Get raw diff against baseSha from git index / HEAD
  const diffRaw = git(["diff", "--name-status", `${baseSha}..${targetRef}`]);
  const diffLines = diffRaw.split(/\r?\n/).filter(Boolean);

  const presentFiles = [];
  const deletedFiles = [];

  const readBlob = (path) => git(["show", `${targetRef}:${path}`], { encoding: "buffer" });

  for (const line of diffLines) {
    const [status, ...rest] = line.split(/\t+/);
    const path = normalizeRepositoryPath(rest.join("\t"));
    if (path === DEFAULT_MANIFEST_PATH) continue;

    if (status.startsWith("D")) {
      deletedFiles.push(path);
    } else {
      // Added or Modified in targetRef
      const content = readBlob(path);
      const hash = sha256(content);
      presentFiles.push({ path, sha256: hash });
    }
  }

  presentFiles.sort((a, b) => a.path.localeCompare(b.path, "en"));
  deletedFiles.sort((a, b) => a.localeCompare(b, "en"));

  // 2. Baseline manifest
  const baselineJsonBuffer = readBlob("docs/db-baseline/baseline.json");
  const baselineJsonSha = sha256(baselineJsonBuffer);

  // 3. Forward migrations
  const forwardEntries = EXPECTED_FORWARD_MIGRATIONS.map((p) => {
    const content = readBlob(p);
    return { path: p, sha256: sha256(content) };
  });

  // 4. Candidate tree sha256 from targetRef tree
  const rawTree = git(["ls-tree", "-r", "-z", targetRef], { encoding: "buffer" });
  const treeEntries = rawTree
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(\w+)\s+([0-9a-f]+)\t(.+)$/s);
      if (!match) throw new Error(`Malformed ls-tree row: ${line}`);
      return { mode: match[1], type: match[2], object: match[3], path: normalizeRepositoryPath(match[4]) };
    });

  const candidateTreeSha256 = computeCandidateTreeSha256(treeEntries, readBlob, [DEFAULT_MANIFEST_PATH]);

  const manifest = {
    schema_version: 1,
    artifact_id: "R4_RELEASE_CANDIDATE",
    base_sha: baseSha,
    source_sha: "8ec46f7aefde86f9eb4fb98a803f66b5ef85dcfa",
    manifest_path: DEFAULT_MANIFEST_PATH,
    candidate_tree_sha256: candidateTreeSha256,
    recipe: {
      patches: [],
      materialized_files: [],
      workspace_files: [],
    },
    files: presentFiles,
    deleted_files: deletedFiles,
    migration_chain: {
      baseline_manifest: {
        path: "docs/db-baseline/baseline.json",
        sha256: baselineJsonSha,
        count: EXPECTED_BASELINE_MIGRATION_COUNT,
        latest: "20260818120000_clean_legacy_manual_mint_templates.sql",
      },
      forward: forwardEntries,
    },
  };

  validateManifestSchema(manifest);

  const manifestJson = JSON.stringify(manifest, null, 2) + "\n";
  writeFileSync(resolve(DEFAULT_MANIFEST_PATH), manifestJson, "utf8");

  const manifestHash = sha256(Buffer.from(manifestJson, "utf8"));

  console.log("==================================================================");
  console.log(" GENERATED CANONICAL PRODUCTION RELEASE MANIFEST");
  console.log("==================================================================");
  console.log(`Base SHA:              ${baseSha}`);
  console.log(`Present files:         ${presentFiles.length}`);
  console.log(`Deleted files:         ${deletedFiles.length}`);
  console.log(`Candidate tree SHA256: ${candidateTreeSha256}`);
  console.log(`Manifest SHA256:       ${manifestHash}`);
  console.log("==================================================================");
  return { manifest, manifestHash, candidateTreeSha256 };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"))) {
  generateCanonicalManifest();
}

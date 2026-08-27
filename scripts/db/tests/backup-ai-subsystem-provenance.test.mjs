import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  AI_TABLE_REGISTRY,
  computeSourceFingerprint,
  executeAiBackup,
  fetchAllTableDataFromSupabaseLinked,
  fetchTableDataFromLocalPostgres,
  parseAiBackupCliArgs,
} from "../backup-ai-subsystem.mjs";
import {
  buildRestoreInsertSql,
  parseRestoreCliArgs,
  sha256 as restoreSha256,
  verifyAiBackupDirectory,
} from "../verify-ai-backup-restore.mjs";

const PROJECT_REF = "abcdefghijklmnopqrst";
const OTHER_PROJECT_REF = "tsrqponmlkjihgfedcba";
const GIT_HEAD_SHA = "0123456789abcdef0123456789abcdef01234567";
const cleanGit = () => "";

function writeLinkedState(
  root,
  { metadataRef = PROJECT_REF, cliRef = PROJECT_REF, includeMetadata = true } = {},
) {
  const tempDir = join(root, "supabase", ".temp");
  mkdirSync(tempDir, { recursive: true });
  if (includeMetadata) {
    writeFileSync(join(tempDir, "linked-project.json"), JSON.stringify({
      ref: metadataRef,
      name: "corelia-app",
      organization_id: "corelia-org",
      database_url: "postgresql://user:super-secret-password@example.invalid/postgres",
      access_token: "secret-access-token",
      service_role_key: "secret-service-role-key",
    }), "utf8");
  }
  writeFileSync(join(tempDir, "project-ref"), `${cliRef}\n`, "utf8");
}

function emptySnapshot() {
  return Object.fromEntries(AI_TABLE_REGISTRY.map(({ name }) => [name, []]));
}

function linkedResult(snapshot = emptySnapshot()) {
  return JSON.stringify({ rows: [{ data: snapshot }] });
}

function linkedBackupOptions(root, targetDir, overrides = {}) {
  return {
    targetDir,
    workspaceRoot: root,
    environment: "production",
    useLinkedSupabase: true,
    expectedProjectRef: PROJECT_REF,
    gitHeadSha: GIT_HEAD_SHA,
    gitCommandRunner: cleanGit,
    linkedCommandRunner: () => linkedResult(),
    ...overrides,
  };
}

test("CLI normalizes environment labels and cannot bypass linked requirements with case", () => {
  for (const value of ["production", "Production", " PRODUCTION ", "staging", "STAGING"]) {
    assert.throws(() => parseAiBackupCliArgs(["--environment", value]), /requires --linked/);
  }
  assert.throws(() => parseAiBackupCliArgs(["--linked"]), /requires --environment/);
  assert.throws(
    () => parseAiBackupCliArgs(["--linked", "--environment", "production"]),
    /requires --expected-project-ref/,
  );
  assert.deepEqual(parseAiBackupCliArgs([
    "--linked", "--environment", "STAGING", "--expected-project-ref", PROJECT_REF,
  ]), { environment: "staging", expectedProjectRef: PROJECT_REF, useLinkedSupabase: true });
});

test("metadata/project-ref A-B divergence aborts before query and output", () => {
  const root = mkdtempSync(join(tmpdir(), "corelia-ai-linked-divergence-"));
  try {
    writeLinkedState(root, { metadataRef: PROJECT_REF, cliRef: OTHER_PROJECT_REF });
    const target = join(root, "backup");
    let calls = 0;
    assert.throws(() => executeAiBackup(linkedBackupOptions(root, target, {
      linkedCommandRunner: () => { calls += 1; return linkedResult(); },
    })), /exact expected project ref/);
    assert.equal(calls, 0);
    assert.equal(existsSync(target), false);
    assert.equal(readdirSync(root).some((name) => name.includes(".partial-")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("canonical project-ref works without optional linked-project enrichment", () => {
  const root = mkdtempSync(join(tmpdir(), "corelia-ai-project-ref-only-"));
  try {
    writeLinkedState(root, { includeMetadata: false });
    const result = executeAiBackup(linkedBackupOptions(root, join(root, "backup")));
    assert.equal(result.manifest.provenance.project_ref, PROJECT_REF);
    assert.equal(result.manifest.provenance.project_name, null);
    assert.equal(result.manifest.provenance.organization_id, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("linked identity is checked again after export and divergence publishes nothing", () => {
  const root = mkdtempSync(join(tmpdir(), "corelia-ai-linked-postcheck-"));
  try {
    writeLinkedState(root);
    const target = join(root, "backup");
    assert.throws(() => executeAiBackup(linkedBackupOptions(root, target, {
      linkedCommandRunner: () => {
        writeFileSync(join(root, "supabase", ".temp", "project-ref"), OTHER_PROJECT_REF, "utf8");
        return linkedResult();
      },
    })), /exact expected project ref/);
    assert.equal(existsSync(target), false);
    assert.equal(readdirSync(root).some((name) => name.includes(".partial-")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("linked export uses one statement and validates all 18 table arrays", () => {
  const root = mkdtempSync(join(tmpdir(), "corelia-ai-one-snapshot-"));
  try {
    let calls = 0;
    let command = "";
    let sql = "";
    let isolatedWorkdir = "";
    let boundProjectRef = "";
    const result = fetchAllTableDataFromSupabaseLinked({
      workspaceRoot: root,
      tempDirectory: root,
      expectedProjectRef: PROJECT_REF,
      commandRunner: (cmd, options) => {
        calls += 1;
        command = cmd;
        isolatedWorkdir = options.cwd;
        boundProjectRef = readFileSync(join(options.cwd, "supabase", ".temp", "project-ref"), "utf8").trim();
        const fileMatch = cmd.match(/--file "([^"]+)"/);
        sql = readFileSync(fileMatch[1], "utf8");
        return linkedResult();
      },
    });
    assert.equal(calls, 1);
    assert.match(command, /supabase(?:\.cmd)?" db query --linked --file/);
    assert.notEqual(isolatedWorkdir, root);
    assert.equal(boundProjectRef, PROJECT_REF);
    assert.equal(existsSync(isolatedWorkdir), false, "Isolated linked-query workdir is removed after export");
    assert.equal((sql.match(/;/g) || []).length, 1, "The export is one PostgreSQL statement");
    for (const { name } of AI_TABLE_REGISTRY) assert.ok(sql.includes(`public.${name}`));
    assert.deepEqual(Object.keys(result).sort(), AI_TABLE_REGISTRY.map(({ name }) => name).sort());

    const malformed = emptySnapshot();
    delete malformed.ai_subscriptions;
    assert.throws(() => fetchAllTableDataFromSupabaseLinked({
      workspaceRoot: root,
      tempDirectory: root,
      expectedProjectRef: PROJECT_REF,
      commandRunner: () => linkedResult(malformed),
    }), /snapshot query failed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("linked failure is sanitized and leaves no final or partial artifact", () => {
  const root = mkdtempSync(join(tmpdir(), "corelia-ai-linked-failure-"));
  try {
    writeLinkedState(root);
    const target = join(root, "backup");
    assert.throws(() => executeAiBackup(linkedBackupOptions(root, target, {
      linkedCommandRunner: () => { throw new Error("token=secret-access-token"); },
    })), (error) => {
      assert.match(error.message, /snapshot query failed/);
      assert.equal(error.message.includes("secret-access-token"), false);
      return true;
    });
    assert.equal(existsSync(target), false);
    assert.equal(readdirSync(root).some((name) => name.includes(".partial-")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("mid-write failure cleans the partial directory and publishes no final artifact", () => {
  const root = mkdtempSync(join(tmpdir(), "corelia-ai-mid-write-failure-"));
  try {
    const target = join(root, "backup");
    let calls = 0;
    assert.throws(() => executeAiBackup({
      targetDir: target,
      environment: "test",
      useLivePostgres: false,
      gitHeadSha: GIT_HEAD_SHA,
      tableDataFetcher: () => {
        calls += 1;
        if (calls === 2) throw new Error("fixture failed with secret-token");
        return [];
      },
    }), (error) => {
      assert.match(error.message, /Custom table data fetch failed/);
      assert.equal(error.message.includes("secret-token"), false);
      return true;
    });
    assert.equal(existsSync(target), false);
    assert.equal(readdirSync(root).some((name) => name.includes(".partial-")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("linked backup requires a clean worktree and refuses an existing final target", () => {
  const root = mkdtempSync(join(tmpdir(), "corelia-ai-clean-target-"));
  try {
    writeLinkedState(root);
    const target = join(root, "backup");
    assert.throws(() => executeAiBackup(linkedBackupOptions(root, target, {
      gitCommandRunner: () => " M scripts/db/backup-ai-subsystem.mjs",
    })), /clean Git worktree/);
    mkdirSync(target);
    assert.throws(() => executeAiBackup(linkedBackupOptions(root, target)), /Refusing to overwrite/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("local PostgreSQL failures throw instead of becoming empty rows", () => {
  assert.throws(
    () => fetchTableDataFromLocalPostgres("ai_subscriptions", () => { throw new Error("docker failed secret-token"); }),
    /Local PostgreSQL query failed for table ai_subscriptions/,
  );
});

test("schema v2 linked manifest contains deterministic non-secret provenance", () => {
  const root = mkdtempSync(join(tmpdir(), "corelia-ai-v2-provenance-"));
  try {
    writeLinkedState(root);
    const result = executeAiBackup(linkedBackupOptions(root, join(root, "backup")));
    assert.equal(result.manifest.schema_version, 2);
    assert.equal(result.manifest.provenance.project_ref, PROJECT_REF);
    assert.equal(result.manifest.provenance.environment, "production");
    assert.match(result.manifest.provenance.git_head_sha, /^[0-9a-f]{40}$/);
    assert.match(result.manifest.provenance.source_fingerprint_sha256, /^[0-9a-f]{64}$/);
    assert.equal(verifyAiBackupDirectory(result.backupDir).ok, false);
    const manifestDigest = restoreSha256(readFileSync(result.manifestPath));
    assert.equal(verifyAiBackupDirectory(result.backupDir, {
      expectedEnvironment: "production",
      expectedProjectRef: PROJECT_REF,
      expectedManifestSha256: manifestDigest,
    }).ok, true);
    for (const wrongExpectation of [
      { expectedEnvironment: "staging", expectedProjectRef: PROJECT_REF },
      { expectedEnvironment: "production", expectedProjectRef: OTHER_PROJECT_REF },
      {
        expectedEnvironment: "production",
        expectedProjectRef: PROJECT_REF,
        expectedManifestSha256: "0".repeat(64),
      },
    ]) {
      assert.equal(verifyAiBackupDirectory(result.backupDir, wrongExpectation).ok, false);
    }
    const text = readFileSync(result.manifestPath, "utf8");
    for (const secret of ["super-secret-password", "secret-access-token", "secret-service-role-key", "postgresql://"]) {
      assert.equal(text.includes(secret), false);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("restore verifier rejects missing or tampered v2 provenance", () => {
  const root = mkdtempSync(join(tmpdir(), "corelia-ai-v2-tamper-"));
  try {
    const result = executeAiBackup({
      targetDir: join(root, "backup"), environment: "test", useLivePostgres: false,
      tableDataFetcher: () => [], gitHeadSha: GIT_HEAD_SHA,
    });
    delete result.manifest.provenance;
    writeFileSync(result.manifestPath, JSON.stringify(result.manifest, null, 2));
    assert.equal(verifyAiBackupDirectory(result.backupDir).ok, false);

    const result2 = executeAiBackup({
      targetDir: join(root, "backup2"), environment: "test", useLivePostgres: false,
      tableDataFetcher: () => [], gitHeadSha: GIT_HEAD_SHA,
    });
    result2.manifest.provenance.environment = "tampered";
    writeFileSync(result2.manifestPath, JSON.stringify(result2.manifest, null, 2));
    assert.ok(verifyAiBackupDirectory(result2.backupDir).errors.some((error) => error.includes("fingerprint mismatch")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("historical schema v1 local/test remains compatible but cannot prove production provenance", () => {
  const root = mkdtempSync(join(tmpdir(), "corelia-ai-v1-compat-"));
  try {
    const result = executeAiBackup({
      targetDir: join(root, "backup"), environment: "test", useLivePostgres: false,
      tableDataFetcher: () => [], gitHeadSha: GIT_HEAD_SHA,
    });
    result.manifest.schema_version = 1;
    delete result.manifest.provenance;
    writeFileSync(result.manifestPath, JSON.stringify(result.manifest, null, 2));
    assert.equal(verifyAiBackupDirectory(result.backupDir).ok, true);
    result.manifest.environment = "production";
    writeFileSync(result.manifestPath, JSON.stringify(result.manifest, null, 2));
    assert.ok(verifyAiBackupDirectory(result.backupDir).errors.some((error) => error.includes("restricted")));
    result.manifest.environment = " production ";
    writeFileSync(result.manifestPath, JSON.stringify(result.manifest, null, 2));
    assert.ok(verifyAiBackupDirectory(result.backupDir).errors.some((error) => error.includes("restricted")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("schema v2 verifier rejects case/whitespace relabeling even with a recomputed fingerprint", () => {
  const root = mkdtempSync(join(tmpdir(), "corelia-ai-v2-case-bypass-"));
  try {
    const result = executeAiBackup({
      targetDir: join(root, "backup"), environment: "test", useLivePostgres: false,
      tableDataFetcher: () => [], gitHeadSha: GIT_HEAD_SHA,
    });
    result.manifest.environment = "Production";
    result.manifest.provenance.environment = "Production";
    result.manifest.provenance.source_fingerprint_sha256 = computeSourceFingerprint(result.manifest.provenance);
    writeFileSync(result.manifestPath, JSON.stringify(result.manifest, null, 2));
    const verification = verifyAiBackupDirectory(result.backupDir);
    assert.equal(verification.ok, false);
    assert.ok(verification.errors.some((error) => error.includes("canonical lowercase")));
    assert.ok(verification.errors.some((error) => error.includes("must use linked source mode")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("restore CLI accepts positional and --restore-dir forms; generated instruction is positional", () => {
  assert.deepEqual(parseRestoreCliArgs(["C:/backup"]), {
    backupDir: "C:/backup",
    verificationOptions: {},
  });
  assert.deepEqual(parseRestoreCliArgs([
    "--restore-dir", "C:/backup",
    "--expected-environment", "production",
    "--expected-project-ref", PROJECT_REF,
    "--expected-manifest-sha256", "a".repeat(64),
  ]), {
    backupDir: "C:/backup",
    verificationOptions: {
      expectedEnvironment: "production",
      expectedProjectRef: PROJECT_REF,
      expectedManifestSha256: "a".repeat(64),
    },
  });
  assert.throws(() => parseRestoreCliArgs([]), /Usage/);
  const root = mkdtempSync(join(tmpdir(), "corelia-ai-restore-instruction-"));
  try {
    const result = executeAiBackup({
      targetDir: join(root, "backup"), environment: "test", useLivePostgres: false,
      tableDataFetcher: () => [], gitHeadSha: GIT_HEAD_SHA,
    });
    assert.ok(result.manifest.restore_instructions.some((line) => line.includes(
      "verify-ai-backup-restore.mjs <backup_dir> --expected-environment test",
    )));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("restore verifier rejects traversal, junction escape, and duplicate file mappings", (t) => {
  const root = mkdtempSync(join(tmpdir(), "corelia-ai-restore-paths-"));
  try {
    const traversal = executeAiBackup({
      targetDir: join(root, "traversal"), environment: "test", useLivePostgres: false,
      tableDataFetcher: () => [], gitHeadSha: GIT_HEAD_SHA,
    });
    const traversalEntry = traversal.manifest.tables[0];
    const outsideFile = join(root, "outside.json");
    copyFileSync(join(traversal.backupDir, traversalEntry.file), outsideFile);
    traversalEntry.file = "../outside.json";
    traversalEntry.sha256 = restoreSha256(readFileSync(outsideFile));
    writeFileSync(traversal.manifestPath, JSON.stringify(traversal.manifest, null, 2));
    assert.ok(verifyAiBackupDirectory(traversal.backupDir).errors.some((error) => error.includes("escapes")));

    const duplicate = executeAiBackup({
      targetDir: join(root, "duplicate"), environment: "test", useLivePostgres: false,
      tableDataFetcher: () => [], gitHeadSha: GIT_HEAD_SHA,
    });
    duplicate.manifest.tables[1].file = duplicate.manifest.tables[0].file;
    duplicate.manifest.tables[1].sha256 = duplicate.manifest.tables[0].sha256;
    writeFileSync(duplicate.manifestPath, JSON.stringify(duplicate.manifest, null, 2));
    assert.ok(verifyAiBackupDirectory(duplicate.backupDir).errors.some((error) => error.includes("duplicates")));

    const junction = executeAiBackup({
      targetDir: join(root, "junction"), environment: "test", useLivePostgres: false,
      tableDataFetcher: () => [], gitHeadSha: GIT_HEAD_SHA,
    });
    const junctionEntry = junction.manifest.tables[0];
    const outsideDir = join(root, "outside-dir");
    mkdirSync(outsideDir);
    copyFileSync(join(junction.backupDir, junctionEntry.file), join(outsideDir, "payload.json"));
    try {
      symlinkSync(outsideDir, join(junction.backupDir, "linked-data"), "junction");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
        t.diagnostic(`Junction assertion skipped on this host: ${error.code}`);
        return;
      }
      throw error;
    }
    junctionEntry.file = "linked-data/payload.json";
    junctionEntry.sha256 = restoreSha256(readFileSync(join(outsideDir, "payload.json")));
    writeFileSync(junction.manifestPath, JSON.stringify(junction.manifest, null, 2));
    const junctionErrors = verifyAiBackupDirectory(junction.backupDir).errors;
    assert.ok(junctionErrors.some((error) => /symlink|junction|outside/.test(error)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("restore SQL base64-encodes row data and rejects dynamic identifiers", () => {
  const malicious = "x'); DROP TABLE public.ai_conversations; --";
  const sql = buildRestoreInsertSql(
    "ai_conversations",
    ["id", "content"],
    [{ id: "00000000-0000-0000-0000-000000000001", content: malicious }],
  );
  assert.equal(sql.includes(malicious), false);
  assert.match(sql, /convert_from\(decode\('[A-Za-z0-9+/=]+', 'base64'\), 'UTF8'\)::json/);
  assert.match(sql, /INSERT INTO "public"\."ai_conversations" \("id", "content"\)/);
  assert.throws(
    () => buildRestoreInsertSql("ai_conversations; DROP TABLE users", ["id"], []),
    /not in the AI table registry/,
  );
  assert.throws(
    () => buildRestoreInsertSql("ai_conversations", ["id); DROP TABLE users; --"], []),
    /invalid PostgreSQL identifier/,
  );
});

test("backup CLI failures exit nonzero", () => {
  const script = resolve("scripts/db/backup-ai-subsystem.mjs");
  const result = spawnSync(process.execPath, [script, "--linked", "--environment", "production"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 10_000,
  });
  assert.equal(result.error, undefined, `CLI child process failed to terminate cleanly: ${result.error?.message}`);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /AI_BACKUP_FAILED/);
});

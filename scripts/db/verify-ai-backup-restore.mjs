#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  AI_TABLE_REGISTRY,
  computeSourceFingerprint,
  generateSchemaDdl,
} from "./backup-ai-subsystem.mjs";

const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const PG_IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/;

export function sha256(content) {
  const buf = typeof content === "string" ? Buffer.from(content, "utf8") : Buffer.isBuffer(content) ? content : Buffer.from(JSON.stringify(content), "utf8");
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Execute SQL against local PostgreSQL container
 */
export function executeSqlOnLocalPostgres(sql, dbName = "postgres") {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_corelia-app",
      "psql",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      dbName,
      "-f",
      "-",
    ],
    { input: sql, encoding: "utf8", windowsHide: true },
  );
}

/**
 * Level 1-3 Verification: Manifest, DDL, File Checksums & Row Counts
 */
export function verifyAiBackupDirectory(
  backupDir,
  {
    expectedEnvironment = null,
    expectedProjectRef = null,
    expectedManifestSha256 = null,
  } = {},
) {
  const root = resolve(backupDir);
  let resolveArtifactPath;
  let manifestPath;
  try {
    resolveArtifactPath = createArtifactPathGuard(root);
    manifestPath = resolveArtifactPath("manifest.json", "Manifest file");
  } catch (error) {
    return { ok: false, errors: [error.message], manifest: null };
  }

  const errors = [];
  try {
    expectedEnvironment = canonicalExpectedValue(
      expectedEnvironment,
      /^[a-z][a-z0-9_-]*$/,
      "Expected environment",
    );
    expectedProjectRef = canonicalExpectedValue(
      expectedProjectRef,
      PROJECT_REF_PATTERN,
      "Expected project ref",
    );
    expectedManifestSha256 = canonicalExpectedValue(
      expectedManifestSha256,
      SHA256_PATTERN,
      "Expected manifest SHA-256",
    );
  } catch (error) {
    errors.push(error.message);
  }

  const manifestBytes = readFileSync(manifestPath);
  if (expectedManifestSha256 && sha256(manifestBytes) !== expectedManifestSha256) {
    errors.push("Manifest SHA-256 does not match the externally expected digest");
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString("utf8"));
  } catch (err) {
    return {
      ok: false,
      errors: [...errors, `Failed to parse manifest.json: ${err.message}`],
      manifest: null,
    };
  }

  const normalizedManifestEnvironment = typeof manifest.environment === "string"
    ? manifest.environment.trim().toLowerCase()
    : "";
  if (![1, 2].includes(manifest.schema_version)) {
    errors.push(`Invalid manifest schema_version: ${manifest.schema_version}`);
  }
  if (manifest.schema_version === 1) {
    if (!["local", "test"].includes(normalizedManifestEnvironment) || manifest.provenance?.source_mode === "linked") {
      errors.push("Schema v1 compatibility is restricted to historical local/test artifacts");
    }
  } else if (manifest.schema_version === 2) {
    const provenance = manifest.provenance;
    if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) {
      errors.push("Missing required schema v2 provenance");
    } else {
      const requiredStrings = ["source_mode", "environment", "git_head_sha", "source_fingerprint_sha256"];
      for (const field of requiredStrings) {
        if (typeof provenance[field] !== "string" || provenance[field].trim() === "") {
          errors.push(`Missing or invalid provenance.${field}`);
        }
      }
      const validSourceModes = new Set(["linked", "local_postgres", "custom_fetcher", "empty_fixture"]);
      if (!validSourceModes.has(provenance.source_mode)) {
        errors.push("Invalid provenance.source_mode");
      }
      const normalizedProvenanceEnvironment = typeof provenance.environment === "string"
        ? provenance.environment.trim().toLowerCase()
        : "";
      if (manifest.environment !== normalizedManifestEnvironment || provenance.environment !== normalizedProvenanceEnvironment) {
        errors.push("Schema v2 environment values must use canonical lowercase labels without surrounding whitespace");
      }
      if (!/^[0-9a-f]{40}$/i.test(provenance.git_head_sha || "")) {
        errors.push("Invalid provenance.git_head_sha format");
      }
      if (!SHA256_PATTERN.test(provenance.source_fingerprint_sha256 || "")) {
        errors.push("Invalid provenance.source_fingerprint_sha256 format");
      }
      if (provenance.environment !== manifest.environment) {
        errors.push("Manifest environment does not match provenance environment");
      }
      const isLinkedEnvironment = ["staging", "production"].includes(normalizedProvenanceEnvironment);
      if (isLinkedEnvironment) {
        if (provenance.source_mode !== "linked") {
          errors.push("Staging/production schema v2 provenance must use linked source mode");
        }
        if (!PROJECT_REF_PATTERN.test(provenance.project_ref || "")) {
          errors.push("Linked schema v2 provenance requires a canonical project_ref");
        }
        if (!expectedEnvironment || !expectedProjectRef) {
          errors.push("Linked backup verification requires external expected environment and project ref");
        }
      } else if (provenance.source_mode === "linked") {
        errors.push("Linked source mode requires staging or production environment");
      } else if (provenance.project_ref !== null) {
        errors.push("Non-linked schema v2 provenance must not claim a project_ref");
      }
      if (provenance.source_fingerprint_sha256 !== computeSourceFingerprint(provenance)) {
        errors.push("Source provenance fingerprint mismatch");
      }
    }
  }
  if (expectedEnvironment && manifest.environment !== expectedEnvironment) {
    errors.push("Manifest environment does not match the externally expected environment");
  }
  if (expectedProjectRef) {
    if (manifest.provenance?.source_mode !== "linked") {
      errors.push("An externally expected project ref requires linked provenance");
    } else if (manifest.provenance.project_ref !== expectedProjectRef) {
      errors.push("Manifest project ref does not match the externally expected project ref");
    }
  }
  if (!manifest.backup_id || typeof manifest.backup_id !== "string") {
    errors.push("Missing or invalid backup_id in manifest");
  }
  if (!manifest.generated_at || typeof manifest.generated_at !== "string") {
    errors.push("Missing or invalid generated_at in manifest");
  }
  if (manifest.tables_count !== AI_TABLE_REGISTRY.length) {
    errors.push(`Table count mismatch in manifest: expected ${AI_TABLE_REGISTRY.length}, got ${manifest.tables_count}`);
  }

  const ddlFile = manifest.schema_ddl?.file || "schema_ai_subsystem.sql";
  let ddlPath = null;
  try {
    ddlPath = resolveArtifactPath(ddlFile, "Schema DDL file");
  } catch (error) {
    errors.push(error.message);
  }
  if (ddlPath) {
    const ddlContent = readFileSync(ddlPath, "utf8");
    const ddlDigest = sha256(ddlContent);
    if (manifest.schema_ddl?.sha256 && ddlDigest !== manifest.schema_ddl.sha256) {
      errors.push(`Schema DDL digest mismatch: expected ${manifest.schema_ddl.sha256}, got ${ddlDigest}`);
    }
    if (ddlDigest !== sha256(generateSchemaDdl())) {
      errors.push("Schema DDL does not match the canonical restore schema");
    }
    for (const table of AI_TABLE_REGISTRY) {
      const tablePattern = new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table.name}\\b`, "i");
      if (!tablePattern.test(ddlContent)) {
        errors.push(`Schema DDL missing CREATE TABLE statement for ${table.name}`);
      }
    }
  }

  const manifestTables = Array.isArray(manifest.tables) ? manifest.tables : [];
  if (!Array.isArray(manifest.tables)) {
    errors.push("Manifest tables must be an array");
  }
  if (manifestTables.length !== AI_TABLE_REGISTRY.length) {
    errors.push(`Manifest table entry count mismatch: expected ${AI_TABLE_REGISTRY.length}, got ${manifestTables.length}`);
  }
  const manifestTableNames = new Set(manifestTables.map((table) => table.table_name));
  if (manifestTableNames.size !== manifestTables.length) {
    errors.push("Manifest contains duplicate table mappings");
  }
  const expectedTableNames = new Set(AI_TABLE_REGISTRY.map((table) => table.name));
  const resolvedTablePaths = new Map();

  for (const expected of AI_TABLE_REGISTRY) {
    if (!manifestTableNames.has(expected.name)) {
      errors.push(`Required AI table missing from manifest: ${expected.name}`);
    }
  }

  for (const tableEntry of manifestTables) {
    if (!expectedTableNames.has(tableEntry.table_name)) {
      errors.push(`Unexpected non-AI table present in manifest: ${tableEntry.table_name}`);
      continue;
    }
    const expectedMeta = AI_TABLE_REGISTRY.find((table) => table.name === tableEntry.table_name);
    if (tableEntry.classification !== expectedMeta.classification) {
      errors.push(`Table classification mismatch for ${tableEntry.table_name}: expected ${expectedMeta.classification}, got ${tableEntry.classification}`);
    }

    let tableFilePath;
    try {
      tableFilePath = resolveArtifactPath(tableEntry.file, `Table data file for ${tableEntry.table_name}`);
      resolvedTablePaths.set(tableEntry.table_name, tableFilePath);
    } catch (error) {
      errors.push(error.message);
      continue;
    }
    const fileContent = readFileSync(tableFilePath, "utf8");
    const digest = sha256(fileContent);
    if (digest !== tableEntry.sha256) {
      errors.push(`SHA-256 mismatch for ${tableEntry.table_name}: expected ${tableEntry.sha256}, got ${digest}`);
    }
    try {
      const parsedRows = JSON.parse(fileContent);
      if (!Array.isArray(parsedRows)) {
        errors.push(`Table data for ${tableEntry.table_name} is not a valid JSON array`);
      } else if (parsedRows.length !== tableEntry.row_count) {
        errors.push(`Row count mismatch for ${tableEntry.table_name}: expected ${tableEntry.row_count}, got ${parsedRows.length}`);
      }
    } catch (parseErr) {
      errors.push(`Failed to parse JSON data for ${tableEntry.table_name}: ${parseErr.message}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    manifest,
    totalTables: manifestTables.length,
    totalRows: manifest.total_rows || 0,
    resolvedPaths: {
      ddl: ddlPath,
      tables: Object.fromEntries(resolvedTablePaths),
    },
  };
}

function normalizePathKey(pathname) {
  return process.platform === "win32" ? pathname.toLowerCase() : pathname;
}

function isPathInside(root, candidate) {
  const rel = relative(root, candidate);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function createArtifactPathGuard(backupDir) {
  const rootPath = resolve(backupDir);
  if (!existsSync(rootPath) || !statSync(rootPath).isDirectory()) {
    throw new Error(`Backup directory is missing or not a directory: ${rootPath}`);
  }
  const rootRealPath = realpathSync(rootPath);
  const usedLogicalPaths = new Set();
  const usedPhysicalPaths = new Set();

  return function resolveArtifactPath(relativePath, label) {
    if (typeof relativePath !== "string" || relativePath.trim() === "" || isAbsolute(relativePath)) {
      throw new Error(`${label} must use a non-empty relative path inside the backup directory`);
    }
    const candidatePath = resolve(rootPath, relativePath);
    if (!isPathInside(rootPath, candidatePath)) {
      throw new Error(`${label} escapes the backup directory`);
    }
    if (!existsSync(candidatePath)) {
      throw new Error(`${label} is missing at ${candidatePath}`);
    }

    let cursor = rootPath;
    for (const segment of relative(rootPath, candidatePath).split(/[\\/]+/)) {
      cursor = join(cursor, segment);
      if (lstatSync(cursor).isSymbolicLink()) {
        throw new Error(`${label} traverses a symlink or junction`);
      }
    }

    const candidateRealPath = realpathSync(candidatePath);
    if (!isPathInside(rootRealPath, candidateRealPath)) {
      throw new Error(`${label} resolves outside the backup directory`);
    }
    const fileStat = statSync(candidateRealPath);
    if (!fileStat.isFile()) {
      throw new Error(`${label} must resolve to a regular file`);
    }

    const logicalKey = normalizePathKey(candidatePath);
    const physicalKey = normalizePathKey(candidateRealPath);
    if (
      usedLogicalPaths.has(logicalKey)
      || usedPhysicalPaths.has(physicalKey)
    ) {
      throw new Error(`${label} duplicates another manifest file mapping`);
    }
    usedLogicalPaths.add(logicalKey);
    usedPhysicalPaths.add(physicalKey);
    return candidateRealPath;
  };
}

function canonicalExpectedValue(value, pattern, label) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new Error(`${label} is not canonical`);
  }
  return value;
}

function quotePgIdentifier(identifier) {
  if (typeof identifier !== "string" || !PG_IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error("Restore SQL contains an invalid PostgreSQL identifier.");
  }
  return `"${identifier}"`;
}

function buildJsonInsertSql({ schemaName, tableName, insertableCols, rows, onConflict = "" }) {
  if (!Array.isArray(insertableCols) || insertableCols.length === 0) {
    throw new Error(`No insertable columns found for ${tableName}.`);
  }
  if (new Set(insertableCols).size !== insertableCols.length) {
    throw new Error(`Duplicate insertable columns found for ${tableName}.`);
  }
  if (!Array.isArray(rows)) {
    throw new Error(`Restore rows for ${tableName} must be an array.`);
  }
  const qualifiedTable = `${quotePgIdentifier(schemaName)}.${quotePgIdentifier(tableName)}`;
  const columnList = insertableCols.map(quotePgIdentifier).join(", ");
  const payloadBase64 = Buffer.from(JSON.stringify(rows), "utf8").toString("base64");
  return `
    WITH restored_rows AS (
      SELECT *
      FROM json_populate_recordset(
        null::${qualifiedTable},
        convert_from(decode('${payloadBase64}', 'base64'), 'UTF8')::json
      )
    )
    INSERT INTO ${qualifiedTable} (${columnList})
    SELECT ${columnList}
    FROM restored_rows
    ${onConflict};
  `;
}

export function buildRestoreInsertSql(tableName, insertableCols, rows) {
  if (!AI_TABLE_REGISTRY.some((table) => table.name === tableName)) {
    throw new Error(`Restore table ${tableName} is not in the AI table registry.`);
  }
  return buildJsonInsertSql({ schemaName: "public", tableName, insertableCols, rows });
}

export function parseRestoreCliArgs(argv) {
  const args = [...argv];
  let backupDir = null;
  if (args[0] && !args[0].startsWith("--")) {
    backupDir = args.shift();
  }
  const verificationOptions = {};
  const optionMap = new Map([
    ["--restore-dir", "backupDir"],
    ["--expected-environment", "expectedEnvironment"],
    ["--expected-project-ref", "expectedProjectRef"],
    ["--expected-manifest-sha256", "expectedManifestSha256"],
  ]);
  while (args.length > 0) {
    const option = args.shift();
    const key = optionMap.get(option);
    const value = args.shift();
    if (!key || !value || value.startsWith("--")) {
      throw new Error("Usage: node scripts/db/verify-ai-backup-restore.mjs <backup-directory> [verification options]");
    }
    if (key === "backupDir") {
      if (backupDir) throw new Error("Restore directory was provided more than once.");
      backupDir = value;
    } else {
      if (verificationOptions[key] !== undefined) {
        throw new Error(`${option} was provided more than once.`);
      }
      verificationOptions[key] = value;
    }
  }
  if (!backupDir) {
    throw new Error("Usage: node scripts/db/verify-ai-backup-restore.mjs <backup-directory> [verification options]");
  }
  return { backupDir, verificationOptions };
}

/**
 * Level 4 Integration Test: Real Restore into Disposable PostgreSQL Database
 */
export function executeRealPostgresRestoreTest(backupDir, verificationOptions = {}) {
  const root = resolve(backupDir);
  const staticVerify = verifyAiBackupDirectory(root, verificationOptions);
  if (!staticVerify.ok) {
    return {
      ok: false,
      stage: "STATIC_VERIFICATION",
      errors: staticVerify.errors,
    };
  }

  const disposableDbName = `ai_restore_test_${Date.now()}`;
  const errors = [];

  try {
    // 1. Create disposable database
    executeSqlOnLocalPostgres(`CREATE DATABASE ${disposableDbName};`);

    // 2. Apply Schema DDL
    const ddlContent = readFileSync(staticVerify.resolvedPaths.ddl, "utf8");
    executeSqlOnLocalPostgres(ddlContent, disposableDbName);

    // 3. Verify all 18 tables exist in PostgreSQL information_schema
    const tablesCheckSql = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (${AI_TABLE_REGISTRY.map((t) => `'${t.name}'`).join(",")});
    `;
    const foundTablesOutput = executeSqlOnLocalPostgres(tablesCheckSql, disposableDbName);
    for (const table of AI_TABLE_REGISTRY) {
      if (!foundTablesOutput.includes(table.name)) {
        errors.push(`Table ${table.name} not found in restored PostgreSQL database`);
      }
    }

    // 4. Collect referenced user_ids and transaction_ids to populate stubs
    const referencedUsers = new Set();
    const referencedTxs = new Set();

    for (const tableEntry of staticVerify.manifest.tables) {
      const dataFilePath = staticVerify.resolvedPaths.tables[tableEntry.table_name];
      const rows = JSON.parse(readFileSync(dataFilePath, "utf8"));
      for (const row of rows) {
        if (row.user_id) referencedUsers.add(row.user_id);
        if (row.created_by) referencedUsers.add(row.created_by);
        if (row.updated_by) referencedUsers.add(row.updated_by);
        if (row.payment_transaction_id) referencedTxs.add(row.payment_transaction_id);
      }
    }

    if (referencedUsers.size > 0) {
      const userList = Array.from(referencedUsers);
      const BATCH_SIZE = 500;
      for (let i = 0; i < userList.length; i += BATCH_SIZE) {
        const batch = userList.slice(i, i + BATCH_SIZE);
        executeSqlOnLocalPostgres(buildJsonInsertSql({
          schemaName: "auth",
          tableName: "users",
          insertableCols: ["id"],
          rows: batch.map((id) => ({ id })),
          onConflict: "ON CONFLICT (id) DO NOTHING",
        }), disposableDbName);
      }
    }
    if (referencedTxs.size > 0) {
      executeSqlOnLocalPostgres(buildJsonInsertSql({
        schemaName: "public",
        tableName: "payment_transactions",
        insertableCols: ["id"],
        rows: Array.from(referencedTxs, (id) => ({ id })),
        onConflict: "ON CONFLICT (id) DO NOTHING",
      }), disposableDbName);
    }

    // 5. Restore data rows from JSON into PostgreSQL
    // Set replication role to replica to allow high-speed batch load in any table order
    executeSqlOnLocalPostgres("SET session_replication_role = 'replica';", disposableDbName);

    for (const tableEntry of staticVerify.manifest.tables) {
      const dataFilePath = staticVerify.resolvedPaths.tables[tableEntry.table_name];
      const rows = JSON.parse(readFileSync(dataFilePath, "utf8"));
      if (rows.length > 0) {
        // Query insertable columns for tableEntry (exclude GENERATED ALWAYS columns)
        const colsSql = `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = '${tableEntry.table_name}'
            AND is_generated = 'NEVER'
          ORDER BY ordinal_position;
        `;
        const colsOutput = executeSqlOnLocalPostgres(colsSql, disposableDbName);
        const insertableCols = colsOutput
          .split("\n")
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.includes("column_name") && !s.includes("-") && !s.includes("(") && !s.includes("row"));

        if (insertableCols.some((column) => !PG_IDENTIFIER_PATTERN.test(column))) {
          throw new Error(`Database returned an invalid insertable column for ${tableEntry.table_name}.`);
        }

        // Strip non-insertable / generated columns if any
        const sanitizedRows = rows.map((r) => {
          const clone = {};
          for (const col of insertableCols) {
            if (r[col] !== undefined && r[col] !== null) {
              clone[col] = r[col];
            } else if (tableEntry.table_name === "ai_usage_log" && col === "usage_kind") {
              clone[col] = "successful_message";
            }
          }
          return clone;
        });

        // Insert in batches of 500 rows to prevent query size limits
        const BATCH_SIZE = 500;
        for (let i = 0; i < sanitizedRows.length; i += BATCH_SIZE) {
          const batch = sanitizedRows.slice(i, i + BATCH_SIZE);
          const insertSql = buildRestoreInsertSql(tableEntry.table_name, insertableCols, batch);
          executeSqlOnLocalPostgres(insertSql, disposableDbName);
        }
      }

      // Verify restored row count
      const countSql = `SELECT count(*)::int AS count FROM public.${tableEntry.table_name};`;
      const countOutput = executeSqlOnLocalPostgres(countSql, disposableDbName);
      const match = countOutput.match(/\b(\d+)\b/);
      const actualCount = match ? parseInt(match[1], 10) : -1;
      if (actualCount !== tableEntry.row_count) {
        errors.push(`Restored row count mismatch for ${tableEntry.table_name}: expected ${tableEntry.row_count}, got ${actualCount}`);
      }
    }

    // Reset session replication role
    executeSqlOnLocalPostgres("SET session_replication_role = 'origin';", disposableDbName);

    // 6. Test FK & Structural Invariants in restored database
    const invariantTestSql = `
      DO $invariants$
      BEGIN
        -- Verify FK on ai_conversations
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_type = 'FOREIGN KEY'
            AND table_name = 'ai_conversations'
        ) THEN
          RAISE EXCEPTION 'Missing foreign key on ai_conversations in restored DB';
        END IF;

        -- Verify FK on ai_vouchers
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_type = 'FOREIGN KEY'
            AND table_name = 'ai_vouchers'
        ) THEN
          RAISE EXCEPTION 'Missing foreign key on ai_vouchers in restored DB';
        END IF;

        -- Verify FK on ai_subscriptions
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_type = 'FOREIGN KEY'
            AND table_name = 'ai_subscriptions'
        ) THEN
          RAISE EXCEPTION 'Missing foreign key on ai_subscriptions in restored DB';
        END IF;

        -- Verify PK on ai_model_pricing is 'model'
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = 'ai_model_pricing'
            AND tc.constraint_type = 'PRIMARY KEY'
            AND kcu.column_name = 'model'
        ) THEN
          RAISE EXCEPTION 'Primary key on ai_model_pricing is not model in restored DB';
        END IF;
      END $invariants$;
    `;
    executeSqlOnLocalPostgres(invariantTestSql, disposableDbName);

    return {
      ok: errors.length === 0,
      stage: "POSTGRES_RESTORE_INTEGRATION",
      disposableDbName,
      restoredTables: AI_TABLE_REGISTRY.length,
      errors,
    };
  } catch (dbErr) {
    errors.push(`PostgreSQL restore runtime failure: ${dbErr.message}`);
    return {
      ok: false,
      stage: "POSTGRES_RESTORE_INTEGRATION",
      disposableDbName,
      errors,
    };
  } finally {
    // 7. Tear down disposable database cleanly
    try {
      executeSqlOnLocalPostgres(`DROP DATABASE IF EXISTS ${disposableDbName};`);
    } catch (cleanupErr) {
      console.warn(`[WARN] Failed to drop disposable database ${disposableDbName}: ${cleanupErr.message}`);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/i, "$1"))) {
  let parsedArgs;
  try {
    parsedArgs = parseRestoreCliArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const { backupDir: dir, verificationOptions } = parsedArgs;

  console.log(`[VERIFY_AI_BACKUP] Validating backup directory at: ${dir}`);
  const staticResult = verifyAiBackupDirectory(dir, verificationOptions);
  if (!staticResult.ok) {
    console.error(`[STATIC_VERIFICATION_FAILED] Found ${staticResult.errors.length} errors:`);
    for (const err of staticResult.errors) console.error(`  - ${err}`);
    process.exit(1);
  }
  console.log(`✓ Static Checksum & Manifest Verification Passed (${staticResult.totalTables} tables, ${staticResult.totalRows} rows).`);

  console.log(`[RESTORE_TEST] Performing Level 4 Real PostgreSQL Restore Test into disposable database...`);
  const restoreResult = executeRealPostgresRestoreTest(dir, verificationOptions);
  if (!restoreResult.ok) {
    console.error(`[RESTORE_VERIFICATION_FAILED] Found ${restoreResult.errors.length} errors:`);
    for (const err of restoreResult.errors) console.error(`  - ${err}`);
    process.exit(1);
  }
  console.log(`✓ Level 4 Isolated PostgreSQL Restore Test Passed (${restoreResult.restoredTables} tables verified in disposable DB).`);
}

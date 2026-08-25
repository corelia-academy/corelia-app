#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { AI_TABLE_REGISTRY } from "./backup-ai-subsystem.mjs";

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
export function verifyAiBackupDirectory(backupDir) {
  const root = resolve(backupDir);
  const manifestPath = join(root, "manifest.json");

  if (!existsSync(manifestPath)) {
    return {
      ok: false,
      errors: [`Manifest file missing at ${manifestPath}`],
      manifest: null,
    };
  }

  const errors = [];
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (err) {
    return {
      ok: false,
      errors: [`Failed to parse manifest.json: ${err.message}`],
      manifest: null,
    };
  }

  // 1. Validate basic manifest structure
  if (manifest.schema_version !== 1) {
    errors.push(`Invalid manifest schema_version: ${manifest.schema_version}`);
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

  // 2. Validate DDL file
  const ddlFile = manifest.schema_ddl?.file || "schema_ai_subsystem.sql";
  const ddlPath = join(root, ddlFile);
  if (!existsSync(ddlPath)) {
    errors.push(`Schema DDL file missing at ${ddlPath}`);
  } else {
    const ddlContent = readFileSync(ddlPath, "utf8");
    const ddlDigest = sha256(ddlContent);
    if (manifest.schema_ddl?.sha256 && ddlDigest !== manifest.schema_ddl.sha256) {
      errors.push(`Schema DDL digest mismatch: expected ${manifest.schema_ddl.sha256}, got ${ddlDigest}`);
    }

    // Verify DDL includes all 18 tables
    for (const table of AI_TABLE_REGISTRY) {
      const tablePattern = new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table.name}\\b`, "i");
      if (!tablePattern.test(ddlContent)) {
        errors.push(`Schema DDL missing CREATE TABLE statement for ${table.name}`);
      }
    }
  }

  // 3. Validate each table in manifest against AI_TABLE_REGISTRY
  const manifestTableNames = new Set((manifest.tables || []).map((t) => t.table_name));
  const expectedTableNames = new Set(AI_TABLE_REGISTRY.map((t) => t.name));

  for (const expected of AI_TABLE_REGISTRY) {
    if (!manifestTableNames.has(expected.name)) {
      errors.push(`Required AI table missing from manifest: ${expected.name}`);
    }
  }

  for (const tableEntry of manifest.tables || []) {
    if (!expectedTableNames.has(tableEntry.table_name)) {
      errors.push(`Unexpected non-AI table present in manifest: ${tableEntry.table_name}`);
      continue;
    }

    const expectedMeta = AI_TABLE_REGISTRY.find((t) => t.name === tableEntry.table_name);
    if (tableEntry.classification !== expectedMeta.classification) {
      errors.push(`Table classification mismatch for ${tableEntry.table_name}: expected ${expectedMeta.classification}, got ${tableEntry.classification}`);
    }

    const tableFilePath = join(root, tableEntry.file);
    if (!existsSync(tableFilePath)) {
      errors.push(`Table data file missing at ${tableFilePath}`);
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
    totalTables: manifest.tables?.length || 0,
    totalRows: manifest.total_rows || 0,
  };
}

/**
 * Level 4 Integration Test: Real Restore into Disposable PostgreSQL Database
 */
export function executeRealPostgresRestoreTest(backupDir) {
  const root = resolve(backupDir);
  const staticVerify = verifyAiBackupDirectory(root);
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
    const ddlContent = readFileSync(join(root, staticVerify.manifest.schema_ddl.file), "utf8");
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
      const dataFilePath = join(root, tableEntry.file);
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
        const userValues = batch.map((uid) => `('${uid}')`).join(",");
        executeSqlOnLocalPostgres(`INSERT INTO auth.users (id) VALUES ${userValues} ON CONFLICT (id) DO NOTHING;`, disposableDbName);
      }
    }
    if (referencedTxs.size > 0) {
      const txValues = Array.from(referencedTxs).map((tx) => `('${tx}')`).join(",");
      executeSqlOnLocalPostgres(`INSERT INTO public.payment_transactions (id) VALUES ${txValues} ON CONFLICT (id) DO NOTHING;`, disposableDbName);
    }

    // 5. Restore data rows from JSON into PostgreSQL
    // Set replication role to replica to allow high-speed batch load in any table order
    executeSqlOnLocalPostgres("SET session_replication_role = 'replica';", disposableDbName);

    for (const tableEntry of staticVerify.manifest.tables) {
      const dataFilePath = join(root, tableEntry.file);
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

        const colsListStr = insertableCols.join(", ");

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
          const insertSql = `
            INSERT INTO public.${tableEntry.table_name} (${colsListStr})
            SELECT ${colsListStr}
            FROM json_populate_recordset(null::public.${tableEntry.table_name}, '${JSON.stringify(batch).replace(/'/g, "''")}');
          `;
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
  const dir = process.argv[2];
  if (!dir) {
    console.error("Usage: node scripts/db/verify-ai-backup-restore.mjs <backup-directory>");
    process.exit(1);
  }

  console.log(`[VERIFY_AI_BACKUP] Validating backup directory at: ${dir}`);
  const staticResult = verifyAiBackupDirectory(dir);
  if (!staticResult.ok) {
    console.error(`[STATIC_VERIFICATION_FAILED] Found ${staticResult.errors.length} errors:`);
    for (const err of staticResult.errors) console.error(`  - ${err}`);
    process.exit(1);
  }
  console.log(`✓ Static Checksum & Manifest Verification Passed (${staticResult.totalTables} tables, ${staticResult.totalRows} rows).`);

  console.log(`[RESTORE_TEST] Performing Level 4 Real PostgreSQL Restore Test into disposable database...`);
  const restoreResult = executeRealPostgresRestoreTest(dir);
  if (!restoreResult.ok) {
    console.error(`[RESTORE_VERIFICATION_FAILED] Found ${restoreResult.errors.length} errors:`);
    for (const err of restoreResult.errors) console.error(`  - ${err}`);
    process.exit(1);
  }
  console.log(`✓ Level 4 Isolated PostgreSQL Restore Test Passed (${restoreResult.restoredTables} tables verified in disposable DB).`);
}

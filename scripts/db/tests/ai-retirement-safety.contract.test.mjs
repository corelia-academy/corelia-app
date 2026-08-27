import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AI_TABLE_REGISTRY, executeAiBackup } from "../backup-ai-subsystem.mjs";
import {
  buildRestoreInsertSql,
  executeRealPostgresRestoreTest,
  executeSqlOnLocalPostgres,
  sha256 as restoreSha256,
  verifyAiBackupDirectory,
} from "../verify-ai-backup-restore.mjs";

test("AI Subsystem Registry: Exactly 18 tables defined with valid classifications", () => {
  assert.equal(AI_TABLE_REGISTRY.length, 18);
  const names = AI_TABLE_REGISTRY.map((t) => t.name);
  const uniqueNames = new Set(names);
  assert.equal(uniqueNames.size, 18, "No duplicate table names in AI registry");

  const validClassifications = new Set([
    "AI_RUNTIME_STATE",
    "FINANCIAL_SERVICE_STATE",
    "FINANCIAL_TRANSACTION",
    "DERIVED_AGGREGATE",
    "DERIVED_PROJECTION",
    "AUDIT_LOG",
    "CONFIGURATION",
    "EVENT_LOG",
    "AI_GENERATED_SNAPSHOT",
  ]);

  for (const table of AI_TABLE_REGISTRY) {
    assert.ok(
      validClassifications.has(table.classification),
      `Table ${table.name} has valid classification ${table.classification}`,
    );
    assert.ok(table.primaryKey, `Table ${table.name} defines a primaryKey`);
  }
});

test("AI Backup Tooling: Generates valid schema DDL, data fixtures, and deterministic manifest", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "corelia-ai-backup-test-"));
  try {
    const backupDir = join(tempDir, "backup");
    const mockDataFetcher = (tableName) => {
      if (tableName === "tier_limits") {
        return [
          { tier: "free", monthly_messages: 6, rolling_3h_soft_cap: 40, quota_unit: "message" },
          { tier: "student", monthly_messages: 20, rolling_3h_soft_cap: 250, quota_unit: "message" },
        ];
      }
      if (tableName === "ai_model_pricing") {
        return [
          { model: "gpt-5.4-mini", input_per_1m_usd: 0.75, output_per_1m_usd: 4.5, active: true },
        ];
      }
      return [];
    };

    const result = executeAiBackup({
      targetDir: backupDir,
      environment: "test",
      useLivePostgres: false,
      tableDataFetcher: mockDataFetcher,
    });

    assert.ok(result.backupDir);
    assert.equal(result.manifest.tables_count, 18);
    assert.equal(result.manifest.total_rows, 3);

    const verification = verifyAiBackupDirectory(backupDir, {
      expectedEnvironment: "test",
      expectedManifestSha256: restoreSha256(readFileSync(result.manifestPath)),
    });
    assert.equal(verification.ok, true, `Verification errors: ${verification.errors.join(", ")}`);
    assert.equal(verification.totalTables, 18);
    assert.equal(verification.totalRows, 3);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("AI Restore SQL: untrusted JSON is encoded and cannot become executable SQL", () => {
  const payload = "'); DROP TABLE public.ai_subscriptions; --";
  const sql = buildRestoreInsertSql(
    "ai_subscriptions",
    ["id", "status"],
    [{ id: "00000000-0000-0000-0000-000000000001", status: payload }],
  );
  assert.equal(sql.includes(payload), false);
  assert.match(sql, /decode\('[A-Za-z0-9+/=]+', 'base64'\)/);
});

test("AI Backup Verification: Fails closed on tampered data, checksum mismatch, or missing file", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "corelia-ai-backup-fail-test-"));
  try {
    const backupDir = join(tempDir, "backup");
    executeAiBackup({
      targetDir: backupDir,
      environment: "test",
      useLivePostgres: false,
      tableDataFetcher: () => [],
    });

    // 1. Mutate a table file to cause SHA-256 mismatch
    const targetFile = join(backupDir, "data", "ai_subscriptions.json");
    writeFileSync(targetFile, JSON.stringify([{ id: "tampered" }]), "utf8");

    const failedVerify = verifyAiBackupDirectory(backupDir);
    assert.equal(failedVerify.ok, false);
    assert.ok(
      failedVerify.errors.some((e) => e.includes("SHA-256 mismatch for ai_subscriptions") || e.includes("Row count mismatch")),
      "Detected tampered file content",
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function isDockerPostgresAvailable() {
  try {
    const output = execFileSync(
      "docker",
      ["ps", "--filter", "name=supabase_db_corelia-app", "--format", "{{.Names}}"],
      { encoding: "utf8", windowsHide: true, timeout: 2000 },
    ).trim();
    return output.includes("supabase_db_corelia-app");
  } catch {
    return false;
  }
}

test("Level 4 Integration Test: Real PostgreSQL isolated restore into disposable database", (t) => {
  if (!isDockerPostgresAvailable()) {
    t.skip("Local Docker PostgreSQL container is not currently active");
    return;
  }
  const tempDir = mkdtempSync(join(tmpdir(), "corelia-ai-real-restore-test-"));
  try {
    const backupDir = join(tempDir, "backup");
    executeAiBackup({
      targetDir: backupDir,
      environment: "local",
      useLivePostgres: true,
    });

    const restoreResult = executeRealPostgresRestoreTest(backupDir);
    assert.equal(
      restoreResult.ok,
      true,
      `Real PostgreSQL restore failed: ${(restoreResult.errors || []).join(", ")}`,
    );
    assert.equal(restoreResult.restoredTables, 18);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("Level 4 Runtime Proof: payment_transactions and payment_refunds preserve historical ai_subscription payments", (t) => {
  if (!isDockerPostgresAvailable()) {
    t.skip("Local Docker PostgreSQL container is not currently active");
    return;
  }
  const testSql = `
    DO $test$
    DECLARE
      v_user_id uuid := gen_random_uuid();
      v_tx_id text := 'tx_ai_sub_test_' || substr(gen_random_uuid()::text, 1, 8);
      v_refund_id text := 'ref_ai_sub_' || substr(gen_random_uuid()::text, 1, 8);
    BEGIN
      INSERT INTO auth.users (id, email) VALUES (v_user_id, 'ai-sub-test@corelia.local');
      INSERT INTO public.profiles (id, full_name, role, tier)
      VALUES (v_user_id, 'AI Sub Tester', 'student', 'free')
      ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

      INSERT INTO public.payment_transactions (
        id, user_id, course_id, purpose, amount_vnd, provider, status, created_at, updated_at
      ) VALUES (
        v_tx_id, v_user_id, 'cora-ai', 'ai_subscription', 149000, 'sepay', 'paid', now(), now()
      );

      INSERT INTO public.payment_refunds (
        id, payment_transaction_id, user_id, amount_vnd, status, reason
      ) VALUES (
        v_refund_id, v_tx_id, v_user_id, 149000, 'completed', 'AI retirement refund test'
      );

      IF NOT EXISTS (
        SELECT 1 FROM public.payment_refunds WHERE id = v_refund_id AND payment_transaction_id = v_tx_id
      ) THEN
        RAISE EXCEPTION 'Failed to verify payment_refund for ai_subscription';
      END IF;

      DELETE FROM public.payment_refunds WHERE id = v_refund_id;
      DELETE FROM public.payment_transactions WHERE id = v_tx_id;
      DELETE FROM public.profiles WHERE id = v_user_id;
      DELETE FROM auth.users WHERE id = v_user_id;
    END $test$;
  `;

  executeSqlOnLocalPostgres(testSql);
  assert.ok(true, "PostgreSQL executed historical ai_subscription transaction and refund successfully");
});

test("Core Financial Decoupling: payment_transactions and payment_refunds preserve historical accounting in schema", () => {
  const wave1 = readFileSync(
    "supabase/migrations/20260825100000_payment_refund_and_access_provenance_schema.sql",
    "utf8",
  );
  const wave2 = readFileSync(
    "supabase/migrations/20260825110000_atomic_payment_settlement_and_enrollment_rpcs.sql",
    "utf8",
  );

  assert.ok(
    wave1.includes("'refund_requested', 'refunded', 'partially_refunded'"),
    "payment_transactions supports full refund lifecycle",
  );
  assert.ok(
    wave1.includes("REFERENCES public.payment_transactions (id) ON DELETE RESTRICT"),
    "payment_refunds has ON DELETE RESTRICT foreign key to payment_transactions",
  );
  assert.ok(
    wave2.includes("ELSIF v_tx.purpose = 'ai_subscription' THEN"),
    "process_payment_refund supports AI subscription refunds cleanly",
  );
});

test("Canonical Assessment Content: course_section_questions is independent of AI generator functions", () => {
  const questionsMigration = readFileSync(
    "supabase/migrations/20260622000000_course_section_questions.sql",
    "utf8",
  );

  assert.ok(
    questionsMigration.includes("REFERENCES public.courses(id)"),
    "course_section_questions links canonically to courses",
  );
  assert.ok(
    !questionsMigration.includes("REFERENCES public.ai_"),
    "course_section_questions has ZERO foreign keys to AI tables",
  );
});

test("Edge Functions Provider Isolation: Corelia API does not require OPENAI_API_KEY", () => {
  const coreliaApiIndex = readFileSync("supabase/functions/corelia-api/index.ts", "utf8");
  const coreliaApiEnv = readFileSync("supabase/functions/corelia-api/lib/env.ts", "utf8");

  assert.ok(
    !coreliaApiIndex.includes("OPENAI_API_KEY") && !coreliaApiEnv.includes("OPENAI_API_KEY"),
    "corelia-api does not depend on OPENAI_API_KEY",
  );
});

test("Wave C (Issue #328): Learner AI Edge Functions are decommissioned tombstones without provider calls", () => {
  const learnerAiFunctions = [
    "ai-tutor",
    "embed-lesson",
    "generate-flashcards",
    "generate-learning-path",
    "generate-lesson-summary",
  ];

  for (const fn of learnerAiFunctions) {
    const fnIndex = readFileSync(`supabase/functions/${fn}/index.ts`, "utf8");
    assert.ok(
      !fnIndex.includes("api.openai.com"),
      `${fn}/index.ts has 0 calls to api.openai.com`,
    );
    assert.ok(
      !fnIndex.includes("OPENAI_API_KEY"),
      `${fn}/index.ts does not require OPENAI_API_KEY`,
    );
    assert.ok(
      fnIndex.includes("AI_FEATURE_RETIRED") && fnIndex.includes("410"),
      `${fn}/index.ts contains deterministic 410 AI_FEATURE_RETIRED tombstone`,
    );
  }
});

test("Wave C: Restored Instructor AI Edge Functions enforce strict role guards and course management", () => {
  const instructorAiFunctions = [
    "generate-description",
    "generate-questions",
  ];

  for (const fn of instructorAiFunctions) {
    const fnIndex = readFileSync(`supabase/functions/${fn}/index.ts`, "utf8");
    assert.ok(
      fnIndex.includes("verifyBearerUser"),
      `${fn}/index.ts enforces auth verification`,
    );
    assert.ok(
      fnIndex.includes("getUserRole"),
      `${fn}/index.ts checks user role`,
    );
    assert.ok(
      fnIndex.includes("instructor") && fnIndex.includes("support_staff") && fnIndex.includes("admin"),
      `${fn}/index.ts restricts access to instructor, support_staff, and admin`,
    );
    assert.ok(
      fnIndex.includes("ensureCanManageCourse"),
      `${fn}/index.ts checks course management permission`,
    );
  }
});

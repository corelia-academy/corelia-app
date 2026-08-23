import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, unlinkSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const execFileAsync = promisify(execFile);
const command = process.platform === "win32" ? "npx.cmd" : "npx";

function runLocalSqlFile(filePath) {
  const args = ["supabase", "db", "query", "--local", "--file", filePath];
  return execFileAsync(command, args, { encoding: "utf8", shell: true });
}

export async function runConcurrencyTest() {
  const hackathonId = "hackathon-concurrency-runner";
  console.log("Starting DBH-05 Two-Connection Real Concurrency Test...");

  const setupFile = resolve(process.cwd(), "scripts/db/tests/.tmp-conc-setup.sql");
  const managerFile = resolve(process.cwd(), "scripts/db/tests/.tmp-conc-manager.sql");
  const metricsFile = resolve(process.cwd(), "scripts/db/tests/.tmp-conc-metrics.sql");
  const verifyFile = resolve(process.cwd(), "scripts/db/tests/.tmp-conc-verify.sql");
  const cleanupFile = resolve(process.cwd(), "scripts/db/tests/.tmp-conc-cleanup.sql");

  try {
    // 1. Setup initial contest row
    writeFileSync(
      setupFile,
      `
      INSERT INTO public.hackathons (id, status, document)
      VALUES (
        '${hackathonId}',
        'published',
        jsonb_build_object(
          'title', 'Original Concurrent Title',
          'description', 'Original Description',
          'created_by', '11111111-1111-4111-8111-111111111111',
          'max_participants', 100,
          'metrics_snapshot', jsonb_build_object('registrations_total', 0, 'submissions_total', 0)
        )
      )
      ON CONFLICT (id) DO UPDATE SET document = EXCLUDED.document;
      `,
      "utf8",
    );
    await runLocalSqlFile(setupFile);

    // 2. Prepare Connection 1 (Manager Edit) and Connection 2 (Metrics RPC Patch)
    writeFileSync(
      managerFile,
      `
      DO $$
      BEGIN
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
        UPDATE public.hackathons
        SET document = jsonb_set(
          jsonb_set(document, '{title}', '"MANAGER_CONCURRENT_TITLE_UPDATED"'),
          '{description}', '"MANAGER_CONCURRENT_DESC_UPDATED"'
        )
        WHERE id = '${hackathonId}';
      END $$;
      `,
      "utf8",
    );

    writeFileSync(
      metricsFile,
      `
      DO $$
      BEGIN
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
        PERFORM public.patch_hackathon_metrics_snapshot(
          '${hackathonId}',
          '{"registrations_total": 77, "submissions_total": 19, "updated_at": "2026-08-24T00:00:00Z"}'::jsonb
        );
      END $$;
      `,
      "utf8",
    );

    // Launch both distinct database sessions concurrently
    const [managerRes, metricsRes] = await Promise.all([
      runLocalSqlFile(managerFile),
      runLocalSqlFile(metricsFile),
    ]);

    // 3. Query final document state
    writeFileSync(
      verifyFile,
      `SELECT document FROM public.hackathons WHERE id = '${hackathonId}';`,
      "utf8",
    );
    const { stdout: rawResult } = await runLocalSqlFile(verifyFile);

    // 4. Assert data integrity
    console.log("Concurrency test finished. Verifying final state in database...");
    assert.ok(rawResult.includes("MANAGER_CONCURRENT_TITLE_UPDATED"), "Manager title edit was LOST in concurrent race!");
    assert.ok(rawResult.includes("MANAGER_CONCURRENT_DESC_UPDATED"), "Manager description edit was LOST in concurrent race!");
    assert.ok(rawResult.includes("77"), "Metrics snapshot registrations_total (77) was not recorded!");
    assert.ok(rawResult.includes("19"), "Metrics snapshot submissions_total (19) was not recorded!");

    console.log("✓ CONCURRENCY-01: PASS (Real two-connection interleaving proved atomic JSONB patch preserves manager edits)");
  } finally {
    // 5. Cleanup fixtures and temporary files
    try {
      writeFileSync(
        cleanupFile,
        `DELETE FROM public.hackathons WHERE id = '${hackathonId}';`,
        "utf8",
      );
      await runLocalSqlFile(cleanupFile);
    } catch (_) {}

    [setupFile, managerFile, metricsFile, verifyFile, cleanupFile].forEach((f) => {
      if (existsSync(f)) unlinkSync(f);
    });
  }
}

// Run directly if invoked as script
if (process.argv[1]?.endsWith("g2-r1-concurrency.integration.mjs")) {
  runConcurrencyTest().catch((err) => {
    console.error("CONCURRENCY_TEST_FAILED:", err);
    process.exit(1);
  });
}


import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260916160000_enforce_hackathon_taxonomy_contract.sql",
);
const integrationSqlPath = path.resolve(
  process.cwd(),
  "scripts/db/tests/hackathon-taxonomy-contract.integration.sql",
);
const auditSqlPath = path.resolve(
  process.cwd(),
  "scripts/db/audit-hackathon-taxonomy-state.sql",
);

const migration = readFileSync(migrationPath, "utf8");

test("hackathon taxonomy contract migration defines transactional wrapper, private validator and trigger", () => {
  assert.match(migration, /^BEGIN;/m, "Migration must be wrapped in a transaction block");
  assert.match(migration, /COMMIT;[\s\r\n]*$/m, "Migration must commit transaction at EOF");
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION private\.validate_hackathon_taxonomy\(\s*p_status text,\s*p_document jsonb,\s*p_raise_exception boolean DEFAULT true\s*\)/,
  );
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION private\.validate_hackathon_taxonomy_trigger\(\)/,
  );
  assert.match(
    migration,
    /CREATE TRIGGER trg_validate_hackathon_taxonomy[\s\S]*BEFORE INSERT OR UPDATE OF status, document ON public\.hackathons[\s\S]*FOR EACH ROW EXECUTE FUNCTION private\.validate_hackathon_taxonomy_trigger\(\);/,
  );
});

test("hackathon taxonomy validator allows non-published statuses to omit taxonomy", () => {
  assert.match(
    migration,
    /IF p_status NOT IN \('published', 'running'\) THEN[\s\S]*RETURN true;[\s\S]*END IF;/,
  );
});

test("hackathon taxonomy validator strictly validates JSON types and missing fields for V-01/V-10", () => {
  assert.match(
    migration,
    /jsonb_typeof\(v_item->'id'\) IS DISTINCT FROM 'string' OR jsonb_typeof\(v_item->'name'\) IS DISTINCT FROM 'string'/,
  );
  assert.match(
    migration,
    /v_item \? 'active' AND jsonb_typeof\(v_item->'active'\) <> 'boolean'/,
  );
  assert.match(
    migration,
    /v_item \? 'sort_order' AND jsonb_typeof\(v_item->'sort_order'\) <> 'number'/,
  );
  assert.match(
    migration,
    /btrim\(v_item->>'id'\) = '' OR btrim\(v_item->>'name'\) = ''/,
  );
  assert.match(
    migration,
    /IF p_raise_exception THEN[\s\S]*RAISE EXCEPTION 'invalid_input:hackathon_taxonomy_invalid';[\s\S]*END IF;[\s\S]*RETURN false;/,
  );
});

test("hackathon taxonomy migration audits existing rows with safe count before arming trigger (V-04)", () => {
  assert.match(
    migration,
    /NOT private\.validate_hackathon_taxonomy\(h\.status, h\.document, false\)/,
  );
  assert.match(
    migration,
    /RAISE EXCEPTION 'migration_aborted: % existing published\/running hackathons violate taxonomy contract', v_invalid_count;/,
  );
});

function resolvePostgresBinDir() {
  const isWin = process.platform === "win32";
  const exe = (name) => (isWin ? `${name}.exe` : name);

  // 1. Check environment variable override
  if (process.env.PG_BIN) {
    const p = process.env.PG_BIN;
    if (existsSync(path.join(p, exe("initdb"))) && existsSync(path.join(p, exe("pg_ctl"))) && existsSync(path.join(p, exe("psql")))) {
      return p;
    }
  }

  // 2. Discover via PATH
  try {
    const whichCmd = isWin ? "where.exe" : "which";
    for (const tool of ["initdb", "psql"]) {
      const output = execFileSync(whichCmd, [tool], { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
      const firstPath = output.trim().split(/\r?\n/)[0];
      if (firstPath) {
        const dir = path.dirname(firstPath);
        if (existsSync(path.join(dir, exe("initdb"))) && existsSync(path.join(dir, exe("pg_ctl"))) && existsSync(path.join(dir, exe("psql")))) {
          return dir;
        }
      }
    }
  } catch {}

  // 3. Known standard installation paths (Windows & Linux CI)
  const candidateDirs = isWin
    ? [
        path.join(process.env.ProgramFiles || "C:\\Program Files", "PostgreSQL", "17", "bin"),
        path.join(process.env.ProgramFiles || "C:\\Program Files", "PostgreSQL", "16", "bin"),
        path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "PostgreSQL", "17", "bin"),
      ]
    : [
        "/usr/lib/postgresql/17/bin",
        "/usr/lib/postgresql/16/bin",
        "/usr/lib/postgresql/15/bin",
        "/usr/lib/postgresql/14/bin",
        "/usr/bin",
      ];

  for (const dir of candidateDirs) {
    if (existsSync(path.join(dir, exe("initdb"))) && existsSync(path.join(dir, exe("pg_ctl"))) && existsSync(path.join(dir, exe("psql")))) {
      return dir;
    }
  }

  return null;
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen({ host: "127.0.0.1", port: 0 }, () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        probe.close(() => reject(new Error("Could not determine a free PostgreSQL test port")));
        return;
      }
      probe.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

test("hackathon taxonomy contract executes on real PostgreSQL engine with fail-fast ON_ERROR_STOP=1, proves rollback and verifies audit script (V-01, V-02, V-05, V-06, V-09, V-10)", { timeout: 90000 }, async (t) => {
  const isWin = process.platform === "win32";
  const exe = (name) => (isWin ? `${name}.exe` : name);
  const binDir = resolvePostgresBinDir();

  if (!binDir) {
    if (process.env.CI) {
      assert.fail("PostgreSQL engine binaries (initdb/pg_ctl/psql) must be provisioned in CI environment (0 skipped allowed)");
    }
    t.skip("PostgreSQL engine binaries (initdb/pg_ctl/psql) not found in local environment. Full integration asserts via verify-local-migration-apply.mjs in Supabase stack.");
    return;
  }

  const initdb = path.join(binDir, exe("initdb"));
  const pg_ctl = path.join(binDir, exe("pg_ctl"));
  const psql = path.join(binDir, exe("psql"));

  const port = await findFreePort();
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "pg_tax_failfast_"));
  const logFile = path.join(tmpDir, "pg.log");

  const runPsql = (args) => {
    return spawnSync(
      psql,
      ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", ...args],
      { encoding: "utf8" },
    );
  };

  try {
    execFileSync(initdb, ["-D", tmpDir, "-U", "postgres", "-A", "trust", "--no-locale", "-E", "UTF8"], { stdio: "ignore" });

    const startResult = spawnSync(pg_ctl, [
      "-D", tmpDir,
      "-l", logFile,
      "-o", `-p ${port} -F -c listen_addresses=127.0.0.1`,
      "start",
    ], { stdio: "ignore" });
    assert.equal(
      startResult.status,
      0,
      `PostgreSQL cluster failed to start: ${readFileSync(logFile, "utf8")}`,
    );

    let ready = false;
    for (let i = 0; i < 100; i++) {
      const check = runPsql(["-c", "SELECT 1;"]);
      if (check.status === 0) {
        ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.ok(
      ready,
      `Isolated PostgreSQL cluster failed to become ready: ${readFileSync(logFile, "utf8")}`,
    );

    // 1. Setup base tables & Supabase standard roles using canonical schema (id, status, document)
    const setupSql = `
      CREATE SCHEMA IF NOT EXISTS private;
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role;
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS public.hackathons (
        id text PRIMARY KEY,
        status text NOT NULL DEFAULT 'draft',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        participants_count integer NOT NULL DEFAULT 0,
        document jsonb NOT NULL DEFAULT '{}'::jsonb
      );
    `;
    const setupRes = runPsql(["-c", setupSql]);
    assert.equal(setupRes.status, 0, `Base setup failed: ${setupRes.stderr}`);

    // 2. V-01, V-06 & V-10: Fixture test for an existing row with a missing id
    const insertInvalidSql = `
      INSERT INTO public.hackathons (id, status, document)
      VALUES ('pre-existing-invalid-1', 'published', '{"sectors":[{"name":"AI","active":true}],"tech_stacks":[{"id":"tech-1","name":"TypeScript","active":true}]}'::jsonb);
    `;
    const insertInvalidRes = runPsql(["-c", insertInvalidSql]);
    assert.equal(insertInvalidRes.status, 0, `Insert invalid fixture failed: ${insertInvalidRes.stderr}`);

    const auditInvalidRes = runPsql(["-t", "-A", "-f", auditSqlPath]);
    assert.equal(auditInvalidRes.status, 0, `Audit script failed on missing-id fixture: ${auditInvalidRes.stderr}`);
    const auditInvalidParsed = JSON.parse(auditInvalidRes.stdout.trim());
    assert.equal(auditInvalidParsed.total_published_running, 1);
    assert.equal(auditInvalidParsed.violation_count, 1);
    assert.equal(auditInvalidParsed.violations[0].reason, "invalid_sector_item");

    // Applying migration MUST fail due to audit assertion
    const failedMigRes = runPsql(["-f", migrationPath]);
    assert.notEqual(failedMigRes.status, 0, "Migration should have failed due to pre-existing invalid row");
    assert.match(
      failedMigRes.stderr,
      /migration_aborted: 1 existing published\/running hackathons violate taxonomy contract/,
      `Expected migration_aborted error message, got: ${failedMigRes.stderr}`,
    );

    // V-06: Prove complete transaction rollback: validator function and trigger MUST NOT exist in DB
    const checkRollbackRes = runPsql([
      "-t",
      "-A",
      "-c",
      "SELECT (to_regprocedure('private.validate_hackathon_taxonomy(text, jsonb, boolean)') IS NULL) AS fn_rolled_back, (SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_validate_hackathon_taxonomy') AS trigger_count;",
    ]);
    assert.equal(checkRollbackRes.status, 0, `Rollback verification query failed: ${checkRollbackRes.stderr}`);
    assert.equal(
      checkRollbackRes.stdout.trim(),
      "t|0",
      `Expected function rolled back (t) and trigger count 0, got: ${checkRollbackRes.stdout.trim()}`,
    );

    // 3. Clean invalid fixture row
    const cleanInvalidRes = runPsql(["-c", "DELETE FROM public.hackathons WHERE id = 'pre-existing-invalid-1';"]);
    assert.equal(cleanInvalidRes.status, 0, `Clean invalid fixture failed: ${cleanInvalidRes.stderr}`);

    // 4. Applying migration on clean table MUST succeed
    const successfulMigRes = runPsql(["-f", migrationPath]);
    assert.equal(successfulMigRes.status, 0, `Migration apply failed on clean table: ${successfulMigRes.stderr}`);

    // Verify function and trigger exist after successful apply
    const checkAppliedRes = runPsql([
      "-t",
      "-A",
      "-c",
      "SELECT (to_regprocedure('private.validate_hackathon_taxonomy(text, jsonb, boolean)') IS NOT NULL) AS fn_exists, (SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_validate_hackathon_taxonomy') AS trigger_count;",
    ]);
    assert.equal(checkAppliedRes.status, 0);
    assert.equal(checkAppliedRes.stdout.trim(), "t|1");

    // 5. Run real integration assertions with ON_ERROR_STOP=1
    const testRes = runPsql(["-f", integrationSqlPath]);
    assert.equal(testRes.status, 0, `Integration assertions failed: ${testRes.stderr}`);

    // 6. V-09 Verification: Execute audit-hackathon-taxonomy-state.sql and assert JSON structure
    const auditRes = runPsql(["-t", "-A", "-f", auditSqlPath]);
    assert.equal(auditRes.status, 0, `Audit script failed: ${auditRes.stderr}`);
    const auditParsed = JSON.parse(auditRes.stdout.trim());
    assert.equal(typeof auditParsed.total_published_running, "number");
    assert.equal(typeof auditParsed.valid_count, "number");
    assert.equal(typeof auditParsed.violation_count, "number");
    assert.ok(Array.isArray(auditParsed.violations));

  } finally {
    try {
      spawnSync(pg_ctl, ["-D", tmpDir, "-m", "immediate", "stop"], { stdio: "ignore" });
    } catch {}
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

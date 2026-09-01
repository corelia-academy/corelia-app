import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const pnpmShell = process.platform === "win32";
const sqlTestPath = resolve(process.cwd(), "scripts/db/tests/learner-ai-retirement.integration.sql");

console.log("===============================================================================");
console.log(" CORELIA DB OPTIMIZATION: LOCAL DISPOSABLE DATABASE INTEGRATION GATE");
console.log(" Target: Pinned strictly to local disposable database (--local)");
console.log("===============================================================================\n");

// 0. Remote Safety Check: Ensure we never run against remote
if (process.env.SUPABASE_DB_URL && !process.env.SUPABASE_DB_URL.includes("127.0.0.1") && !process.env.SUPABASE_DB_URL.includes("localhost")) {
  console.error("[REMOTE_SAFETY_VIOLATION] Refusing to run local verification against non-local database URL.");
  process.exit(1);
}

// 1. Check Docker environment
console.log("[STEP 1/3] Checking Docker daemon status...");
try {
  execFileSync("docker", ["info"], { stdio: "ignore", shell: false });
  console.log("✓ Docker daemon is active and responsive.\n");
} catch (dockerErr) {
  console.error("\n[BLOCKED_DOCKER_DAEMON] Local Docker engine is stopped or unreachable.");
  console.error("Diagnostic: Unable to connect to local docker engine pipe / socket.");
  console.error("Resolution:");
  console.error("  1. Start Docker Desktop (Windows/macOS) or run 'systemctl start docker' (Linux).");
  console.error("  2. Re-run 'pnpm db:verify:local'.");
  console.error("Hard Safety: This gate is strictly pinned to --local and will never target remote environments.");
  process.exit(1);
}

// 2. Clean recreate from zero
console.log("[STEP 2/3] Executing clean recreate from zero via canonical migration chain...");
try {
  const resetArgs = ["exec", "supabase", "db", "reset", "--local", "--no-seed", "--yes"];
  execFileSync(command, resetArgs, { stdio: "inherit", shell: pnpmShell });
  console.log("✓ Database cleanly recreated. All migrations applied successfully.\n");
} catch (resetErr) {
  console.error("\n[MIGRATION_RESET_FAILURE] Failed to reset and apply canonical migration chain.");
  console.error("Diagnostic: A migration syntax error, constraint conflict, or migration order issue occurred.");
  process.exit(1);
}

// 3. Execute retained SQL integration suite.
console.log("[STEP 3/3] Executing retained SQL integration assertions...");
if (!existsSync(sqlTestPath)) {
  console.error(`\n[HARNESS_CONFIGURATION_FAILURE] SQL integration test file missing at ${sqlTestPath}`);
  process.exit(1);
}

try {
  const queryArgs = ["exec", "supabase", "db", "query", "--local", "--file", sqlTestPath];
  execFileSync(command, queryArgs, { stdio: "inherit", shell: pnpmShell });
  console.log("✓ SQL integration test suite executed successfully.\n");
} catch (sqlErr) {
  console.error("\n[INTEGRATION_SQL_FAILURE] SQL assertion failed during database integration testing.");
  process.exit(1);
}

console.log("===============================================================================");
console.log(" ALL DATABASE INTEGRATION GATES PASSED (100% SUCCESS)");
console.log("===============================================================================");

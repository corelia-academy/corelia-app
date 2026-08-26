import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const sqlTestPath = resolve(process.cwd(), "scripts/db/tests/g2-r1-db-integration.sql");
const concurrencyTestPath = resolve(process.cwd(), "scripts/db/tests/g2-r1-concurrency.integration.mjs");
const r4PaymentSqlTestPath = resolve(process.cwd(), "scripts/db/tests/r4-payment-refund-integration.sql");
const r4PaymentConcurrencyPath = resolve(process.cwd(), "scripts/db/tests/r4-payment-concurrency.integration.mjs");
const r5AiRetirementSqlTestPath = resolve(process.cwd(), "scripts/db/tests/r5-ai-financial-retirement-integration.sql");
const r5PaymentHttpE2ePath = resolve(process.cwd(), "scripts/db/tests/r5-payment-http-e2e.integration.mjs");

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
console.log("[STEP 1/5] Checking Docker daemon status...");
try {
  execFileSync("docker", ["info"], { stdio: "ignore", shell: true });
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
console.log("[STEP 2/5] Executing clean recreate from zero via canonical migration chain...");
try {
  const resetArgs = ["exec", "supabase", "db", "reset", "--local", "--no-seed", "--yes"];
  execFileSync(command, resetArgs, { stdio: "inherit", shell: true });
  console.log("✓ Database cleanly recreated. All migrations applied successfully.\n");
} catch (resetErr) {
  console.error("\n[MIGRATION_RESET_FAILURE] Failed to reset and apply canonical migration chain.");
  console.error("Diagnostic: A migration syntax error, constraint conflict, or migration order issue occurred.");
  process.exit(1);
}

// 3. Execute SQL Integration Suite (RLS, FK, Triggers, RPC Authorization, Entitlements)
console.log("[STEP 3/5] Executing SQL integration test assertions (RLS, FK, triggers, RPC, entitlement)...");
if (!existsSync(sqlTestPath)) {
  console.error(`\n[HARNESS_CONFIGURATION_FAILURE] SQL integration test file missing at ${sqlTestPath}`);
  process.exit(1);
}

try {
  const queryArgs = ["exec", "supabase", "db", "query", "--local", "--file", sqlTestPath];
  execFileSync(command, queryArgs, { stdio: "inherit", shell: true });
  if (!existsSync(r4PaymentSqlTestPath)) {
    throw new Error(`R4 payment SQL integration test file missing at ${r4PaymentSqlTestPath}`);
  }
  const r4QueryArgs = ["exec", "supabase", "db", "query", "--local", "--file", r4PaymentSqlTestPath];
  execFileSync(command, r4QueryArgs, { stdio: "inherit", shell: true });
  if (!existsSync(r5AiRetirementSqlTestPath)) {
    throw new Error(`R5 AI retirement SQL integration test file missing at ${r5AiRetirementSqlTestPath}`);
  }
  const r5AiQueryArgs = ["exec", "supabase", "db", "query", "--local", "--file", r5AiRetirementSqlTestPath];
  execFileSync(command, r5AiQueryArgs, { stdio: "inherit", shell: true });
  console.log("✓ SQL integration test suites executed successfully.\n");
} catch (sqlErr) {
  console.error("\n[INTEGRATION_SQL_FAILURE] SQL assertion failed during database integration testing.");
  process.exit(1);
}

// 4. Execute Real Two-Connection Concurrency Test
console.log("[STEP 4/5] Executing real two-connection concurrency test...");
if (!existsSync(concurrencyTestPath)) {
  console.error(`\n[HARNESS_CONFIGURATION_FAILURE] Concurrency test script missing at ${concurrencyTestPath}`);
  process.exit(1);
}

try {
  execFileSync("node", [concurrencyTestPath], { stdio: "inherit", shell: true });
  if (!existsSync(r4PaymentConcurrencyPath)) {
    throw new Error(`R4 payment concurrency script missing at ${r4PaymentConcurrencyPath}`);
  }
  execFileSync("node", [r4PaymentConcurrencyPath], { stdio: "inherit", shell: true });
  console.log("✓ Two-connection concurrency tests executed successfully.\n");
} catch (concErr) {
  console.error("\n[INTEGRATION_CONCURRENCY_FAILURE] Real two-connection concurrency test failed.");
  process.exit(1);
}

console.log("[STEP 5/5] Executing local HTTP callback E2E through real Edge router/signature/DB stack...");
if (!existsSync(r5PaymentHttpE2ePath)) {
  console.error(`\n[HARNESS_CONFIGURATION_FAILURE] R5 HTTP E2E script missing at ${r5PaymentHttpE2ePath}`);
  process.exit(1);
}
try {
  execFileSync("node", [r5PaymentHttpE2ePath], { stdio: "inherit", shell: true });
  console.log("✓ Local HTTP callback E2E executed successfully.\n");
} catch (httpErr) {
  console.error("\n[INTEGRATION_HTTP_E2E_FAILURE] Real local HTTP callback E2E failed.");
  process.exit(1);
}

console.log("===============================================================================");
console.log(" ALL DATABASE INTEGRATION GATES PASSED (100% SUCCESS)");
console.log("===============================================================================");



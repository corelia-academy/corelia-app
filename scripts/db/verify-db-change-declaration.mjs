import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadJson } from "./lib/migration-baseline.mjs";

const args = process.argv.slice(2);
const valueFor = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const root = resolve(process.cwd());
const base = valueFor("--base");
const head = valueFor("--head") ?? "HEAD";
const prBodyFile = valueFor("--pr-body-file");
const labelsJson = valueFor("--labels") ?? "[]";

if (!base) {
  console.log("DB change declaration check skipped locally: pass --base <git-ref> to compare a change set.");
  process.exit(0);
}

const changed = execFileSync("git", ["diff", "--name-only", `${base}...${head}`], { cwd: root, encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);
const baseline = loadJson(resolve(root, "docs/db-baseline/baseline.json"));
const frozenPaths = new Set(baseline.migrations.map((migration) => migration.path));
const addedMigrations = changed.filter((file) => file.startsWith("supabase/migrations/") && !frozenPaths.has(file));
const unmanagedSql = changed.filter((file) => file.startsWith("supabase/") && file.endsWith(".sql") && !file.startsWith("supabase/migrations/") && !file.startsWith("supabase/templates/"));
const candidatePaths = [...unmanagedSql];

if (candidatePaths.length === 0) {
  console.log("No unmanaged SQL/schema contract candidate changed; migration declaration is not required by this heuristic.");
  process.exit(0);
}
if (addedMigrations.length > 0) {
  console.log(`DB contract candidate(s) changed and ${addedMigrations.length} new migration(s) were added.`);
  process.exit(0);
}

const body = prBodyFile ? readFileSync(resolve(prBodyFile), "utf8") : "";
const labels = JSON.parse(labelsJson);
const declaresException = /- \[[xX]\] DB change does not require a migration/.test(body) && /Exception reason:\s*\S+/i.test(body);
const hasApproval = labels.includes("db-no-migration-approved");
if (declaresException && hasApproval) {
  console.warn("WARNING: approved db-no-migration exception used. Ensure the PR explains why no canonical schema change occurred.");
  process.exit(0);
}

console.error("Database contract candidate changed without a new migration:");
for (const file of candidatePaths) console.error(`- ${file}`);
console.error("Create a new migration under supabase/migrations instead of editing live schema or released migrations.");
console.error("If this is truly not a schema change, complete the PR exception and obtain the db-no-migration-approved label.");
process.exit(1);

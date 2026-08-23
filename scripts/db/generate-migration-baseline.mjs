import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createMigrationBaseline } from "./lib/migration-baseline.mjs";

const root = resolve(process.cwd());
const output = resolve(root, process.argv[2] ?? "docs/db-baseline/baseline.json");
const contextPath = resolve(root, "docs/db-baseline/baseline-context.json");
const commitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const generatedAt = new Date().toISOString();
const baseline = createMigrationBaseline(root, { commitSha, generatedAt });
if (existsSync(contextPath)) {
  const context = JSON.parse(readFileSync(contextPath, "utf8"));
  baseline.liveMigrationHistory = context.liveMigrationHistory;
  baseline.catalogBaseline = context.catalogBaseline;
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(baseline, null, 2)}\n`);
console.log(`Wrote ${baseline.frozenMigrationCount} migration hashes to ${output}`);

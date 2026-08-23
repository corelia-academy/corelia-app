import { resolve } from "node:path";
import { loadJson, validateMigrationBaseline } from "./lib/migration-baseline.mjs";

const root = resolve(process.cwd());
const baselinePath = resolve(root, process.argv[2] ?? "docs/db-baseline/baseline.json");
const result = validateMigrationBaseline(root, loadJson(baselinePath));

if (!result.ok) {
  console.error("Migration baseline verification failed:");
  for (const error of result.errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Migration baseline verified. ${result.newMigrations.length} new migration(s) after the frozen baseline are allowed.`);
}

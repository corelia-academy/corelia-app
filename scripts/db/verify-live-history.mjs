import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compareLiveHistory } from "./lib/live-history.mjs";

const args = process.argv.slice(2);
const valueFor = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const environment = valueFor("--environment");
const input = valueFor("--input");
const expectedProjectRef = valueFor("--project-ref");
if (!environment || !input || !expectedProjectRef) {
  console.error("Usage: node scripts/db/verify-live-history.mjs --environment <main|staging> --project-ref <exact-ref> --input <read-only-export.json>");
  process.exit(1);
}

const root = resolve(process.cwd());
const baseline = JSON.parse(readFileSync(resolve(root, "docs/db-baseline/baseline.json"), "utf8"));
const allowlist = JSON.parse(readFileSync(resolve(root, "docs/db-baseline/expected-drift.json"), "utf8"));
const capture = JSON.parse(readFileSync(resolve(input), "utf8"));
const result = compareLiveHistory({ baseline, capture, allowlist, environment, expectedProjectRef });
for (const warning of result.warnings) console.warn(`WARNING: ${warning}`);
if (!result.ok) {
  for (const error of result.errors) console.error(`ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`${environment} live migration history matches the approved baseline or an explicit historical allowlist.`);
}

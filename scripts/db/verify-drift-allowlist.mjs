import { resolve } from "node:path";
import { loadJson } from "./lib/migration-baseline.mjs";
import { validateDriftAllowlist } from "./lib/drift-allowlist.mjs";

const root = resolve(process.cwd());
const result = validateDriftAllowlist(loadJson(resolve(root, "docs/db-baseline/expected-drift.json")));
if (!result.ok) {
  console.error("Expected drift allowlist verification failed:");
  for (const error of result.errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Expected drift allowlist is structurally valid and has no expired intentional entry.");
}

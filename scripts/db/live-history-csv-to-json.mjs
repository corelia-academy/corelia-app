import { readFileSync, writeFileSync } from "node:fs";

const [input, output, projectRef] = process.argv.slice(2);
if (!input || !output || !projectRef) {
  console.error("Usage: node scripts/db/live-history-csv-to-json.mjs <input.csv> <output.json> <project-ref>");
  process.exit(1);
}

const lines = readFileSync(input, "utf8").trim().split(/\r?\n/).filter(Boolean);
if (lines.shift() !== "version,name") {
  throw new Error("Unexpected read-only migration export header. Expected version,name.");
}
const migrations = lines.map((line) => {
  const [version, name] = line.split(",");
  if (!/^\d{14}$/.test(version) || !name) throw new Error(`Malformed migration export row: ${line}`);
  return { version, name };
});
writeFileSync(output, `${JSON.stringify({ projectRef, migrations }, null, 2)}\n`);

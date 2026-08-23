import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fingerprintCatalog } from "./lib/catalog-fingerprint.mjs";

const args = process.argv.slice(2);
const valueFor = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const input = valueFor("--input");
const output = valueFor("--output");

if (!input) {
  console.error("Usage: node scripts/db/catalog-fingerprint.mjs --input <catalog-export.json> [--output <fingerprint.json>]");
  process.exit(1);
}

const result = fingerprintCatalog(JSON.parse(readFileSync(resolve(input), "utf8")));
const serialized = `${JSON.stringify(result, null, 2)}\n`;
if (output) writeFileSync(resolve(output), serialized);
else process.stdout.write(serialized);

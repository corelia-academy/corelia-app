import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const container = process.argv[2] ?? "supabase_db_corelia-app";
const migrationDir = resolve("supabase/migrations");
const migrationFiles = readdirSync(migrationDir).filter((name) => name.endsWith(".sql"));
const promptMigrations = migrationFiles
  .filter((name) => readFileSync(resolve(migrationDir, name), "utf8").includes("INSERT INTO public.studio_agent_prompts"))
  .sort();
if (promptMigrations.length === 0) throw new Error("No Studio prompt migrations found.");

const rowPattern = /\('([^']+)',\s*(\d+),\s*'(A[1-6])',\s*(\$[a-z0-9_]+\$)([\s\S]*?)\4\)/g;
const expectedRows = [];
for (const file of promptMigrations) {
  const content = readFileSync(resolve(migrationDir, file), "utf8");
  for (const [, prompt_key, version, agent_role, , system_prompt] of content.matchAll(rowPattern)) {
    expectedRows.push({
      prompt_key,
      version: Number(version),
      agent_role,
      system_prompt,
    });
  }
}
if (expectedRows.length === 0) throw new Error("Expected seeded prompt rows across migrations, found 0.");
for (const row of expectedRows) {
  if (/^[\r\n]|[\r\n]$/.test(row.system_prompt)) throw new Error(`Migration prompt seed has a leading or trailing newline: ${row.prompt_key}@v${row.version}.`);
}

const sqlTest = readFileSync(resolve("scripts/db/tests/studio-agent-prompts.integration.sql"));
execFileSync("docker", ["exec", "-i", container, "psql", "-X", "-q", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], {
  input: sqlTest,
  stdio: ["pipe", "inherit", "inherit"],
});

const query = "SELECT coalesce(json_agg(json_build_object('prompt_key',prompt_key,'version',version,'agent_role',agent_role,'system_prompt',system_prompt) ORDER BY prompt_key)::text,'[]') FROM public.studio_agent_prompts;";
const output = execFileSync("docker", ["exec", container, "psql", "-X", "-qAt", "-U", "postgres", "-d", "postgres", "-c", query], { encoding: "utf8" }).trim();
const actualRows = JSON.parse(output);
if (actualRows.length !== expectedRows.length) throw new Error(`Database has ${actualRows.length} prompt rows; seed has ${expectedRows.length}.`);
const actualByKey = new Map(actualRows.map((row) => [`${row.prompt_key}@v${row.version}`, row]));
const hashes = [];
for (const expected of expectedRows) {
  const identity = `${expected.prompt_key}@v${expected.version}`;
  const actual = actualByKey.get(identity);
  if (actual && /^[\r\n]|[\r\n]$/.test(actual.system_prompt)) throw new Error(`Database prompt has a leading or trailing newline: ${identity}.`);
  if (!actual || actual.agent_role !== expected.agent_role || actual.system_prompt !== expected.system_prompt) throw new Error(`Database prompt differs from migration seed: ${identity}.`);
  const hash = createHash("sha256").update(expected.system_prompt, "utf8").digest("hex");
  hashes.push(`${identity} ${hash}`);
}
const pinnedVersions = {
  "a1-catalog-research": 7,
  "a2-brief": 9,
  "a2-research": 13,
  "a3-curriculum": 19,
  "a4-curriculum-review": 16,
  "a5-lesson": 19,
  "a6-lesson-review": 16,
};
for (const [key, version] of Object.entries(pinnedVersions)) {
  const identity = `${key}@v${version}`;
  if (!actualByKey.has(identity)) throw new Error(`Pinned prompt version is missing in database: ${identity}.`);
}
console.log("[PASS] Studio prompt roles, numeric versions, RLS, immutable mutations, and seeded bodies.");
for (const line of hashes) console.log(line);

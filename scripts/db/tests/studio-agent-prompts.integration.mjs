import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const container = process.argv[2] ?? "supabase_db_corelia-app";
const migrationDir = resolve("supabase/migrations");
const migrationFiles = readdirSync(migrationDir).filter((name) => name.endsWith(".sql"));
const promptMigrations = migrationFiles.filter((name) => readFileSync(resolve(migrationDir, name), "utf8").includes("CREATE TABLE public.studio_agent_prompts"));
if (promptMigrations.length !== 1) throw new Error(`Expected one Studio prompt migration, found ${promptMigrations.length}.`);
const migration = readFileSync(resolve(migrationDir, promptMigrations[0]), "utf8");
const insertStart = migration.indexOf("INSERT INTO public.studio_agent_prompts (prompt_key, version, agent_role, system_prompt) VALUES");
const insertEnd = migration.indexOf("\n\nALTER TABLE public.studio_agent_prompts ENABLE ROW LEVEL SECURITY;", insertStart);
if (insertStart < 0 || insertEnd < 0) throw new Error("Could not find prompt seed INSERT boundaries.");
const seedSql = migration.slice(insertStart, insertEnd);
const rowPattern = /\('([^']+)',\s*(\d+),\s*'(A[1-6])',\s*(\$[a-z0-9_]+\$)([\s\S]*?)\4\)/g;
const expectedRows = [...seedSql.matchAll(rowPattern)].map(([, prompt_key, version, agent_role, , system_prompt]) => ({
  prompt_key,
  version: Number(version),
  agent_role,
  system_prompt,
}));
if (expectedRows.length !== 7) throw new Error(`Expected 7 prompt seed rows, found ${expectedRows.length}.`);
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
console.log("[PASS] Studio prompt roles, numeric versions, RLS, immutable mutations, and seeded bodies.");
for (const line of hashes) console.log(line);

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export interface SeededPrompt {
  role: string;
  version: string;
  system: string;
}

const migrationsDirectory = resolve(process.cwd(), "supabase/migrations");
const migrations = readdirSync(migrationsDirectory).filter((name) => name.endsWith(".sql"));
const candidates = migrations.filter((name) => readFileSync(resolve(migrationsDirectory, name), "utf8").includes("CREATE TABLE public.studio_agent_prompts"));
if (candidates.length !== 1) throw new Error(`Expected exactly one migration defining studio_agent_prompts, found ${candidates.length}.`);

const migration = readFileSync(resolve(migrationsDirectory, candidates[0]!), "utf8");
const insertStart = migration.indexOf("INSERT INTO public.studio_agent_prompts (prompt_key, version, agent_role, system_prompt) VALUES");
if (insertStart < 0) throw new Error("Prompt migration seed INSERT not found.");
const insertEnd = migration.indexOf("\n\nALTER TABLE public.studio_agent_prompts ENABLE ROW LEVEL SECURITY;", insertStart);
if (insertEnd < 0) throw new Error("Prompt migration seed INSERT terminator not found.");
const seedSql = migration.slice(insertStart, insertEnd + 1);
const rowPattern = /\('([^']+)',\s*(\d+),\s*'(A[1-6])',\s*(\$[a-z0-9_]+\$)([\s\S]*?)\4\)/g;
const entries = [...seedSql.matchAll(rowPattern)];
if (entries.length !== 7) throw new Error(`Expected 7 prompt seed rows, found ${entries.length}.`);

export const SEEDED_PROMPTS = Object.fromEntries(entries.map(([, key, version, role, , system]) => {
  if (/^[\r\n]|[\r\n]$/.test(system!)) throw new Error(`Prompt seed has a leading or trailing newline: ${key}.`);
  return [key!, {
    role: role!,
    version: `v${version}`,
    system: system!,
  }];
})) as Record<string, SeededPrompt>;

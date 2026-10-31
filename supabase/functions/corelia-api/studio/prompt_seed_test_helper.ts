import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PROMPT_VERSIONS, type PromptKey } from "./prompts.ts";

export interface SeededPrompt {
  role: string;
  version: string;
  system: string;
}

const migrationsDirectory = resolve(process.cwd(), "supabase/migrations");
const migrations = readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const promptMigrations = migrations.filter((name) => {
  const content = readFileSync(resolve(migrationsDirectory, name), "utf8");
  return content.includes("INSERT INTO public.studio_agent_prompts");
});

if (promptMigrations.length === 0) {
  throw new Error("No migrations inserting into studio_agent_prompts found.");
}

const rowPattern = /\('([^']+)',\s*(\d+),\s*'(A[1-6])',\s*(\$[a-z0-9_]+\$)([\s\S]*?)\4\)/g;

const seededByKey = new Map<string, SeededPrompt[]>();

for (const migrationFile of promptMigrations) {
  const content = readFileSync(resolve(migrationsDirectory, migrationFile), "utf8");
  const matches = [...content.matchAll(rowPattern)];
  for (const [, key, version, role, , system] of matches) {
    if (/^[\r\n]|[\r\n]$/.test(system!)) {
      throw new Error(`Prompt seed has a leading or trailing newline: ${key}@v${version} in ${migrationFile}.`);
    }
    const list = seededByKey.get(key!) ?? [];
    list.push({
      role: role!,
      version: `v${version}`,
      system: system!,
    });
    seededByKey.set(key!, list);
  }
}

for (const key of Object.keys(PROMPT_VERSIONS) as PromptKey[]) {
  if (!seededByKey.has(key)) {
    throw new Error(`Expected prompt seed for ${key}, but none found.`);
  }
}

export const SEEDED_PROMPTS = Object.fromEntries(
  [...seededByKey.entries()].map(([key, versions]) => {
    const sorted = [...versions].sort((a, b) => Number(b.version.slice(1)) - Number(a.version.slice(1)));
    return [key, sorted[0]!];
  }),
) as Record<string, SeededPrompt>;

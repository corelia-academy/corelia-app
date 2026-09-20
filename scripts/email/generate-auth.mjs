import { readFileSync, writeFileSync } from "node:fs";
import { authNames, buildAuthTemplate } from "./auth.mjs";

const check = process.argv.includes("--check");
for (const name of authNames) {
  const target = new URL(`../../supabase/templates/${name}.html`, import.meta.url);
  const html = buildAuthTemplate(name);
  if (check) {
    if (readFileSync(target, "utf8") !== html) throw new Error(`Auth template out of date: ${name}. Run pnpm email:auth:generate.`);
  } else writeFileSync(target, html);
}
console.log(check ? "Auth templates are in sync." : "Generated three Auth templates.");

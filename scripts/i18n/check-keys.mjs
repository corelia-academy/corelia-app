// Verifies every locale bundle mirrors the English bundle: same keys, same
// {{placeholders}}, and plural forms that match each language's plural rules.
import { readdirSync, readFileSync } from "node:fs";

const LOCALES = ["vi", "zh-CN", "ko", "es", "zh-TW", "ja"];
const PLURAL = /_(zero|one|two|few|many|other)$/;
const rootUrl = new URL("../../src/locales/", import.meta.url);

function flatten(value, prefix = "", out = new Map()) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) flatten(child, path, out);
    else out.set(path, child);
  }
  return out;
}

const cache = new Map();
function load(locale, namespace) {
  const id = `${locale}/${namespace}`;
  if (!cache.has(id)) cache.set(id, flatten(JSON.parse(readFileSync(new URL(`${id}.json`, rootUrl), "utf8"))));
  return cache.get(id);
}

const placeholders = (text) => [...String(text).matchAll(/{{\s*([^}\s,]+)[^}]*}}/g)].map((m) => m[1]).sort();
const tags = (text) => [...String(text).matchAll(/<\/?(\d+|[a-z][\w-]*)\b[^>]*>/gi)].map((m) => m[0].replace(/\s.*>/, ">")).sort();

/** Group `key_one`/`key_other` into `key` => set of forms. */
function groupPlurals(map) {
  const bases = new Map();
  for (const [key, value] of map) {
    const match = PLURAL.exec(key);
    const base = match ? key.slice(0, match.index) : key;
    const entry = bases.get(base) ?? { forms: new Map(), plain: false };
    if (match) entry.forms.set(match[1], value);
    else entry.plain = true;
    bases.set(base, entry);
  }
  return bases;
}

export function checkLocale(locale, namespaces) {
  const problems = [];
  const categories = new Set(new Intl.PluralRules(locale).resolvedOptions().pluralCategories);
  for (const namespace of namespaces) {
    const en = groupPlurals(load("en", namespace));
    const other = groupPlurals(load(locale, namespace));
    for (const base of en.keys()) {
      const target = other.get(base);
      if (!target) { problems.push(`${locale}/${namespace}: missing ${base}`); continue; }
      const source = en.get(base);
      if (source.forms.size) {
        const missing = [...categories].filter((form) => !target.forms.has(form));
        if (missing.length) problems.push(`${locale}/${namespace}: ${base} lacks plural form(s) ${missing.join(",")}`);
      }
      const sourceText = source.forms.size ? source.forms.get("other") : load("en", namespace).get(base);
      const targetText = target.forms.size ? target.forms.get("other") : load(locale, namespace).get(base);
      if (typeof sourceText === "string" && typeof targetText === "string") {
        if (placeholders(sourceText).join() !== placeholders(targetText).join()) problems.push(`${locale}/${namespace}: ${base} placeholders differ`);
        if (tags(sourceText).join() !== tags(targetText).join()) problems.push(`${locale}/${namespace}: ${base} markup tags differ`);
      }
    }
    for (const base of other.keys()) if (!en.has(base)) problems.push(`${locale}/${namespace}: extra ${base}`);
  }
  return problems;
}

export function localeNamespaces() {
  return readdirSync(new URL("en/", rootUrl)).filter((file) => file.endsWith(".json")).map((file) => file.slice(0, -5)).sort();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const requested = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  const only = process.env.I18N_NAMESPACES?.split(",").filter(Boolean);
  const namespaces = only?.length ? only : localeNamespaces();
  const problems = (requested.length ? requested : LOCALES).flatMap((locale) => checkLocale(locale, namespaces));
  if (problems.length) {
    console.error(problems.slice(0, 200).join("\n"));
    console.error(`\n${problems.length} locale problem(s).`);
    process.exit(1);
  }
  console.log(`Locale bundles match English for ${(requested.length ? requested : LOCALES).join(", ")}.`);
}

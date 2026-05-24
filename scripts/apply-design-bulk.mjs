#!/usr/bin/env node
// Mechanical DESIGN.md pattern updates across src tsx files.
// Skips lines that look like form controls (h-10, outline-hidden, etc.)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, files);
    else if (p.endsWith(".tsx") || p.endsWith(".ts")) files.push(p);
  }
  return files;
}

function isFormControlLine(line) {
  return /h-10|h-11 w-full|outline-hidden|focus-visible:ring|min-h-24|min-h-16|peer\/menu-button|sidebar\.tsx/.test(line);
}

function transform(content, filePath) {
  let out = content;
  const rel = path.relative(root, filePath);

  out = out.replace(/hover:shadow-lg/g, "hover:shadow-card");
  out = out.replace(/shadow-2xl/g, "shadow-card");
  out = out.replace(
    /transition-all duration/g,
    "transition-[transform,background-color,border-color,box-shadow] duration",
  );
  out = out.replace(/\btransition-all\b/g, "transition-[transform,background-color,border-color,box-shadow]");

  // Palette → semantic (common patterns)
  const paletteReplacements = [
    [/text-emerald-700 dark:text-emerald-300/g, "text-success"],
    [/text-emerald-700\/90 dark:text-emerald-300\/90/g, "text-success/90"],
    [/border-emerald-500\/20 bg-emerald-500\/10/g, "border-success/20 bg-success/10"],
    [/border-emerald-500\/30 bg-emerald-500\/10/g, "border-success/30 bg-success/10"],
    [/text-amber-600 dark:text-amber-400/g, "text-warning"],
    [/text-amber-700 dark:text-amber-400/g, "text-warning"],
    [/text-amber-600/g, "text-warning"],
    [/bg-amber-500/g, "bg-warning"],
    [/border-amber-500\/40 bg-amber-500\/10/g, "border-warning/40 bg-warning/10"],
    [/border-amber-500\/30 bg-amber-500\/10/g, "border-warning/30 bg-warning/10"],
    [/border-amber-300\/60 bg-amber-50\/20/g, "border-warning/30 bg-warning/10"],
    [/dark:border-amber-500\/30 dark:bg-amber-950\/10/g, "dark:border-warning/30 dark:bg-warning/10"],
    [/dark:hover:border-amber-500\/50/g, "dark:hover:border-warning/50"],
    [/hover:border-amber-400/g, "hover:border-warning"],
    [/text-amber-500 dark:text-amber-400/g, "text-warning"],
    [/bg-amber-100 text-amber-600/g, "bg-warning/15 text-warning"],
    [/dark:bg-amber-900\/55 dark:text-amber-400/g, "dark:bg-warning/20 dark:text-warning"],
    [/text-sky-600 dark:text-sky-400/g, "text-warning"],
    [/bg-sky-50/g, "bg-warning/10"],
    [/border-sky-200/g, "border-warning/20"],
    [/bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200/g, "bg-surface-overlay text-foreground-muted"],
    [/bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400/g, "bg-surface-overlay text-foreground-subtle"],
    [/bg-emerald-50 text-emerald-700 dark:bg-emerald-950\/60 dark:text-emerald-300/g, "bg-success/10 text-success"],
    [/bg-amber-50 text-amber-700 dark:bg-amber-950\/50 dark:text-amber-300/g, "bg-warning/10 text-warning"],
  ];
  for (const [re, rep] of paletteReplacements) {
    out = out.replace(re, rep);
  }

  const lines = out.split("\n");
  const next = lines.map((line) => {
    if (isFormControlLine(line)) return line;
    let l = line;
    // Card-tier shells
    if (/rounded-lg border border-border-subtle bg-surface-base/.test(l) && !/shadow-card/.test(l)) {
      l = l.replace(
        "rounded-lg border border-border-subtle bg-surface-base",
        "rounded-2xl border border-border-subtle bg-surface-base shadow-card",
      );
    }
    if (/rounded-md border border-border-subtle bg-surface-base/.test(l) && !/shadow-card/.test(l)) {
      l = l.replace(
        "rounded-md border border-border-subtle bg-surface-base",
        "rounded-2xl border border-border-subtle bg-surface-base shadow-card",
      );
    }
    if (/rounded-xl border border-border-subtle bg-surface-base/.test(l) && !/shadow-card/.test(l)) {
      l = l.replace(
        "rounded-xl border border-border-subtle bg-surface-base",
        "rounded-2xl border border-border-subtle bg-surface-base shadow-card",
      );
    }
    // Section wrappers with only border (home sections)
    if (/rounded-lg border border-border-subtle bg-surface-base p-/.test(l) && !/shadow-card/.test(l)) {
      l = l.replace("rounded-lg border border-border-subtle bg-surface-base", "rounded-2xl border border-border-subtle bg-surface-base shadow-card");
    }
    return l;
  });
  out = next.join("\n");

  if (rel.includes("account/") && /rounded-lg border border-border-subtle bg-surface-base/.test(out)) {
    out = out.replace(
      /rounded-lg border border-border-subtle bg-surface-base/g,
      "rounded-2xl border border-border-subtle bg-surface-base shadow-card",
    );
  }

  return out;
}

let changed = 0;
for (const file of walk(root)) {
  const before = fs.readFileSync(file, "utf8");
  const after = transform(before, file);
  if (after !== before) {
    fs.writeFileSync(file, after);
    changed++;
  }
}
console.log(`Updated ${changed} files.`);

import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import { escapeHtml } from "../../supabase/functions/corelia-api/lib/html.ts";
import { emailSection, inlineEmailHtml, renderEmailFrame } from "../../supabase/functions/corelia-api/lib/mail/render.ts";

export const authNames = ["confirmation", "recovery", "reauthentication"];
const localeAction = '{{ if or (eq .Data.locale "vi") (eq .Data.locale "vn") }}';

export function buildAuthTemplate(name) {
  if (!authNames.includes(name)) throw new Error("Unknown Auth template");
  const source = readFileSync(new URL(`../../supabase/templates/source/${name}.html`, import.meta.url), "utf8");
  // HTML parsers must never interpret the quotes or branches inside Go actions.
  const actions = [];
  const mask = (html) => html.replace(/{{[\s\S]*?}}/g, (action) => {
    actions.push(action);
    return `CORELIAGOACTION${actions.length - 1}END`;
  });
  const restore = (html) => html.replace(/CORELIAGOACTION(\d+)END/g, (_, i) => actions[Number(i)]);
  const window = new Window();
  try {
    window.document.body.innerHTML = mask(source);
    const container = window.document.querySelector(".e-container");
    if (!container) throw new Error(`Missing container: ${name}`);
    const title = container.querySelector("h2")?.textContent.trim() ?? "Corelia Academy";
    const sectionsHtml = [...container.children]
      .filter((node) => !["e-header", "e-divider"].includes(node.className))
      .map((node) => emailSection(node.classList[0], inlineEmailHtml(node.innerHTML)))
      .join("\n");
    return restore(renderEmailFrame({
      locale: mask(`${localeAction}vi{{ else }}en{{ end }}`),
      title, preheader: title, sectionsHtml,
    }, { appUrl: mask("{{ .SiteURL }}") })) + "\n";
  } finally {
    window.happyDOM.abort();
  }
}

/** Fixture evaluator for the exact actions used here, not a general Go interpreter. */
export function renderAuthFixture(html, { locale, token = "123456", appUrl, confirmationUrl, redirectTo }) {
  const values = { ".Token": token, ".TokenHash": "sample-token-hash", ".SiteURL": appUrl, ".ConfirmationURL": confirmationUrl, ".RedirectTo": redirectTo };
  const branches = [];
  let output = "";
  for (const part of html.split(/({{[\s\S]*?}})/g)) {
    if (!part.startsWith("{{")) {
      if (branches.every((b) => b.active)) output += part;
      continue;
    }
    const action = part.slice(2, -2).trim().replace(/\s+/g, " ");
    if (action.startsWith("if ")) {
      const condition = action === 'if or (eq .Data.locale "vi") (eq .Data.locale "vn")'
        ? ["vi", "vn"].includes(locale)
        : action === "if .Token" ? Boolean(token) : undefined;
      if (condition === undefined) throw new Error(`Unsupported fixture action: ${action}`);
      branches.push({ active: condition, condition });
    } else if (action === "else") {
      if (!branches.length) throw new Error("Unexpected else");
      branches.at(-1).active = !branches.at(-1).condition;
    } else if (action === "end") {
      if (!branches.pop()) throw new Error("Unexpected end");
    } else if (Object.hasOwn(values, action)) {
      if (branches.every((b) => b.active)) output += escapeHtml(values[action] ?? "");
    } else throw new Error(`Unsupported fixture value: ${action}`);
  }
  if (branches.length) throw new Error("Unclosed Go conditional");
  return output;
}

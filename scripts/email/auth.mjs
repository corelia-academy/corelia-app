import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import { escapeHtml } from "../../supabase/functions/corelia-api/lib/html.ts";
import { emailSection, inlineEmailHtml, renderEmailFrame } from "../../supabase/functions/corelia-api/lib/mail/render.ts";

export const authLocales = ["en", "zh-CN", "ko", "es", "zh-TW", "vi", "ja"];
export const authNames = [
  "invite", "confirmation", "recovery", "magic_link", "email_change", "reauthentication",
  "password_changed", "email_changed", "phone_changed", "mfa_factor_enrolled",
  "mfa_factor_unenrolled", "identity_linked", "identity_unlinked",
];
// Go templates compare case-sensitively, so every accepted spelling is listed.
const caseVariants = (value) => [...new Set([value, value.toLowerCase(), value.toUpperCase()])];
const withRegions = (languages, regions) => [...new Set(languages.flatMap((language) => [
  language,
  ...regions.flatMap((region) => caseVariants(region).flatMap((r) => [`${language}-${r}`, `${language}_${r}`])),
]))];
const vietnameseVariants = [
  "vi", "vI", "Vi", "VI", "vn", "vN", "Vn", "VN",
  ...["vi", "vI", "Vi", "VI"].flatMap((language) =>
    ["vn", "vN", "Vn", "VN"].flatMap((region) => [`${language}-${region}`, `${language}_${region}`]),
  ),
];
/** Non-English locales in chain order; English is the final `else`. */
const localeVariants = {
  "zh-CN": withRegions(["zh"], ["CN", "SG", "Hans"]),
  "zh-TW": withRegions(["zh"], ["TW", "HK", "MO", "Hant"]).filter((v) => v !== "zh"),
  ko: withRegions(["ko"], ["KR"]),
  ja: withRegions(["ja"], ["JP"]),
  es: withRegions(["es"], ["ES", "MX", "AR", "CO", "US", "419"]),
  vi: vietnameseVariants,
};
const authLocaleOrder = ["zh-CN", "zh-TW", "ko", "ja", "es", "vi"];
const localeCondition = (locale) => `or ${localeVariants[locale].map((variant) => `(eq .Data.locale "${variant}")`).join(" ")}`;
const conditionToLocale = new Map(authLocaleOrder.map((locale) => [localeCondition(locale), locale]));
const translations = JSON.parse(readFileSync(new URL("../../supabase/templates/source/translations.json", import.meta.url), "utf8"));
const collapse = (text) => text.replace(/\s+/g, " ").trim();

/** `{{ if zh-CN }}..{{ else if zh-TW }}..{{ else if vi }}VI{{ else }}EN{{ end }}`; `values` maps locale to text. */
function localeChain(values) {
  return authLocaleOrder
    .map((locale, i) => `{{ ${i === 0 ? "if" : "else if"} ${localeCondition(locale)} }}${values[locale]}`)
    .join("") + `{{ else }}${values.en}{{ end }}`;
}

function expandLocaleBlocks(source, name) {
  return source.replace(
    /{{\s*if or \(eq \.Data\.locale[\s\S]*?\)\s*}}([\s\S]*?){{\s*else\s*}}([\s\S]*?){{\s*end\s*}}/g,
    (_block, vi, en) => {
      const entry = translations[collapse(en)];
      if (!entry) throw new Error(`Missing auth translations for "${collapse(en)}" in ${name}`);
      for (const locale of ["zh-CN", "zh-TW", "ko", "ja", "es"]) {
        if (!entry[locale]) throw new Error(`Missing ${locale} auth translation for "${collapse(en)}"`);
      }
      return localeChain({ ...entry, vi, en });
    },
  );
}

export function buildAuthTemplate(name) {
  if (!authNames.includes(name)) throw new Error("Unknown Auth template");
  const source = expandLocaleBlocks(
    readFileSync(new URL(`../../supabase/templates/source/${name}.html`, import.meta.url), "utf8"),
    name,
  );
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
      locale: mask(localeChain({ "zh-CN": "zh-CN", "zh-TW": "zh-TW", ko: "ko", ja: "ja", es: "es", vi: "vi", en: "en" })),
      title, preheader: title, sectionsHtml,
    }, { appUrl: mask("{{ .SiteURL }}") })) + "\n";
  } finally {
    window.happyDOM.abort();
  }
}

/** Fixture evaluator for the exact actions used here, not a general Go interpreter. */
export function renderAuthFixture(html, { locale, token = "123456", appUrl, confirmationUrl, redirectTo }) {
  const values = {
    ".Token": token, ".TokenHash": "sample-token-hash", ".SiteURL": appUrl,
    ".ConfirmationURL": confirmationUrl, ".RedirectTo": redirectTo, ".SentAt": "2026-09-20 08:00 UTC",
    ".Email": "learner@example.com", ".NewEmail": "new@example.com", ".OldEmail": "old@example.com",
    ".Phone": "+84900000001", ".OldPhone": "+84900000000", ".FactorType": "TOTP", ".Provider": "Google",
  };
  const branches = [];
  let output = "";
  for (const part of html.split(/({{[\s\S]*?}})/g)) {
    if (!part.startsWith("{{")) {
      if (branches.every((b) => b.active)) output += part;
      continue;
    }
    const action = part.slice(2, -2).trim().replace(/\s+/g, " ");
    const evaluate = (condition) => {
      const localeCode = conditionToLocale.get(condition);
      if (localeCode) return localeVariants[localeCode].includes(locale);
      if (condition === ".Token") return Boolean(token);
      throw new Error(`Unsupported fixture action: ${action}`);
    };
    if (action.startsWith("if ")) {
      const condition = evaluate(action.slice(3));
      branches.push({ active: condition, taken: condition });
    } else if (action.startsWith("else if ")) {
      if (!branches.length) throw new Error("Unexpected else if");
      const branch = branches.at(-1);
      const condition = !branch.taken && evaluate(action.slice(8));
      branch.active = condition;
      branch.taken ||= condition;
    } else if (action === "else") {
      if (!branches.length) throw new Error("Unexpected else");
      const branch = branches.at(-1);
      branch.active = !branch.taken;
      branch.taken = true;
    } else if (action === "end") {
      if (!branches.pop()) throw new Error("Unexpected end");
    } else if (Object.hasOwn(values, action)) {
      if (branches.every((b) => b.active)) output += escapeHtml(values[action] ?? "");
    } else throw new Error(`Unsupported fixture value: ${action}`);
  }
  if (branches.length) throw new Error("Unclosed Go conditional");
  return output;
}

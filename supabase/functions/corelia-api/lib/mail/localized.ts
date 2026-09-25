import { isSafeEmailUrl, renderTextTemplate, templateVariables } from "./document.ts";
import { normalizeEmailLocale, type EmailLocale } from "./locale.ts";

export type LocalizedEmailCopy = {
  subject: string;
  preheader: string;
  body_text: string;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
};
export type LocalizedEmailContent = Partial<Record<EmailLocale, LocalizedEmailCopy>>;

export function readLocalizedEmailContent(value: unknown): LocalizedEmailContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: LocalizedEmailContent = {};
  for (const locale of ["vi", "en"] as const) {
    const raw = (value as Record<string, unknown>)[locale];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const row = raw as Record<string, unknown>;
    if (!["subject", "preheader", "body_text", "cta_label", "cta_url", "image_url"].some((field) => String(row[field] ?? "").trim())) continue;
    result[locale] = {
      subject: String(row.subject ?? "").trim(), preheader: String(row.preheader ?? ""),
      body_text: String(row.body_text ?? "").trim(), cta_label: String(row.cta_label ?? "").trim() || null,
      cta_url: String(row.cta_url ?? "").trim() || null, image_url: String(row.image_url ?? "").trim() || null,
    };
  }
  return result;
}

export function localizedContentIssues(content: LocalizedEmailContent): string[] {
  const issues: string[] = [];
  if (!content.vi && !content.en) return ["content.required"];
  for (const locale of ["vi", "en"] as const) {
    const copy = content[locale];
    if (!copy) continue;
    if (!copy.subject) issues.push(`${locale}.subject`);
    if (!copy.body_text) issues.push(`${locale}.body_text`);
    const variables = templateVariables(copy.subject, copy.preheader, copy.body_text, copy.cta_label, copy.cta_url, copy.image_url);
    const samples = Object.fromEntries(variables.map((key) => [key, /url$/i.test(key) ? "https://example.com" : "value"]));
    if (copy.cta_url && !isSafeEmailUrl(renderTextTemplate(copy.cta_url, samples))) issues.push(`${locale}.cta_url`);
    if (copy.image_url && !isSafeEmailUrl(renderTextTemplate(copy.image_url, samples))) issues.push(`${locale}.image_url`);
    if (Boolean(copy.cta_label) !== Boolean(copy.cta_url)) issues.push(`${locale}.cta`);
  }
  return issues;
}

export function localizedVariables(content: LocalizedEmailContent): string[] {
  return [...new Set((["vi", "en"] as const).flatMap((locale) => {
    const copy = content[locale];
    return copy ? templateVariables(copy.subject, copy.preheader, copy.body_text, copy.cta_label, copy.cta_url, copy.image_url) : [];
  }))];
}

export function selectLocalizedEmailContent(value: unknown, locale: unknown): LocalizedEmailCopy | null {
  return resolveLocalizedEmailContent(value, locale)?.copy ?? null;
}

export function resolveLocalizedEmailContent(value: unknown, locale: unknown): { copy: LocalizedEmailCopy; locale: EmailLocale } | null {
  const content = readLocalizedEmailContent(value);
  const requested = normalizeEmailLocale(locale);
  if (content[requested]) return { copy: content[requested], locale: requested };
  if (content.vi) return { copy: content.vi, locale: "vi" };
  if (content.en) return { copy: content.en, locale: "en" };
  return null;
}

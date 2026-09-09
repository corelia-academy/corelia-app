export const PROJECT_CONTENT_LIMITS = { title: 160, summary: 1000, description: 20000, progress: 10000 } as const;
export type ProjectContent = Record<keyof typeof PROJECT_CONTENT_LIMITS, string>;
export type ContentLocale = "vi" | "en";
export function contentLocale(value: unknown): ContentLocale {
  if (value !== "vi" && value !== "en") throw new Error("invalid_input:project_locale");
  return value;
}
export function projectContent(value: unknown, partial = false): Partial<ProjectContent> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_input:project_content");
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some(key => !Object.hasOwn(PROJECT_CONTENT_LIMITS, key) && key !== "updated_at")) throw new Error("invalid_input:project_content");
  const result: Partial<ProjectContent> = {};
  for (const [field, limit] of Object.entries(PROJECT_CONTENT_LIMITS)) {
    if (partial && raw[field] === undefined) continue;
    const text = raw[field] ?? "";
    if (typeof text !== "string" || text.length > limit) throw new Error("invalid_input:project_content");
    result[field as keyof ProjectContent] = text.trim();
  }
  return result;
}
export function projectLocales(value: unknown): Partial<Record<ContentLocale, Partial<ProjectContent>>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_input:project_locales");
  return Object.fromEntries(Object.entries(value).map(([locale, content]) => [contentLocale(locale), projectContent(content, true)]));
}

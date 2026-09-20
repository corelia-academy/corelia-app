export type EmailLocale = "vi" | "en";
export type EmailLocaleSource = "profile" | "auth_metadata" | "contact" | "fallback";
export type EmailRecipientKind = "account" | "contact";

export function parseEmailLocale(value?: unknown): EmailLocale | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replaceAll("_", "-");
  const language = normalized.split("-")[0];
  if (language === "vi" || language === "vn") return "vi";
  if (language === "en") return "en";
  return null;
}

/** Email locale always falls back to English. Website locale defaults are separate. */
export function normalizeEmailLocale(value?: unknown): EmailLocale {
  return parseEmailLocale(value) ?? "en";
}

export function resolveRecipientEmailLocale(input: {
  recipientKind: EmailRecipientKind;
  profileLocale?: unknown;
  authMetadataLocale?: unknown;
  contactLocale?: unknown;
}): { locale: EmailLocale; source: EmailLocaleSource } {
  const profile = parseEmailLocale(input.profileLocale);
  if (profile) return { locale: profile, source: "profile" };
  const metadata = parseEmailLocale(input.authMetadataLocale);
  if (metadata) return { locale: metadata, source: "auth_metadata" };
  if (input.recipientKind === "contact") {
    const contact = parseEmailLocale(input.contactLocale);
    if (contact) return { locale: contact, source: "contact" };
  }
  return { locale: "en", source: "fallback" };
}

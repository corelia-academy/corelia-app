import { parseContentLocale, type ContentLocale } from "../locale.ts";

export type EmailLocale = ContentLocale;
export type EmailLocaleSource = "profile" | "auth_metadata" | "contact" | "fallback";
export type EmailRecipientKind = "account" | "contact";

export function parseEmailLocale(value?: unknown): EmailLocale | null {
  return parseContentLocale(value);
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

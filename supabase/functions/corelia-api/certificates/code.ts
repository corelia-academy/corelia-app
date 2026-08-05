/** Public certificate verification codes.
 *
 * Codes are GENERATED in SQL by private.generate_certificate_code() so that every
 * write path to enrollments.certificate_issued_at — edge handlers, seed scripts,
 * future backfills — mints one through the same trigger. There is deliberately no
 * generator here.
 *
 * What lives here is normalization/validation: a cheap fail-fast gate so malformed
 * input never reaches the database. private.normalize_certificate_code() implements
 * the identical rules and remains the authoritative last line of defense; code.test.ts
 * pins both to the same cases so they cannot drift apart silently.
 *
 * Format: CRL- followed by 10 Crockford base32 chars (~50 bits of entropy).
 */

/** Crockford base32 — omits I, L, O and U to stay unambiguous when read off paper. */
export const CERTIFICATE_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const CERTIFICATE_CODE_PREFIX = "CRL-";

const CERTIFICATE_CODE_BODY_RE = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{10}$/;

/** Canonical `CRL-XXXXXXXXXX`, or null when the input cannot be one.
 *
 * Tolerates what a human retyping off a printed certificate produces: lowercase,
 * a missing or oddly separated prefix, spaces or dashes inside the body, and the
 * Crockford confusables O/I/L (safe to fold because the generator never emits them). */
export function normalizeCertificateCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let value = raw.trim().toUpperCase();
  value = value.replace(/^CRL[-_ ]*/, "");
  value = value.replace(/[^0-9A-Z]/g, "");
  value = value.replace(/O/g, "0").replace(/[IL]/g, "1");
  if (!CERTIFICATE_CODE_BODY_RE.test(value)) return null;
  return `${CERTIFICATE_CODE_PREFIX}${value}`;
}

export function isCertificateCode(raw: unknown): boolean {
  return normalizeCertificateCode(raw) !== null;
}

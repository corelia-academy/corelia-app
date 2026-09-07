export const PROFILE_NAME_MAX_LENGTH = 160;

// Preserve accents and script joiners; remove control, bidi-override and filler
// characters that can hide content or create unbounded blank layout.
export function normalizeProfileName(value: string | null | undefined): string | null {
  const cleaned = (value ?? "")
    .normalize("NFC")
    // These code points are deliberately removed individually, including combining fillers.
    // eslint-disable-next-line no-control-regex, no-misleading-character-class
    .replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b\u200e\u200f\u202a-\u202e\u2060-\u206f\u3164\ufeff\uffa0\ufff0-\uffff]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  return cleaned.replace(/[\u200c\u200d]/gu, "").trim() ? cleaned : null;
}

export function validateProfileName(value: string | null | undefined): string | null {
  const normalized = normalizeProfileName(value);
  if (normalized && Array.from(normalized).length > PROFILE_NAME_MAX_LENGTH) {
    throw new Error("profile_name_too_long");
  }
  return normalized;
}

// Auth metadata must never prevent account initialization.
export function profileNameFromMetadata(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeProfileName(value);
  return normalized ? Array.from(normalized).slice(0, PROFILE_NAME_MAX_LENGTH).join("") : null;
}

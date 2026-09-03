const DEFAULT_MAX_LENGTH = 80;

function normalizeSlugCharacters(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/g, "");
}

/** Keeps a trailing separator while the user is still typing. */
export function normalizeSlugDraft(value: string, maxLength = DEFAULT_MAX_LENGTH): string {
  return normalizeSlugCharacters(value).slice(0, maxLength);
}

/** Produces the persisted, route-safe slug. */
export function canonicalizeSlug(value: string, maxLength = DEFAULT_MAX_LENGTH): string {
  return normalizeSlugDraft(value, maxLength).replace(/-+$/g, "");
}

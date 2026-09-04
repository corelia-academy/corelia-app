/**
 * Sanitize user-supplied redirect targets (?next= or ?redirect=)
 * to prevent Open Redirect vulnerabilities.
 */
export function sanitizeInternalRedirect(target: string | null | undefined): string {
  if (!target) return "/";
  const trimmed = target.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
  ) {
    return "/";
  }
  return trimmed;
}

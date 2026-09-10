export interface LocationLike {
  pathname?: string;
  search?: string;
  hash?: string;
}

/**
 * Sanitizes a redirect path to ensure it is a safe internal relative path.
 * Rejects external URLs, protocol-relative URLs (//), backslash bypasses, and loops to /login.
 */
export function sanitizeRedirectUrl(raw: unknown): string {
  if (typeof raw !== "string") return "/";
  const trimmed = raw.trim();
  if (!trimmed) return "/";

  // Must start with a single slash and not followed by another slash or backslash
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.startsWith("\\")) {
    return "/";
  }

  try {
    // Treat as relative to a dummy origin to parse cleanly
    const dummyOrigin = "http://localhost";
    const parsed = new URL(trimmed, dummyOrigin);

    // If host changed (e.g. from malicious parsing), reject
    if (parsed.origin !== dummyOrigin) return "/";

    const path = parsed.pathname;
    if (
      path === "/login" ||
      path.startsWith("/login/") ||
      path === "/auth" ||
      path.startsWith("/auth/")
    ) {
      return "/";
    }

    // Preserve pathname + search + hash
    const result = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return result.length > 0 ? result : "/";
  } catch {
    return "/";
  }
}

/**
 * Formats a Location-like object into a full path string (pathname + search + hash).
 */
export function formatLocationTarget(loc: LocationLike | null | undefined): string | null {
  if (!loc || typeof loc !== "object") return null;
  const pathname = loc.pathname?.trim() || "";
  if (!pathname) return null;
  const search = loc.search?.trim() || "";
  const hash = loc.hash?.trim() || "";
  return `${pathname}${search}${hash}`;
}

/**
 * Resolves the target URL to redirect to after authentication.
 * Precedence according to contract:
 * 1. searchParams "redirect"
 * 2. searchParams "redirect_to"
 * 3. searchParams "return_to"
 * 4. searchParams "next"
 * 5. location.state.from (either object { pathname, search, hash } or string)
 * 6. Fallback "/"
 */
export function resolveAuthRedirect(
  state: unknown,
  searchParams?: URLSearchParams | null,
): string {
  // 1-4: URL search params by precedence
  if (searchParams) {
    const candidateKeys = ["redirect", "redirect_to", "return_to", "next"] as const;
    for (const key of candidateKeys) {
      const val = searchParams.get(key);
      if (val) {
        const sanitized = sanitizeRedirectUrl(val);
        if (sanitized !== "/") return sanitized;
      }
    }
  }

  // 5: location.state.from
  if (state && typeof state === "object" && "from" in state) {
    const fromVal = (state as { from?: unknown }).from;
    if (typeof fromVal === "string") {
      const sanitized = sanitizeRedirectUrl(fromVal);
      if (sanitized !== "/") return sanitized;
    } else if (fromVal && typeof fromVal === "object") {
      const formatted = formatLocationTarget(fromVal as LocationLike);
      if (formatted) {
        const sanitized = sanitizeRedirectUrl(formatted);
        if (sanitized !== "/") return sanitized;
      }
    }
  }

  return "/";
}

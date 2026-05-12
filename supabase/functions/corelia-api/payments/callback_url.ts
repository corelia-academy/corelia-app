function isLoopbackHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  if (h === "localhost" || h === "::1") return true;
  return /^127(?:\.\d{1,3}){3}$/.test(h);
}

function normalizeOrigin(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function paymentCallbackOriginAllowlistFromEnv(): Set<string> {
  const rawList = Deno.env.get("CORELIA_PAYMENT_CALLBACK_ORIGINS")?.trim() ?? "";
  const fallback = Deno.env.get("CORELIA_APP_ORIGIN")?.trim() ?? "";
  const merged = rawList || fallback;
  const out = new Set<string>();
  if (!merged) return out;
  for (const item of merged.split(",")) {
    const normalized = normalizeOrigin(item);
    if (normalized) out.add(normalized);
  }
  return out;
}

export function isValidPaymentCallbackUrl(rawUrl: string, allowedOrigins: Set<string>): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username || url.password) return false;

  if (allowedOrigins.size > 0) {
    return allowedOrigins.has(url.origin);
  }

  // Safe fallback: require HTTPS except local loopback dev URLs.
  if (url.protocol === "https:") return true;
  return isLoopbackHost(url.hostname);
}

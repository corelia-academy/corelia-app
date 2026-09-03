const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gh_src", "lever-source", "source", "ref", "referrer", "trackingId",
]);

export function decodeHtmlEntities(html: string): string {
  let decoded = html;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decoded.replace(
      /&(#x[0-9a-f]+|#\d+|nbsp|amp|lt|gt|quot|apos);/gi,
      (entity, token: string) => {
        const normalized = token.toLowerCase();
        if (normalized === "nbsp") return " ";
        if (normalized === "amp") return "&";
        if (normalized === "lt") return "<";
        if (normalized === "gt") return ">";
        if (normalized === "quot") return '"';
        if (normalized === "apos") return "'";
        const codePoint = normalized.startsWith("#x")
          ? Number.parseInt(normalized.slice(2), 16)
          : Number.parseInt(normalized.slice(1), 10);
        try {
          return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
            ? String.fromCodePoint(codePoint)
            : entity;
        } catch {
          return entity;
        }
      },
    );
    if (next === decoded) break;
    decoded = next;
  }

  return decoded;
}

export function htmlToText(html: string): string {
  const decoded = decodeHtmlEntities(html);

  return decoded
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    url.hash = "";
    for (const key of Array.from(url.searchParams.keys())) {
      const normalizedKey = key.toLowerCase();
      if (TRACKING_PARAMS.has(key) || TRACKING_PARAMS.has(normalizedKey) || normalizedKey.startsWith("utm_")) {
        url.searchParams.delete(key);
      }
    }
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    url.searchParams.sort();
    return url.toString();
  } catch {
    return "";
  }
}

export function validateExternalUrl(value: string): string {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:" ? trimmed : "";
  } catch {
    return "";
  }
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "job";
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizeEmploymentType(value: unknown): string | null {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) return null;
  if (/full.?time|permanent/.test(normalized)) return "full_time";
  if (/part.?time/.test(normalized)) return "part_time";
  if (/contract|freelance/.test(normalized)) return "contract";
  if (/temporary|temp/.test(normalized)) return "temporary";
  if (/intern/.test(normalized)) return "internship";
  if (/volunteer/.test(normalized)) return "volunteer";
  return "other";
}

export function isoDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : null;
  const milliseconds = numeric != null && Math.abs(numeric) < 100_000_000_000
    ? numeric * 1_000
    : numeric;
  const date = milliseconds == null ? new Date(String(value)) : new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function finiteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

export function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(stringValue).filter(Boolean);
}

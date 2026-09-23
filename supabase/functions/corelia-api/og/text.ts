export function plainText(value: unknown, limit: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/<[^>]*>/g, " ").replace(/[`*_#>~\[\]()]/g, " ")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const chars = Array.from(clean);
  return chars.length <= limit ? clean : `${chars.slice(0, limit - 1).join("").trimEnd()}…`;
}

export function safeId(value: string): string | null {
  const id = value.trim().toLowerCase();
  return id && id.length <= 160 && /^[a-z0-9@._-]+$/.test(id) ? id : null;
}

export function dateLabel(value: unknown): string | null {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(new Date(value));
}

export async function contentRevision(parts: unknown[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(parts));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}

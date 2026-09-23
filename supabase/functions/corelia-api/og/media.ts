import type { SupabaseClient } from "../lib/supabase.ts";
import type { OgCard } from "./types.ts";

const MAX_BYTES = 2 * 1024 * 1024;
const MIME = new Map<string, string>([["image/png", "image/png"], ["image/jpeg", "image/jpeg"], ["image/webp", "image/webp"]]);

function detectedMime(data: Uint8Array): string | null {
  if (data.length >= 8 && data[0] === 137 && data[1] === 80 && data[2] === 78 && data[3] === 71) return "image/png";
  if (data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255) return "image/jpeg";
  if (data.length >= 12 && new TextDecoder().decode(data.subarray(0, 4)) === "RIFF"
    && new TextDecoder().decode(data.subarray(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export async function loadCardImage(db: SupabaseClient, card: OgCard): Promise<string | null> {
  if (!card.imagePath) return null;
  try {
    const { data, error } = await db.storage.from("app").createSignedUrl(card.imagePath, 60);
    if (error || !data?.signedUrl) return null;
    const url = new URL(data.signedUrl, Deno.env.get("SUPABASE_URL") ?? undefined);
    if (url.origin !== new URL(Deno.env.get("SUPABASE_URL")!).origin) return null;
    const response = await fetch(url, { signal: AbortSignal.timeout(3000), redirect: "error" });
    if (!response.ok) return null;
    const declaredMime = response.headers.get("Content-Type")?.split(";")[0]?.toLowerCase() ?? "";
    if (!MIME.has(declaredMime) || Number(response.headers.get("Content-Length") ?? 0) > MAX_BYTES) return null;
    if (!response.body) return null;
    const reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_BYTES) return null;
        parts.push(value);
      }
    } finally { await reader.cancel().catch(() => undefined); }
    const bytes = new Uint8Array(length);
    let position = 0;
    for (const part of parts) { bytes.set(part, position); position += part.byteLength; }
    const mime = detectedMime(bytes);
    if (!mime || mime !== declaredMime) return null;
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:${mime};base64,${btoa(binary)}`;
  } catch { return null; }
}

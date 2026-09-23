import type { SupabaseClient } from "../lib/supabase.ts";
import { loadOgCard, publicOgMeta } from "./data.ts";
import { loadCardImage } from "./media.ts";
import { renderOgImage } from "./render.tsx";
import { OG_ENTITIES, type OgEntity } from "./types.ts";

const NO_STORE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function unavailable(): Response {
  return new Response("Not Found", { status: 404, headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" } });
}

export function isOgOp(op: string): boolean { return /^og\.[a-z]+\.(?:meta|image)$/.test(op); }

export function authorizedOgRequest(req: Request): boolean {
  const expected = Deno.env.get("OG_PROXY_SECRET") ?? "";
  const received = req.headers.get("x-corelia-og-proxy-secret") ?? "";
  if (!expected || expected.length !== received.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  return difference === 0;
}

export async function handleOgRequest(req: Request, db: SupabaseClient, op: string): Promise<Response> {
  const [, entityRaw, action] = op.split(".");
  if (!OG_ENTITIES.includes(entityRaw as OgEntity)) return unavailable();
  const entity = entityRaw as OgEntity;
  const allowed = action === "meta" ? "GET" : "GET, HEAD";
  if (action !== "meta" && action !== "image") return unavailable();
  if (action === "meta" ? req.method !== "GET" : req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: { ...NO_STORE, Allow: allowed } });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  try {
    const card = await loadOgCard(db, entity, id);
    if (!card) return unavailable();
    const meta = publicOgMeta(card);
    if (action === "meta") {
      return new Response(JSON.stringify(meta), { headers: { ...NO_STORE, "Content-Type": "application/json; charset=utf-8" } });
    }
    if (url.searchParams.get("v") !== card.revision) return unavailable();
    const headers = { ...NO_STORE, "Content-Type": "image/png", ETag: `"${entity}-og-${card.id}-${card.revision}"` };
    if (req.method === "HEAD") return new Response(null, { headers });
    const imageDataUrl = await loadCardImage(db, card);
    const png = await renderOgImage(card, imageDataUrl);
    return new Response(new Uint8Array(png), { headers });
  } catch (error) {
    console.error("[og] failed", { entity, stage: action,
      error: error instanceof Error ? error.name : String((error as { code?: string })?.code ?? "unknown") });
    return new Response("Internal server error", { status: 500, headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" } });
  }
}

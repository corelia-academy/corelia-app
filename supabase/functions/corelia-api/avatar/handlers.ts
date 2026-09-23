import { createAvatar } from "@humation/core";
import { avatarAssets } from "../../../../shared/avatarAssets.ts";
import type { SupabaseClient } from "../lib/supabase.ts";
import { verifyBearerUser } from "../lib/supabase.ts";
import { parseAvatarConfig, safeAvatarConfig } from "../../../../shared/avatarConfig.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USERNAME = /^[a-zA-Z0-9_]{1,32}$/;

async function readLimitedBody(req: Request): Promise<string> {
  if (Number(req.headers.get("content-length") ?? 0) > 4096) throw new Error("Body too large");
  if (!req.body) throw new Error("Missing body");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) {
      await reader.cancel();
      throw new Error("Body too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export async function handleAvatarSave(req: Request, db: SupabaseClient): Promise<Response> {
  let userId: string;
  try { userId = (await verifyBearerUser(req, db)).id; }
  catch { return Response.json({ message: "Unauthenticated" }, { status: 401 }); }
  let input: Record<string, unknown>;
  try {
    const text = await readLimitedBody(req);
    input = JSON.parse(text);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error();
    if (Object.keys(input).some((key) => !["seed", "selections", "colors"].includes(key))) throw new Error();
    if (input.seed !== null && (typeof input.seed !== "string" || !UUID.test(input.seed))) throw new Error();
  } catch { return Response.json({ message: "Invalid avatar payload" }, { status: 400 }); }

  let config;
  try { config = parseAvatarConfig({ selections: input.selections, colors: input.colors }, avatarAssets); }
  catch { return Response.json({ message: "Invalid avatar config" }, { status: 400 }); }
  const { data, error } = await db.from("profiles")
    .update({ avatar_seed: input.seed, avatar_config: config, updated_at: new Date().toISOString() })
    .eq("id", userId).select("avatar_seed,avatar_config").single();
  if (error || !data) return Response.json({ message: "Could not save avatar" }, { status: 500 });
  return Response.json({ seed: data.avatar_seed, selections: config.selections, colors: config.colors },
    { headers: { "Cache-Control": "no-store" } });
}

export async function handleAvatarSvg(req: Request, db: SupabaseClient): Promise<Response> {
  const username = new URL(req.url).searchParams.get("username") ?? "";
  if (!USERNAME.test(username)) return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const { data, error } = await db.from("public_profiles")
    .select("id,avatar_seed,avatar_config,profile_public")
    .ilike("username", username).maybeSingle();
  if (error) return new Response("Avatar unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  if (!data || data.profile_public !== true) return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
  try {
    const config = safeAvatarConfig(data.avatar_config, avatarAssets);
    const svg = createAvatar(avatarAssets, { seed: data.avatar_seed ?? data.id, ...config }).toString();
    return new Response(svg, { headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=60, s-maxage=60",
    } });
  } catch {
    return new Response("Avatar unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

import type { SupabaseClient } from "../lib/supabase.ts";

export type MintNetwork = "staging" | "mainnet";

const CACHE = new Map<string, string>();
const TTL_MS = 60_000;
const cacheEntry = new Map<string, number>();

export async function getSetting(db: SupabaseClient, key: string): Promise<string | null> {
  const now = Date.now();
  const exp = cacheEntry.get(key);
  if (exp && now < exp && CACHE.has(key)) return CACHE.get(key)!;

  const { data, error } = await db.from("system_settings").select("value").eq("key", key).maybeSingle();
  if (error) throw new Error(error.message);
  const v = data?.value != null ? String(data.value) : null;
  if (v != null) {
    CACHE.set(key, v);
    cacheEntry.set(key, now + TTL_MS);
  }
  return v;
}

export async function getDefaultMintNetwork(db: SupabaseClient): Promise<MintNetwork> {
  const v = (await getSetting(db, "default_mint_network"))?.trim().toLowerCase();
  return v === "mainnet" ? "mainnet" : "staging";
}

export async function getMintEndpoint(db: SupabaseClient, network: MintNetwork): Promise<string> {
  const key = network === "mainnet" ? "opencampus_mainnet_endpoint" : "opencampus_staging_endpoint";
  const url = (await getSetting(db, key))?.trim();
  if (!url) {
    throw new Error(`Missing system_settings.${key}`);
  }
  return url;
}

export async function getIntSetting(db: SupabaseClient, key: string, fallback: number): Promise<number> {
  const raw = await getSetting(db, key);
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function getCoreliaLogoUrl(db: SupabaseClient): Promise<string> {
  return (await getSetting(db, "corelia_logo_url"))?.trim() ||
    "https://cdn.corelia.academy/brand/corelia-logo-1300.png";
}

export async function getAppBaseUrl(db: SupabaseClient): Promise<string> {
  const u = (await getSetting(db, "corelia_app_base_url"))?.trim();
  return u?.replace(/\/+$/, "") || "https://app.corelia.academy";
}

export function openCampusApiKey(network: MintNetwork): string {
  const staging = Deno.env.get("OPENCAMPUS_API_KEY_STAGING")?.trim() ?? "";
  const mainnet = Deno.env.get("OPENCAMPUS_API_KEY_MAINNET")?.trim() ?? "";
  const legacy = Deno.env.get("OPENCAMPUS_API_KEY")?.trim() ?? "";
  if (network === "mainnet") {
    return mainnet || legacy;
  }
  return staging || legacy;
}

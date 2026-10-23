import type { SupabaseClient } from "../lib/supabase.ts";
import { errorMessage } from "./generations.ts";

/** Days a draft course (idea, no path) survives after its last edit. Studio shows the same value (DRAFT_TTL_DAYS in src/lib/catalog.ts). */
export const DRAFT_TTL_DAYS = 30;

/** Tick: deletes expired drafts. A failure is logged and leaves the runs alone; the next tick tries again. */
export async function purgeExpiredDrafts(db: SupabaseClient): Promise<Record<string, unknown>> {
  const { data, error } = await db.rpc("studio_purge_expired_drafts", { p_ttl: `${DRAFT_TTL_DAYS} days` });
  if (error) {
    console.error("[corelia-api] studio draft purge", { error: errorMessage(error) });
    return { action: "failed" };
  }
  return { action: "purged", deleted: data as number };
}

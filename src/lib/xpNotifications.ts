import { supabase } from "@/lib/supabase";
import type { XpEntry } from "@/lib/xp";

export type XpNotificationCursor = { createdAt: string | null; ids: string[] };
const memory = new Map<string, XpNotificationCursor>();
const storageKey = (userId: string) => `corelia.xp-notifications:${userId}`;

export function readXpNotificationCursor(userId: string): XpNotificationCursor | null {
  try {
    const raw = sessionStorage.getItem(storageKey(userId));
    if (raw) {
      const value = JSON.parse(raw) as XpNotificationCursor;
      if ((value.createdAt === null || typeof value.createdAt === "string") && Array.isArray(value.ids)) return value;
    }
  } catch { /* In-memory fallback when browser storage is unavailable. */ }
  return memory.get(userId) ?? null;
}

export function saveXpNotificationCursor(userId: string, cursor: XpNotificationCursor) {
  memory.set(userId, cursor);
  try { sessionStorage.setItem(storageKey(userId), JSON.stringify(cursor)); } catch { /* Keep the in-memory cursor. */ }
}

export function advanceXpNotifications(cursor: XpNotificationCursor, rows: XpEntry[]) {
  const fresh = rows.filter((row) => !cursor.createdAt || row.created_at > cursor.createdAt
    || (row.created_at === cursor.createdAt && !cursor.ids.includes(row.id)));
  const latest = rows.reduce((at, row) => !at || row.created_at > at ? row.created_at : at, cursor.createdAt);
  const ids = new Set(latest === cursor.createdAt ? cursor.ids : []);
  for (const row of rows) if (row.created_at === latest) ids.add(row.id);
  return {
    cursor: { createdAt: latest, ids: [...ids] },
    fresh,
    // Historical backfills have no trustworthy activity timestamp.
    awards: fresh.filter((row) => row.points > 0 && row.occurred_at !== null),
  };
}

export async function initializeXpNotifications(userId: string): Promise<XpNotificationCursor> {
  const saved = readXpNotificationCursor(userId);
  if (saved) return saved;
  const { data, error } = await supabase.from("user_point_ledger").select("id,created_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  const latest = data?.[0];
  // Include every record at the latest timestamp in the initial baseline.
  let ids: string[] = [];
  if (latest) {
    const result = await supabase.from("user_point_ledger").select("id")
      .eq("user_id", userId).eq("created_at", latest.created_at);
    if (result.error) throw new Error(result.error.message);
    ids = (result.data ?? []).map((row) => row.id);
  }
  const cursor = { createdAt: latest?.created_at ?? null, ids };
  saveXpNotificationCursor(userId, cursor);
  return cursor;
}

export async function getXpNotificationEntries(userId: string, cursor: XpNotificationCursor): Promise<XpEntry[]> {
  const rows: XpEntry[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = supabase.from("user_point_ledger")
      .select("id,source,points,entity_type,entity_id,occurred_at,created_at,reason")
      .eq("user_id", userId).order("created_at").order("id").range(offset, offset + 999);
    if (cursor.createdAt) query = query.gte("created_at", cursor.createdAt);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []) as XpEntry[]);
    if (!data || data.length < 1000) return rows;
  }
}

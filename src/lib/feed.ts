import { supabase } from "@/lib/supabase";
import type { ActivityEvent } from "@/types/feed";

export interface GetFeedOptions {
  cursor?: string | null;
  limit?: number;
  filter?: string[] | null;
}

export async function getFeed(options: GetFeedOptions = {}): Promise<ActivityEvent[]> {
  const { data, error } = await supabase.rpc("get_feed_v1", {
    p_cursor: options.cursor ?? null,
    p_limit: options.limit ?? 20,
    p_filter: options.filter ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as ActivityEvent[];
}

export async function getActorActivity(
  actorId: string,
  options: GetFeedOptions = {},
): Promise<ActivityEvent[]> {
  let query = supabase
    .from("activity_events")
    .select("*")
    .eq("actor_id", actorId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(options.limit ?? 10, 1), 50));

  if (options.cursor) query = query.lt("created_at", options.cursor);
  if (options.filter?.length) query = query.in("verb", options.filter);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ActivityEvent[];
}

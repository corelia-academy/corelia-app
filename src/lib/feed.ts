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

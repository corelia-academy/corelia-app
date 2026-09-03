import { supabase } from "@/lib/supabase";
import type { ActivityEvent } from "@/types/feed";

export interface GetFeedOptions {
  cursor?: string | null;
  limit?: number;
  filter?: string[] | null;
  signal?: AbortSignal;
}

export interface FeedActor {
  id: string;
  username: string | null;
  ocid: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface FeedPageData {
  events: ActivityEvent[];
  actors: Record<string, FeedActor>;
}

export async function getFeed(options: GetFeedOptions = {}): Promise<ActivityEvent[]> {
  let request = supabase.rpc("get_feed_v1", {
    p_cursor: options.cursor ?? null,
    p_limit: options.limit ?? 20,
    p_filter: options.filter ?? null,
  });
  if (options.signal) request = request.abortSignal(options.signal);
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return (data ?? []) as ActivityEvent[];
}

export async function getFeedPage(options: GetFeedOptions = {}): Promise<FeedPageData> {
  const events = await getFeed(options);
  const actorIds = Array.from(new Set(events.map((event) => event.actor_id)));
  if (actorIds.length === 0) return { events, actors: {} };

  let request = supabase
    .from("public_profiles")
    .select("id,username,ocid,full_name,avatar_url")
    .in("id", actorIds);
  if (options.signal) request = request.abortSignal(options.signal);
  const { data, error } = await request;
  if (error) throw new Error(error.message);

  const actors = Object.fromEntries(
    ((data ?? []) as FeedActor[]).map((actor) => [actor.id, actor]),
  );
  return { events, actors };
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

function activityEventFromRecord(record: Record<string, unknown>): ActivityEvent | null {
  if (
    typeof record.id !== "number" ||
    typeof record.actor_id !== "string" ||
    typeof record.verb !== "string" ||
    typeof record.object_type !== "string" ||
    typeof record.object_id !== "string" ||
    typeof record.created_at !== "string"
  ) return null;

  return {
    id: record.id,
    actor_id: record.actor_id,
    verb: record.verb,
    object_type: record.object_type,
    object_id: record.object_id,
    target_type: typeof record.target_type === "string" ? record.target_type : null,
    target_id: typeof record.target_id === "string" ? record.target_id : null,
    payload: record.payload && typeof record.payload === "object"
      ? record.payload as Record<string, unknown>
      : {},
    visibility: record.visibility === "followers" || record.visibility === "private"
      ? record.visibility
      : "public",
    created_at: record.created_at,
  };
}

export function subscribeToActivityEvents(
  concernId: string,
  onInsert: (event: ActivityEvent) => void,
): () => void {
  const channel = supabase
    .channel(`activity-events:${concernId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "activity_events" },
      (payload) => {
        const event = activityEventFromRecord(payload.new);
        if (event) onInsert(event);
      },
    )
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

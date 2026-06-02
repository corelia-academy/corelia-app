import type { ActivityEvent, FeedBundle } from "@/types/feed";

const BUNDLE_VERBS = new Set(["user.completed_section", "user.followed_user"]);

function eventDay(value: string): string {
  return value.slice(0, 10);
}

function bundleKey(event: ActivityEvent): string | null {
  if (!BUNDLE_VERBS.has(event.verb)) return null;
  const day = eventDay(event.created_at);

  if (event.verb === "user.completed_section") {
    return [
      event.actor_id,
      event.verb,
      event.object_type,
      event.object_id,
      day,
    ].join("|");
  }

  if (event.verb === "user.followed_user") {
    return [event.actor_id, event.verb, day].join("|");
  }

  return null;
}

export function bundleFeedEvents(events: ActivityEvent[]): FeedBundle[] {
  const buckets = new Map<string, { events: ActivityEvent[]; firstIndex: number }>();

  events.forEach((event, index) => {
    const key = bundleKey(event);
    if (!key) return;
    const bucket = buckets.get(key);
    if (bucket) bucket.events.push(event);
    else buckets.set(key, { events: [event], firstIndex: index });
  });

  const emitted = new Set<string>();
  const entries: FeedBundle[] = [];

  events.forEach((event, index) => {
    const key = bundleKey(event);
    const bucket = key ? buckets.get(key) : null;

    if (!key || !bucket || bucket.events.length < 2) {
      entries.push({
        kind: "single",
        key: `single:${event.id}`,
        events: [event],
        created_at: event.created_at,
      });
      return;
    }

    if (emitted.has(key) || bucket.firstIndex !== index) return;

    emitted.add(key);
    entries.push({
      kind: "bundle",
      key: `bundle:${key}`,
      events: bucket.events,
      created_at: bucket.events[0]?.created_at ?? event.created_at,
    });
  });

  return entries;
}

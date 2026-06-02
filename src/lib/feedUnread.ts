const FEED_LAST_READ_PREFIX = "corelia.feedLastReadAt.v1";
export const FEED_READ_EVENT = "corelia:feed-read";

function storageKey(userId: string): string {
  return `${FEED_LAST_READ_PREFIX}:${userId}`;
}

export function readFeedLastReadAt(userId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

export function markFeedRead(userId: string, value: string = new Date().toISOString()): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), value);
    window.dispatchEvent(new CustomEvent(FEED_READ_EVENT, { detail: { userId, value } }));
  } catch {
    // ignore
  }
}

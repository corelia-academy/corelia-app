export function normalizeYoutubeVideoId(value: string): string | null {
  const trimmed = value.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) {
      const first = url.pathname.split("/").filter(Boolean)[0];
      return first && /^[a-zA-Z0-9_-]{11}$/.test(first) ? first : null;
    }
    const watchId = url.searchParams.get("v");
    if (watchId && /^[a-zA-Z0-9_-]{11}$/.test(watchId)) return watchId;
    const embedId = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/)?.[1];
    if (embedId && /^[a-zA-Z0-9_-]{11}$/.test(embedId)) return embedId;
    const shortsId = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/)?.[1];
    return shortsId && /^[a-zA-Z0-9_-]{11}$/.test(shortsId) ? shortsId : null;
  } catch {
    return null;
  }
}

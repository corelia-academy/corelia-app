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
    return embedId && /^[a-zA-Z0-9_-]{11}$/.test(embedId) ? embedId : null;
  } catch {
    return null;
  }
}

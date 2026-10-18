export function getYouTubeId(input: string): string | null {
  try {
    const url = new URL(input);

    if (url.hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }

    const isYouTube =
      url.hostname === "www.youtube.com" ||
      url.hostname === "youtube.com" ||
      url.hostname === "m.youtube.com" ||
      url.hostname === "music.youtube.com";

    if (!isYouTube) return null;

    const v = url.searchParams.get("v");
    if (v) return v;

    // /embed/:id, /shorts/:id
    const parts = url.pathname.split("/").filter(Boolean);
    const embedIdx = parts.indexOf("embed");
    if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
    const shortsIdx = parts.indexOf("shorts");
    if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];

    return null;
  } catch {
    return null;
  }
}

export function getYouTubeEmbedUrl(input: string): string | null {
  const id = getYouTubeId(input);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

export function getYouTubeThumbnailUrl(input: string): string | null {
  const id = getYouTubeId(input);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}


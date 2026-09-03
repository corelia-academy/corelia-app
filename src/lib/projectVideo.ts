export type ProjectVideoEmbed = {
  provider: "youtube" | "vimeo" | "loom";
  src: string;
};

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;

export function projectVideoEmbed(url: string | null | undefined): ProjectVideoEmbed | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be" || host === "youtube.com" || host === "m.youtube.com") {
    const id = host === "youtu.be"
      ? parsed.pathname.split("/").filter(Boolean)[0]
      : parsed.pathname.startsWith("/shorts/") || parsed.pathname.startsWith("/embed/")
        ? parsed.pathname.split("/").filter(Boolean)[1]
        : parsed.searchParams.get("v");
    return id && SAFE_ID.test(id) ? { provider: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}` } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = parsed.pathname.split("/").filter(Boolean).find((part) => /^\d+$/.test(part));
    return id ? { provider: "vimeo", src: `https://player.vimeo.com/video/${id}` } : null;
  }
  if (host === "loom.com") {
    const parts = parsed.pathname.split("/").filter(Boolean);
    const id = parts.find((_, index) => ["share", "embed"].includes(parts[index - 1] ?? ""));
    return id && SAFE_ID.test(id) ? { provider: "loom", src: `https://www.loom.com/embed/${id}` } : null;
  }
  return null;
}

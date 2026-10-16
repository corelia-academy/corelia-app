// Rewrites Supabase Storage image URLs to a resized/re-encoded variant.
// VITE_IMAGE_TRANSFORM selects the provider (unset/other → URLs returned unchanged):
//   "supabase"   → Supabase Image Transformation (`/render/image/...`, Pro plan or above)
//   "cloudflare" → Cloudflare Image Resizing (`/cdn-cgi/image/...`) on the zone that proxies
//                  the Supabase host (e.g. cdn.corelia.academy); needs Image Resizing enabled.
const readMode = () => (import.meta.env.VITE_IMAGE_TRANSFORM as string | undefined)?.trim().toLowerCase();

const OBJECT_PATH = /\/storage\/v1\/object\/(public|sign)\//;

type ImageUrlOptions = {
  /** Target CSS width in px; the 2x density variant is requested automatically by callers via `srcSet`. */
  width: number;
  quality?: number;
  /** Supabase only. `contain` keeps the aspect ratio and fits inside `width` (use for logos). */
  resize?: "cover" | "contain";
};

export function optimizedImageUrl(url: string | null | undefined, { width, quality = 75, resize = "cover" }: ImageUrlOptions): string {
  const mode = readMode();
  if (!url || (mode !== "supabase" && mode !== "cloudflare")) return url ?? "";
  if (!OBJECT_PATH.test(url)) return url;
  const w = Math.max(1, Math.round(width));

  if (mode === "supabase") {
    const next = new URL(url.replace("/storage/v1/object/", "/storage/v1/render/image/"));
    next.searchParams.set("width", String(w));
    next.searchParams.set("quality", String(quality));
    next.searchParams.set("resize", resize);
    return next.toString();
  }

  const source = new URL(url);
  // /cdn-cgi/ only exists on a Cloudflare-proxied hostname, not on the raw *.supabase.co host.
  if (source.hostname.endsWith(".supabase.co")) return url;
  return `${source.origin}/cdn-cgi/image/width=${w},quality=${quality},format=auto/${source.pathname.replace(/^\//, "")}${source.search}`;
}

/** `srcSet` with 1x/2x variants, or undefined when transformation is disabled/unsupported for the URL. */
export function optimizedImageSrcSet(url: string | null | undefined, width: number, opts: Omit<ImageUrlOptions, "width"> = {}): string | undefined {
  const base = optimizedImageUrl(url, { width, ...opts });
  if (!url || base === url) return undefined;
  return `${base} 1x, ${optimizedImageUrl(url, { width: width * 2, ...opts })} 2x`;
}

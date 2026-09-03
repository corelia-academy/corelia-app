import { useEffect } from "react";

interface PageMeta {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  canonicalUrl?: string;
  robots?: string;
}

function getMeta(selector: string): string {
  return document.querySelector(selector)?.getAttribute("content") ?? "";
}

function setMeta(selector: string, value: string) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute("content", value);
}

/**
 * Dynamically updates OpenGraph and Twitter meta tags for the current page.
 * Restores original values from index.html on unmount.
 */
export function usePageMeta({ title, description, image, url, canonicalUrl, robots }: PageMeta) {
  useEffect(() => {
    const prevTitle = document.title;
    const prevOgTitle = getMeta('meta[property="og:title"]');
    const prevOgDesc = getMeta('meta[property="og:description"]');
    const prevOgImage = getMeta('meta[property="og:image"]');
    const prevOgUrl = getMeta('meta[property="og:url"]');
    const prevDesc = getMeta('meta[name="description"]');
    const prevTwTitle = getMeta('meta[name="twitter:title"]');
    const prevTwDesc = getMeta('meta[name="twitter:description"]');
    const prevTwImage = getMeta('meta[name="twitter:image"]');
    const existingCanonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const previousCanonical = existingCanonical?.href ?? "";
    const canonical = canonicalUrl
      ? existingCanonical ?? document.head.appendChild(document.createElement("link"))
      : existingCanonical;
    if (canonicalUrl && canonical && !existingCanonical) canonical.rel = "canonical";
    const existingRobots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previousRobots = existingRobots?.content ?? "";
    const robotsMeta = robots
      ? existingRobots ?? document.head.appendChild(document.createElement("meta"))
      : existingRobots;
    if (robots && robotsMeta && !existingRobots) robotsMeta.name = "robots";

    if (title) {
      document.title = `${title} · Corelia Academy`;
      setMeta('meta[property="og:title"]', title);
      setMeta('meta[name="twitter:title"]', title);
    }
    if (description) {
      setMeta('meta[property="og:description"]', description);
      setMeta('meta[name="description"]', description);
      setMeta('meta[name="twitter:description"]', description);
    }
    if (image) {
      setMeta('meta[property="og:image"]', image);
      setMeta('meta[name="twitter:image"]', image);
    }
    if (url) {
      setMeta('meta[property="og:url"]', url);
    }
    if (canonicalUrl && canonical) canonical.href = canonicalUrl;
    if (robots && robotsMeta) robotsMeta.content = robots;

    return () => {
      document.title = prevTitle;
      setMeta('meta[property="og:title"]', prevOgTitle);
      setMeta('meta[property="og:description"]', prevOgDesc);
      setMeta('meta[property="og:image"]', prevOgImage);
      setMeta('meta[property="og:url"]', prevOgUrl);
      setMeta('meta[name="description"]', prevDesc);
      setMeta('meta[name="twitter:title"]', prevTwTitle);
      setMeta('meta[name="twitter:description"]', prevTwDesc);
      setMeta('meta[name="twitter:image"]', prevTwImage);
      if (existingCanonical && canonical) canonical.href = previousCanonical;
      else canonical?.remove();
      if (existingRobots && robotsMeta) robotsMeta.content = previousRobots;
      else robotsMeta?.remove();
    };
  }, [title, description, image, url, canonicalUrl, robots]);
}

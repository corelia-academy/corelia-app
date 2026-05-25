import { useEffect } from "react";

interface PageMeta {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
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
export function usePageMeta({ title, description, image, url }: PageMeta) {
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
    };
  }, [title, description, image, url]);
}

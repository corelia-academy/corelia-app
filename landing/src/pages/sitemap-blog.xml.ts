import type { APIRoute } from "astro";
import {
  BLOG_NEWS_TAB_CATEGORIES,
  articlePostUrl,
  blogCategoryUrl,
  blogConfigured,
  blogIndexUrl,
  blogTagUrl,
  caseStudyIndexUrl,
  listSitemapArticles,
  type BlogLocale,
} from "@/lib/blog";

export const prerender = false;

const ORIGIN = "https://corelia.academy";
const LOCALES: readonly BlogLocale[] = ["en", "vi"];

type Entry = { urls: Partial<Record<BlogLocale, string>>; lastmod?: Date };

const xmlEscape = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** One <url> per language version, each listing the versions that exist as hreflang siblings. */
function render(entries: Entry[]): string {
  const urls = entries.flatMap(({ urls: byLocale, lastmod }) => {
    const versions = LOCALES.filter((locale) => byLocale[locale]);
    const links = versions
      .map((locale) => `    <xhtml:link rel="alternate" hreflang="${locale}" href="${xmlEscape(ORIGIN + byLocale[locale])}"/>`)
      .join("\n");
    return versions.map((locale) => [
      "  <url>",
      `    <loc>${xmlEscape(ORIGIN + byLocale[locale])}</loc>`,
      lastmod ? `    <lastmod>${lastmod.toISOString()}</lastmod>` : null,
      versions.length > 1 ? links : null,
      "  </url>",
    ].filter(Boolean).join("\n"));
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`;
}

const both = (url: (locale: BlogLocale) => string): Entry => ({ urls: { en: url("en"), vi: url("vi") } });

/** The blog and case-study pages are server-rendered, so @astrojs/sitemap does not list them. */
export const GET: APIRoute = async () => {
  try {
    if (!blogConfigured()) throw new Error("blog_unconfigured");
    const posts = await listSitemapArticles();

    // Translations share a translation key; an article without one is listed alone.
    const articles = new Map<string, Entry>();
    for (const post of posts) {
      const key = `${post.data.contentType}:${post.data.translationKey}`;
      const entry = articles.get(key) ?? { urls: {} };
      entry.urls[post.data.locale] = articlePostUrl(post.data.locale, post);
      if (!entry.lastmod || post.data.updatedAt > entry.lastmod) entry.lastmod = post.data.updatedAt;
      articles.set(key, entry);
    }

    const blogPosts = posts.filter((post) => post.data.contentType === "blog");
    const facet = (values: (locale: BlogLocale) => Set<string>, url: (locale: BlogLocale, key: string) => string) => {
      const byLocale = { en: values("en"), vi: values("vi") };
      return [...new Set([...byLocale.en, ...byLocale.vi])].sort().map((key): Entry => ({
        urls: Object.fromEntries(LOCALES.filter((locale) => byLocale[locale].has(key)).map((locale) => [locale, url(locale, key)])),
      }));
    };
    const inLocale = (locale: BlogLocale) => blogPosts.filter((post) => post.data.locale === locale);

    const entries: Entry[] = [
      both((locale) => blogIndexUrl(locale)),
      ...Object.keys(BLOG_NEWS_TAB_CATEGORIES).map((tab) => both((locale) => `${blogIndexUrl(locale)}/${tab}`)),
      both(caseStudyIndexUrl),
      ...facet((locale) => new Set(inLocale(locale).map((post) => post.data.category)), blogCategoryUrl),
      ...facet((locale) => new Set(inLocale(locale).flatMap((post) => post.data.tags)), blogTagUrl),
      ...articles.values(),
    ];
    return new Response(render(entries), {
      headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    });
  } catch (error) {
    console.error("[sitemap] blog", error instanceof Error ? error.message : error);
    return new Response("Sitemap temporarily unavailable", { status: 503, headers: { "Retry-After": "300", "Cache-Control": "no-store" } });
  }
};

import { getCollection, type CollectionEntry } from "astro:content";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { BlogCategory, BlogMedia } from "@/lib/blogTaxonomy";
import { getYouTubeThumbnailUrl } from "@/lib/youtube";

export type BlogLocale = "vi" | "en";
export type BlogPost = CollectionEntry<"blog">;

export type BlogNewsTabKey =
  | "all"
  | "events"
  | "news"
  | "learning-methods"
  | "contests";

export const BLOG_NEWS_TAB_CATEGORIES = {
  events: ["announcements-events"],
  news: ["announcements-events"],
  "learning-methods": [
    "web3-blockchain-knowledge",
    "developer-roadmaps-tools",
    "projects-tutorials",
    "career-ecosystem-insights",
  ],
  contests: ["community-success-stories", "announcements-events"],
} as const satisfies Record<Exclude<BlogNewsTabKey, "all">, readonly BlogCategory[]>;

export function filterBlogPostsForNewsTab(
  posts: BlogPost[],
  tab: BlogNewsTabKey,
) {
  if (tab === "all") return posts;

  const categories: readonly BlogCategory[] = BLOG_NEWS_TAB_CATEGORIES[tab];
  return posts.filter((post) => categories.includes(post.data.category));
}

export const BLOG_PAGE_SIZE = 10;
export const BLOG_NEWS_PAGE_SIZE = 6;

export function blogPostSlug(slug: string) {
  return slug.replace(/^(?:en|vi)\//, "");
}

export function blogIndexUrl(locale: BlogLocale, page: number = 1) {
  if (page <= 1) return locale === "en" ? "/blog" : "/vi/blog";
  return locale === "en" ? `/blog/page/${page}` : `/vi/blog/page/${page}`;
}

export function blogPostUrl(locale: BlogLocale, slug: string) {
  const urlSlug = blogPostSlug(slug);
  return locale === "en" ? `/blog/${urlSlug}` : `/vi/blog/${urlSlug}`;
}

export function caseStudyIndexUrl(locale: BlogLocale) {
  return locale === "en" ? "/case-studies" : "/vi/case-studies";
}

export function caseStudyPostUrl(locale: BlogLocale, slug: string) {
  return `${caseStudyIndexUrl(locale)}/${blogPostSlug(slug)}`;
}

export function articlePostUrl(locale: BlogLocale, post: BlogPost) {
  return post.data.contentType === "case-study"
    ? caseStudyPostUrl(locale, post.slug)
    : blogPostUrl(locale, post.slug);
}

export async function getArticleStaticPaths(
  locale: BlogLocale,
  contentType: "blog" | "case-study",
) {
  const all = await getCollection(
    "blog",
    (entry) => !entry.data.draft && entry.data.contentType === contentType,
  );
  const alternateLocale = locale === "en" ? "vi" : "en";
  const alternatesByKey = new Map(
    all
      .filter((post) => post.data.locale === alternateLocale)
      .map((post) => [post.data.translationKey, post]),
  );

  return all
    .filter((post) => post.data.locale === locale)
    .map((post) => {
      const alternate = alternatesByKey.get(post.data.translationKey);
      const currentHref = articlePostUrl(locale, post);
      const alternateHref = alternate
        ? articlePostUrl(alternateLocale, alternate)
        : contentType === "case-study"
          ? caseStudyIndexUrl(alternateLocale)
          : blogIndexUrl(alternateLocale);
      return {
        params: { slug: blogPostSlug(post.slug) },
        props: {
          post,
          locale,
          languageHrefs: {
            [locale]: currentHref,
            [alternateLocale]: alternateHref,
          },
          alternates: alternate
            ? { [locale]: currentHref, [alternateLocale]: alternateHref }
            : { [locale]: currentHref },
        },
      };
    });
}

export function blogCategoryUrl(
  locale: BlogLocale,
  category: string,
  page: number = 1,
) {
  const base =
    locale === "en"
      ? `/blog/category/${encodeURIComponent(category)}`
      : `/vi/blog/category/${encodeURIComponent(category)}`;
  if (page <= 1) return base;
  return `${base}/page/${page}`;
}

export function blogTagUrl(locale: BlogLocale, tag: string, page: number = 1) {
  const base =
    locale === "en"
      ? `/blog/tag/${encodeURIComponent(tag)}`
      : `/vi/blog/tag/${encodeURIComponent(tag)}`;
  if (page <= 1) return base;
  return `${base}/page/${page}`;
}

export async function getBlogPosts(
  locale: BlogLocale,
  opts: { includeDrafts?: boolean } = {},
) {
  const { includeDrafts = false } = opts;
  const posts = await getCollection("blog", (entry) => {
    if (entry.data.locale !== locale) return false;
    if (entry.data.contentType === "case-study") return false;
    if (!includeDrafts && entry.data.draft) return false;
    return true;
  });

  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getCaseStudyPosts(locale: BlogLocale) {
  const posts = await getCollection("blog", (entry) =>
    !entry.data.draft &&
    entry.data.locale === locale &&
    entry.data.contentType === "case-study",
  );
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getBlogPostPairs(opts: { includeDrafts?: boolean } = {}) {
  const { includeDrafts = false } = opts;
  const all = await getCollection("blog", (entry) =>
    entry.data.contentType !== "case-study" &&
    (includeDrafts || !entry.data.draft),
  );

  const byKey = new Map<
    string,
    Partial<Record<BlogLocale, BlogPost>>
  >();

  for (const post of all) {
    const key = post.data.translationKey;
    const bucket = byKey.get(key) ?? {};
    bucket[post.data.locale] = post;
    byKey.set(key, bucket);
  }

  return byKey;
}

export type OgImage = {
  url: string;
  width?: number;
  height?: number;
  type?: string;
};

const DEFAULT_SITE_ORIGIN = "https://corelia.academy";

function toAbsoluteUrl(input: string, origin: string) {
  try {
    return new URL(input).toString();
  } catch {
    return new URL(input, origin).toString();
  }
}

function ogImageTypeFromUrl(url: string): string | undefined {
  const pathname = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })().toLowerCase();

  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg"))
    return "image/jpeg";
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".gif")) return "image/gif";
  if (pathname.endsWith(".svg")) return "image/svg+xml";
  return undefined;
}

function getOgVariantSrc(src: string) {
  if (!src.startsWith("/")) return null;

  const ogSrc = src.replace(/^(\/blog\/)(.+)$/, "$1og/$2");
  if (ogSrc === src) return null;

  const ogPath = join(process.cwd(), "public", ogSrc.slice(1));
  return existsSync(ogPath) ? ogSrc : null;
}

export function getBlogOgImage(
  media?: BlogMedia,
  opts: { siteOrigin?: string } = {},
): OgImage | null {
  if (!media) return null;
  const siteOrigin = opts.siteOrigin ?? DEFAULT_SITE_ORIGIN;

  if (media.type === "image") {
    const src = getOgVariantSrc(media.src) ?? media.src;
    const url = toAbsoluteUrl(src, siteOrigin);
    return {
      url,
      type: ogImageTypeFromUrl(url),
    };
  }

  if (media.type === "youtube") {
    const url = getYouTubeThumbnailUrl(media.url);
    if (!url) return null;
    return { url, width: 480, height: 360, type: "image/jpeg" };
  }

  return null;
}

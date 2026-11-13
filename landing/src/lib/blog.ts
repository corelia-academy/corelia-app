import {
  BLOG_CATEGORY_KEYS,
  type BlogCategory,
  type BlogMedia,
} from "@/lib/blogTaxonomy";
import { getYouTubeThumbnailUrl } from "@/lib/youtube";

export type BlogLocale = "vi" | "en";
export type BlogContentType = "blog" | "case-study";

/**
 * A published article from `public.blog_posts` (written in Admin → Blog in the learning
 * app). `slug` keeps the `<locale>/<slug>` form the URL helpers below expect. `body` is
 * the Markdown source and is only loaded for the article page (`getArticle`).
 */
export type BlogPost = {
  id: string;
  slug: string;
  body: string;
  data: {
    title: string;
    description?: string;
    date: Date;
    updatedAt: Date;
    locale: BlogLocale;
    translationKey: string;
    author?: string;
    contentType: BlogContentType;
    category: BlogCategory;
    tags: string[];
    media?: BlogMedia;
    wordCount: number;
  };
};

const SUPABASE_URL = String(import.meta.env.PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const SUPABASE_KEY = String(import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "");
/** Edge cache for upstream reads; a published or edited article shows up within this window. */
const EDGE_CACHE_SECONDS = 60;
const LIST_COLUMNS =
  "id,locale,slug,translation_key,content_type,title,description,author,category,tags,media,word_count,published_on,updated_at";

export class BlogUnavailableError extends Error {}

export function blogConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

type BlogRow = {
  id: string;
  locale: BlogLocale;
  slug: string;
  translation_key: string;
  content_type: BlogContentType;
  title: string;
  description: string | null;
  author: string | null;
  category: string;
  tags: string[] | null;
  media: BlogMedia | null;
  word_count: number | null;
  published_on: string;
  updated_at: string;
  body?: string;
};

/** Published rows only: the publishable key reads under RLS, which hides drafts. */
async function rest(params: Record<string, string>): Promise<BlogRow[]> {
  const url = `${SUPABASE_URL}/rest/v1/blog_posts?${new URLSearchParams({ status: "eq.published", ...params })}`;
  const response = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, accept: "application/json" },
    cf: { cacheTtl: EDGE_CACHE_SECONDS, cacheEverything: true },
  } as RequestInit);
  if (!response.ok) throw new BlogUnavailableError(`blog_posts_${response.status}`);
  return response.json() as Promise<BlogRow[]>;
}

function postFromRow(row: BlogRow): BlogPost {
  const category = (BLOG_CATEGORY_KEYS as readonly string[]).includes(row.category)
    ? (row.category as BlogCategory)
    : "announcements-events";
  const media = row.media && (row.media.type === "image" || row.media.type === "youtube") ? row.media : undefined;
  return {
    id: row.id,
    slug: `${row.locale}/${row.slug}`,
    body: row.body ?? "",
    data: {
      title: row.title,
      description: row.description?.trim() || undefined,
      date: new Date(row.published_on),
      updatedAt: new Date(row.updated_at),
      locale: row.locale,
      translationKey: row.translation_key,
      author: row.author?.trim() || undefined,
      contentType: row.content_type,
      category,
      tags: Array.isArray(row.tags) ? row.tags : [],
      media,
      wordCount: row.word_count ?? 0,
    },
  };
}

// One page renders several sections from the same list; share the read between them
// (and between requests landing on the same isolate within the cache window).
const listCache = new Map<string, { at: number; posts: Promise<BlogPost[]> }>();

/**
 * Published articles of one kind in one language, newest first, without bodies.
 * Without Supabase build variables the list is empty, so local builds still work.
 */
function listPosts(locale: BlogLocale, contentType: BlogContentType): Promise<BlogPost[]> {
  if (!blogConfigured()) return Promise.resolve([]);
  const key = `${locale}:${contentType}`;
  const cached = listCache.get(key);
  if (cached && Date.now() - cached.at < EDGE_CACHE_SECONDS * 1000) return cached.posts;
  const posts = rest({
    select: LIST_COLUMNS,
    locale: `eq.${locale}`,
    content_type: `eq.${contentType}`,
    order: "published_on.desc,created_at.desc",
  }).then((rows) => rows.map(postFromRow));
  listCache.set(key, { at: Date.now(), posts });
  posts.catch(() => listCache.delete(key));
  return posts;
}

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

export type Article = {
  post: BlogPost;
  locale: BlogLocale;
  /** Language switcher targets: the translation, or the other language's index. */
  languageHrefs: Record<BlogLocale, string>;
  /** hreflang alternates: only languages the article exists in. */
  alternates: Partial<Record<BlogLocale, string>>;
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The published article at `/blog/<slug>` or `/case-studies/<slug>`, with its body. */
export async function getArticle(
  locale: BlogLocale,
  contentType: BlogContentType,
  slug: string | undefined,
): Promise<Article | null> {
  if (!slug || slug.length > 200 || !SLUG_PATTERN.test(slug)) return null;
  const [row] = await rest({
    select: `${LIST_COLUMNS},body`,
    locale: `eq.${locale}`,
    content_type: `eq.${contentType}`,
    slug: `eq.${slug}`,
    limit: "1",
  });
  if (!row) return null;
  const post = postFromRow(row);

  const alternateLocale: BlogLocale = locale === "en" ? "vi" : "en";
  const [alternateRow] = await rest({
    select: LIST_COLUMNS,
    locale: `eq.${alternateLocale}`,
    translation_key: `eq.${post.data.translationKey}`,
    limit: "1",
  });
  const alternate = alternateRow ? postFromRow(alternateRow) : null;
  const currentHref = articlePostUrl(locale, post);
  const alternateHref = alternate
    ? articlePostUrl(alternateLocale, alternate)
    : contentType === "case-study"
      ? caseStudyIndexUrl(alternateLocale)
      : blogIndexUrl(alternateLocale);

  return {
    post,
    locale,
    languageHrefs: { [locale]: currentHref, [alternateLocale]: alternateHref } as Record<BlogLocale, string>,
    alternates: alternate
      ? { [locale]: currentHref, [alternateLocale]: alternateHref }
      : { [locale]: currentHref },
  };
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

export function getBlogPosts(locale: BlogLocale) {
  return listPosts(locale, "blog");
}

export function getCaseStudyPosts(locale: BlogLocale) {
  return listPosts(locale, "case-study");
}

/** `/blog/page/N` and `/blog/<tab>/page/N`: null when the tab or page does not exist. */
export async function getBlogNewsPage(
  locale: BlogLocale,
  tab: string | undefined,
  pageParam: string | undefined,
): Promise<{ tab: BlogNewsTabKey; page: number } | null> {
  if (tab !== "all" && !(tab && tab in BLOG_NEWS_TAB_CATEGORIES)) return null;
  const page = parsePage(pageParam);
  if (page === null) return null;
  const posts = filterBlogPostsForNewsTab(await getBlogPosts(locale), tab as BlogNewsTabKey);
  if (page > Math.ceil(posts.length / BLOG_NEWS_PAGE_SIZE)) return null;
  return { tab: tab as BlogNewsTabKey, page };
}

export type BlogFacetPage = { key: string; posts: BlogPost[]; page: number; totalPages: number };

/**
 * One page of a category or tag listing: null when nothing is published under it or the
 * page is out of range. Without `pageParam` it is page 1; `/page/N` routes start at 2.
 */
export async function getBlogFacetPage(
  locale: BlogLocale,
  facet: "category" | "tag",
  key: string | undefined,
  pageParam?: string,
): Promise<BlogFacetPage | null> {
  if (!key) return null;
  const page = pageParam === undefined ? 1 : parsePage(pageParam);
  if (page === null) return null;
  const posts = (await getBlogPosts(locale)).filter((post) =>
    facet === "category" ? post.data.category === key : post.data.tags.includes(key),
  );
  const totalPages = Math.ceil(posts.length / BLOG_PAGE_SIZE);
  if (page > totalPages) return null;
  return { key, posts: posts.slice((page - 1) * BLOG_PAGE_SIZE, page * BLOG_PAGE_SIZE), page, totalPages };
}

/** Page number of a `/page/N` route (2 and up; page 1 is the unpaginated URL). */
function parsePage(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d{0,3}$/.test(value)) return null;
  const page = Number(value);
  return page >= 2 ? page : null;
}

/** Published articles in both languages for the blog sitemap. */
export async function listSitemapArticles(): Promise<BlogPost[]> {
  const lists = await Promise.all([
    listPosts("en", "blog"),
    listPosts("vi", "blog"),
    listPosts("en", "case-study"),
    listPosts("vi", "case-study"),
  ]);
  return lists.flat();
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

export function getBlogOgImage(
  media?: BlogMedia,
  opts: { siteOrigin?: string } = {},
): OgImage | null {
  if (!media) return null;
  const siteOrigin = opts.siteOrigin ?? DEFAULT_SITE_ORIGIN;

  if (media.type === "image") {
    // `ogSrc` is the 1200×630 variant some imported cover images have.
    const src = media.ogSrc ?? media.src;
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

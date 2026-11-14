import { BLOG_CATEGORY_KEYS, BLOG_TAG_KEYS, type BlogCategory, type BlogLocale, type BlogMedia } from "@corelia/ui/blog";

import type { BlogContentType, BlogPostInput, BlogPostRecord, BlogStatus } from "@/types/blog";

export const BLOG_MIN_TAGS = 3;
export const BLOG_MAX_TAGS = 6;
/** The public `cdn` bucket's per-file limit. */
export const BLOG_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const BLOG_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"];

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** URL slug from a title: lowercase ASCII words joined by hyphens (Vietnamese accents removed). */
export function slugifyBlogTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/, "");
}

/** Path of the article on the landing site. */
export function blogPublicPath(post: { locale: BlogLocale; slug: string; content_type: BlogContentType }): string {
  const section = post.content_type === "case-study" ? "case-studies" : "blog";
  return `${post.locale === "en" ? "" : "/vi"}/${section}/${post.slug}`;
}

export type BlogMediaKind = "none" | "image" | "youtube";

export type BlogPostForm = {
  locale: BlogLocale;
  contentType: BlogContentType;
  title: string;
  slug: string;
  translationKey: string;
  description: string;
  author: string;
  category: BlogCategory;
  tags: string[];
  publishedOn: string;
  mediaKind: BlogMediaKind;
  imageSrc: string;
  imageAlt: string;
  imageFit: "cover" | "contain";
  /** Social-card variant kept from an imported cover; dropped when the image changes. */
  imageOgSrc: string;
  youtubeUrl: string;
  body: string;
};

export function todayIsoDate(now: Date = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function emptyBlogPostForm(locale: BlogLocale = "vi"): BlogPostForm {
  return {
    locale,
    contentType: "blog",
    title: "",
    slug: "",
    translationKey: "",
    description: "",
    author: "corelia-team",
    category: "announcements-events",
    tags: [],
    publishedOn: todayIsoDate(),
    mediaKind: "none",
    imageSrc: "",
    imageAlt: "",
    imageFit: "cover",
    imageOgSrc: "",
    youtubeUrl: "",
    body: "",
  };
}

export function blogPostFormFromRecord(post: BlogPostRecord): BlogPostForm {
  const media = post.media;
  return {
    locale: post.locale,
    contentType: post.content_type,
    title: post.title,
    slug: post.slug,
    translationKey: post.translation_key,
    description: post.description ?? "",
    author: post.author ?? "",
    category: (BLOG_CATEGORY_KEYS as readonly string[]).includes(post.category)
      ? (post.category as BlogCategory)
      : "announcements-events",
    tags: post.tags.filter((tag) => (BLOG_TAG_KEYS as readonly string[]).includes(tag)),
    publishedOn: post.published_on,
    mediaKind: media?.type ?? "none",
    imageSrc: media?.type === "image" ? media.src : "",
    imageAlt: media?.type === "image" ? (media.alt ?? "") : "",
    imageFit: media?.type === "image" && media.fit === "contain" ? "contain" : "cover",
    imageOgSrc: media?.type === "image" ? (media.ogSrc ?? "") : "",
    youtubeUrl: media?.type === "youtube" ? media.url : "",
    body: post.body,
  };
}

/** A new article in the other language, sharing everything that is not language-specific. */
export function blogTranslationFormFromRecord(post: BlogPostRecord): BlogPostForm {
  return {
    ...blogPostFormFromRecord(post),
    locale: post.locale === "en" ? "vi" : "en",
    title: "",
    slug: "",
    description: "",
    imageAlt: "",
    body: "",
  };
}

export type BlogFormError =
  | "titleRequired"
  | "slugInvalid"
  | "translationKeyInvalid"
  | "dateInvalid"
  | "imageRequired"
  | "imageUrlInvalid"
  | "youtubeInvalid"
  | "tagsCount"
  | "bodyRequired";

function isHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isYouTubeUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    return ["youtube.com", "m.youtube.com", "youtu.be", "youtube-nocookie.com"].includes(host);
  } catch {
    return false;
  }
}

function mediaFromForm(form: BlogPostForm): BlogMedia | null {
  if (form.mediaKind === "image" && form.imageSrc.trim()) {
    return {
      type: "image",
      src: form.imageSrc.trim(),
      ...(form.imageAlt.trim() ? { alt: form.imageAlt.trim() } : {}),
      ...(form.imageFit === "contain" ? { fit: "contain" as const } : {}),
      ...(form.imageOgSrc ? { ogSrc: form.imageOgSrc } : {}),
    };
  }
  if (form.mediaKind === "youtube" && form.youtubeUrl.trim()) return { type: "youtube", url: form.youtubeUrl.trim() };
  return null;
}

/**
 * The row to save, or the first problem to show. A draft only needs what the table
 * requires (title, slug, translation key, date); publishing also needs a body and
 * 3–6 tags, as the landing lists expect.
 */
export function buildBlogPostInput(
  form: BlogPostForm,
  status: BlogStatus,
): { input: BlogPostInput } | { error: BlogFormError } {
  const title = form.title.trim();
  if (!title) return { error: "titleRequired" };
  const slug = form.slug.trim();
  if (!SLUG_PATTERN.test(slug)) return { error: "slugInvalid" };
  const translationKey = form.translationKey.trim() || slug;
  if (!SLUG_PATTERN.test(translationKey)) return { error: "translationKeyInvalid" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.publishedOn) || Number.isNaN(Date.parse(form.publishedOn))) {
    return { error: "dateInvalid" };
  }
  const imageSrc = form.imageSrc.trim();
  if (form.mediaKind === "image" && imageSrc && !imageSrc.startsWith("/") && !isHttpUrl(imageSrc)) {
    return { error: "imageUrlInvalid" };
  }
  if (form.mediaKind === "youtube" && form.youtubeUrl.trim() && !isYouTubeUrl(form.youtubeUrl.trim())) {
    return { error: "youtubeInvalid" };
  }
  if (status === "published") {
    if (form.mediaKind === "image" && !imageSrc) return { error: "imageRequired" };
    if (form.mediaKind === "youtube" && !form.youtubeUrl.trim()) return { error: "youtubeInvalid" };
    if (form.tags.length < BLOG_MIN_TAGS || form.tags.length > BLOG_MAX_TAGS) return { error: "tagsCount" };
    if (!form.body.trim()) return { error: "bodyRequired" };
  }
  return {
    input: {
      locale: form.locale,
      slug,
      translation_key: translationKey,
      content_type: form.contentType,
      status,
      title,
      description: form.description.trim() || null,
      author: form.author.trim() || null,
      category: form.category,
      tags: form.tags,
      media: mediaFromForm(form),
      body: form.body.replace(/\r\n/g, "\n"),
      published_on: form.publishedOn,
    },
  };
}

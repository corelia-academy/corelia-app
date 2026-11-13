import type { BlogCategory, BlogLocale, BlogMedia } from "@corelia/ui/blog";

export type BlogContentType = "blog" | "case-study";
export type BlogStatus = "draft" | "published";

/** A `public.blog_posts` row as Admin → Blog lists it (no body). */
export type BlogPostSummary = {
  id: string;
  locale: BlogLocale;
  slug: string;
  translation_key: string;
  content_type: BlogContentType;
  status: BlogStatus;
  title: string;
  category: string;
  author: string | null;
  /** `YYYY-MM-DD`: the date shown on the article. */
  published_on: string;
  updated_at: string;
};

export type BlogPostRecord = BlogPostSummary & {
  description: string | null;
  tags: string[];
  media: BlogMedia | null;
  body: string;
};

/** The editable fields, as Admin → Blog writes them. */
export type BlogPostInput = {
  locale: BlogLocale;
  slug: string;
  translation_key: string;
  content_type: BlogContentType;
  status: BlogStatus;
  title: string;
  description: string | null;
  author: string | null;
  category: BlogCategory;
  tags: string[];
  media: BlogMedia | null;
  body: string;
  published_on: string;
};

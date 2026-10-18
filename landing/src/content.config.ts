import { defineCollection, z } from "astro:content";
import { BLOG_CATEGORY_KEYS, BLOG_TAG_KEYS } from "./lib/blogTaxonomy";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    date: z.coerce.date(),
    locale: z.enum(["vi", "en"]),
    translationKey: z.string().min(1),
    author: z.string().min(1).optional(),
    draft: z.boolean().optional().default(false),
    contentType: z.enum(["blog", "case-study"]).optional().default("blog"),
    category: z.enum(BLOG_CATEGORY_KEYS),
    tags: z.array(z.enum(BLOG_TAG_KEYS)).min(3).max(6),
    media: z
      .discriminatedUnion("type", [
        z.object({
          type: z.literal("image"),
          src: z.string().min(1),
          alt: z.string().optional(),
          fit: z.enum(["cover", "contain"]).optional(),
        }),
        z.object({
          type: z.literal("youtube"),
          url: z.string().url(),
        }),
      ])
      .optional(),
  }),
});

const members = defineCollection({
  type: "content",
  schema: z.object({
    name: z.string().min(1),
    role: z.string().optional(),
    avatar: z.string().optional(),
    links: z
      .object({
        website: z.string().url().optional(),
        github: z.string().url().optional(),
        x: z.string().url().optional(),
        linkedin: z.string().url().optional(),
      })
      .optional(),
  }),
});

export const collections = { blog, members };

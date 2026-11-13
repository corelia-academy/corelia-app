import { defineCollection, z } from "astro:content";

// Blog and case-study articles live in Supabase (`public.blog_posts`); see src/lib/blog.ts.
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

export const collections = { members };

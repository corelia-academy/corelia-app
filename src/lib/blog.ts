// Admin → Blog: articles of the landing site (corelia.academy/blog, /case-studies).
// Rows live in `public.blog_posts`; RLS lets admin/support staff read and write every
// row and everyone else read published ones. The landing reads them in landing/src/lib/blog.ts.
import { supabase } from "@/lib/supabase";
import type { BlogPostInput, BlogPostRecord, BlogPostSummary } from "@/types/blog";

const SUMMARY_COLUMNS =
  "id,locale,slug,translation_key,content_type,status,title,category,author,published_on,updated_at";
const RECORD_COLUMNS = `${SUMMARY_COLUMNS},description,tags,media,body`;

/** `slug_taken`: another article in this language has the slug. `translation_taken`: the translation key already has this language. */
export class BlogSaveConflictError extends Error {
  readonly conflict: "slug_taken" | "translation_taken";

  constructor(conflict: "slug_taken" | "translation_taken") {
    super(`blog_${conflict}`);
    this.conflict = conflict;
  }
}

export async function listBlogPostsAdmin(): Promise<BlogPostSummary[]> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select(SUMMARY_COLUMNS)
    .order("published_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as BlogPostSummary[];
}

export async function getBlogPostAdmin(id: string): Promise<BlogPostRecord | null> {
  const { data, error } = await supabase.from("blog_posts").select(RECORD_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BlogPostRecord | null) ?? null;
}

/** Creates the article (`id` null) or updates it, and returns the saved row. */
export async function saveBlogPost(
  id: string | null,
  input: BlogPostInput,
  userId: string | undefined,
): Promise<BlogPostRecord> {
  const row = { ...input, updated_by: userId ?? null };
  const query = id
    ? supabase.from("blog_posts").update(row).eq("id", id)
    : supabase.from("blog_posts").insert(row);
  const { data, error } = await query.select(RECORD_COLUMNS).maybeSingle();
  if (error) {
    if (error.code === "23505") {
      throw new BlogSaveConflictError(
        error.message.includes("blog_posts_locale_translation_key") ? "translation_taken" : "slug_taken",
      );
    }
    throw new Error(error.message);
  }
  // No row back from an update: it was deleted meanwhile, or RLS no longer lets this user write.
  if (!data) throw new Error("blog_post_not_saved");
  return data as BlogPostRecord;
}

export async function deleteBlogPost(id: string): Promise<void> {
  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

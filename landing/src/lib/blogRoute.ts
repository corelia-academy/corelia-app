import { blogConfigured } from "@/lib/blog";
import { catalogNotFound, catalogUnavailable } from "@/lib/catalogRoute";

type RouteContext = { request: Request; locals: unknown; response: { headers: Headers } };

/**
 * Loads the data of a server-rendered blog route. Returns the data, or the response to
 * send instead: the 404 page when `load` finds nothing, a 503 when Supabase cannot be
 * read (so crawlers retry instead of indexing an empty page).
 */
export async function loadBlogPage<T extends object>(
  context: RouteContext,
  load: () => Promise<T | null>,
): Promise<T | Response> {
  if (!blogConfigured()) return catalogUnavailable("Blog temporarily unavailable");
  let data: T | null;
  try {
    data = await load();
  } catch (error) {
    console.error("[blog]", error instanceof Error ? error.message : error);
    return catalogUnavailable("Blog temporarily unavailable");
  }
  if (!data) return catalogNotFound(context.request, context.locals);
  // Short browser cache: a published or edited article should show up within minutes.
  context.response.headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=600");
  return data;
}

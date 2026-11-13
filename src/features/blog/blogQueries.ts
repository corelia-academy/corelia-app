import { queryOptions } from "@tanstack/react-query";

import { getBlogPostAdmin, listBlogPostsAdmin } from "@/lib/blog";

export const blogKeys = {
  all: ["blog"] as const,
  adminList: () => [...blogKeys.all, "admin", "list"] as const,
  adminPost: (id: string) => [...blogKeys.all, "admin", "post", id] as const,
};

export function adminBlogPostsQueryOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: blogKeys.adminList(),
    queryFn: listBlogPostsAdmin,
    enabled: Boolean(userId),
    staleTime: 15_000,
    meta: { scope: "private", userId: userId ?? "missing", showInGlobalLoading: false },
  });
}

export function adminBlogPostQueryOptions(userId: string | undefined, id: string | undefined) {
  return queryOptions({
    queryKey: blogKeys.adminPost(id ?? "missing"),
    queryFn: () => getBlogPostAdmin(id!),
    enabled: Boolean(userId && id),
    // The editor copies the row into form state once; a background refetch must not race the typing.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    meta: { scope: "private", userId: userId ?? "missing", showInGlobalLoading: false },
  });
}

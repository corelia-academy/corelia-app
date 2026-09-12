import type { QueryClient } from "@tanstack/react-query";

/** Refresh private progress consumers after a successful lesson mutation. */
export async function invalidateLearningProgress(client: QueryClient, userId: string, courseId: string) {
  await Promise.all([
    ["courses", "enrollment", userId, courseId],
    ["courses", "catalog-progress", userId],
    ["courses", "spotlight", userId],
    ["career", "progress", userId],
    ["achievements", "vault", userId],
  ].map(queryKey => client.invalidateQueries({ queryKey })));
}

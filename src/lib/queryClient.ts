import { QueryClient, type Query } from "@tanstack/react-query";

type PrivateQueryMeta = {
  scope?: "private" | "public";
  userId?: string;
  showInGlobalLoading?: boolean;
};

function statusFromError(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { status?: unknown; statusCode?: unknown };
  const value = candidate.status ?? candidate.statusCode;
  return typeof value === "number" ? value : null;
}
function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = statusFromError(error);
  if (status != null && status >= 400 && status < 500) return false;
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});

function isPrivateQueryForUser(query: Query, userId?: string): boolean {
  const meta = query.meta as PrivateQueryMeta | undefined;
  if (meta?.scope !== "private") return false;
  return userId == null || meta.userId === userId;
}

/** Cancel and remove authenticated data so it cannot cross account boundaries. */
export async function clearPrivateQueryCache(userId?: string): Promise<void> {
  const predicate = (query: Query) => isPrivateQueryForUser(query, userId);
  await queryClient.cancelQueries({ predicate });
  queryClient.removeQueries({ predicate });
}

import { queryOptions } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";

import { hackathonKeys } from "@/features/hackathons/hackathonQueries";
import {
  fetchContestDetailPayload,
  type ContestDetailFetchedPayload,
} from "@/pages/hackathon-detail/hooks/fetchContestDetailPayload";
import type { Contest } from "@/types/hackathons";
import type { Profile } from "@/types/database";

export const contestDetailKeys = {
  payload: (
    slug: string,
    viewerId: string,
    locale: string,
    accessScope: string,
  ) =>
    [...hackathonKeys.all, "detail-payload", slug, viewerId, locale, accessScope] as const,
};

export function contestDetailPayloadQueryOptions(input: {
  slug: string | undefined;
  viewer: User | null;
  profile: Profile | null;
  profileReady: boolean;
  locale: string;
  isManager: boolean;
  translate: (key: string, options?: Record<string, unknown>) => string;
  prefetchedContest?: Contest | null;
}) {
  const slug = input.slug?.trim() ?? "";
  const viewerId = input.viewer?.id ?? "anonymous";
  const accessScope = [
    input.profile?.role ?? "guest",
    input.isManager ? "manager" : "participant",
    input.viewer?.email?.trim().toLowerCase() ?? "no-email",
  ].join(":");

  return queryOptions({
    queryKey: contestDetailKeys.payload(
      slug || "missing",
      viewerId,
      input.locale,
      accessScope,
    ),
    queryFn: async ({ signal }): Promise<ContestDetailFetchedPayload> => {
      const result = await fetchContestDetailPayload({
        slug,
        profile: input.profile,
        userEmail: input.viewer?.email,
        uiLocale: input.locale,
        viewer: input.viewer,
        isManager: input.isManager,
        translate: input.translate,
        signal,
        prefetchedContest: input.prefetchedContest,
      });
      if (result.status === "ok") return result.payload;
      if (result.status === "aborted") throw new DOMException("Aborted", "AbortError");
      throw new Error(result.errorMessage);
    },
    enabled: Boolean(slug && input.profileReady),
    staleTime: 30_000,
    meta: input.viewer
      ? {
          scope: "private",
          userId: input.viewer.id,
          showInGlobalLoading: false,
        }
      : { scope: "public", showInGlobalLoading: false },
  });
}

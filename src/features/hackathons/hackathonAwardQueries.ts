import { queryOptions } from "@tanstack/react-query";

import { hackathonKeys } from "@/features/hackathons/hackathonQueries";
import {
  countIssuancesByTemplateIds,
  listHackathonCredentialTemplates,
} from "@/lib/credentialTemplates";
import { invokeHackathonListEligible } from "@/lib/credentialsEdge";

export const hackathonAwardKeys = {
  templates: (contestId: string, userId: string) =>
    [...hackathonKeys.all, "awards", "templates", contestId, userId] as const,
  eligible: (contestId: string, templateId: string, userId: string) =>
    [...hackathonKeys.all, "awards", "eligible", contestId, templateId, userId] as const,
};

export function hackathonAwardTemplatesQueryOptions(contestId: string, userId: string) {
  return queryOptions({
    queryKey: hackathonAwardKeys.templates(contestId, userId),
    queryFn: async () => {
      const templates = await listHackathonCredentialTemplates(contestId);
      const counts = await countIssuancesByTemplateIds(
        templates.map((template) => template.id),
      );
      return { templates, counts };
    },
    staleTime: 30_000,
    meta: { scope: "private", userId, showInGlobalLoading: false },
  });
}

export function hackathonEligibleUsersQueryOptions(
  contestId: string,
  templateId: string,
  userId: string,
) {
  return queryOptions({
    queryKey: hackathonAwardKeys.eligible(
      contestId,
      templateId || "missing",
      userId,
    ),
    queryFn: async () => {
      const result = await invokeHackathonListEligible({
        hackathonId: contestId,
        templateId,
      });
      if (!result.ok) throw new Error(result.message ?? "Unknown error");
      return result.users ?? [];
    },
    enabled: false,
    staleTime: 15_000,
    meta: { scope: "private", userId, showInGlobalLoading: false },
  });
}

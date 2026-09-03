import { queryOptions } from "@tanstack/react-query";

import {
  countIssuancesForTemplate,
  getLatestCourseCredentialTemplate,
} from "@/lib/credentialTemplates";

export const courseCredentialKeys = {
  all: ["course-credentials"] as const,
  editor: (courseId: string, userId: string) =>
    [...courseCredentialKeys.all, "editor", courseId, userId] as const,
};

export function courseCredentialEditorQueryOptions(input: {
  courseId: string;
  userId: string | undefined;
}) {
  return queryOptions({
    queryKey: courseCredentialKeys.editor(
      input.courseId,
      input.userId ?? "missing",
    ),
    queryFn: async () => {
      const template = await getLatestCourseCredentialTemplate(input.courseId);
      const issuanceCount = template
        ? await countIssuancesForTemplate(template.id).catch(() => 0)
        : 0;
      return { template, issuanceCount };
    },
    enabled: Boolean(input.courseId && input.userId),
    staleTime: 30_000,
    meta: {
      scope: "private",
      userId: input.userId ?? "missing",
      showInGlobalLoading: false,
    },
  });
}

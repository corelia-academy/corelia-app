import { queryOptions } from "@tanstack/react-query";

import { peekCoInstructorInviteByToken } from "@/lib/coInstructorInvites";
import { fetchProjectInviteDisplayContextByProjectIds } from "@/lib/notificationInviteContext";
import { peekProjectInviteByToken } from "@/lib/notifications";

export const inviteKeys = {
  all: ["invites"] as const,
  coInstructor: (userId: string, token: string) =>
    [...inviteKeys.all, "co-instructor", userId, token] as const,
  project: (userId: string, token: string) =>
    [...inviteKeys.all, "project", userId, token] as const,
  projectContext: (projectId: string) =>
    [...inviteKeys.all, "project-context", projectId] as const,
};

function privateMeta(userId: string | undefined) {
  return {
    scope: "private",
    userId: userId ?? "missing",
    showInGlobalLoading: false,
  } as const;
}

export function coInstructorInvitePreviewQueryOptions(input: {
  token: string;
  userId: string | undefined;
  enabled: boolean;
}) {
  const token = input.token.trim();
  return queryOptions({
    queryKey: inviteKeys.coInstructor(input.userId ?? "missing", token || "missing"),
    queryFn: () => peekCoInstructorInviteByToken(token),
    enabled: input.enabled && Boolean(token && input.userId),
    staleTime: 30_000,
    retry: false,
    meta: privateMeta(input.userId),
  });
}

export function projectInvitePreviewQueryOptions(input: {
  token: string;
  userId: string | undefined;
  enabled: boolean;
}) {
  const token = input.token.trim();
  return queryOptions({
    queryKey: inviteKeys.project(input.userId ?? "missing", token || "missing"),
    queryFn: ({ signal }) => peekProjectInviteByToken(token, { signal }),
    enabled: input.enabled && Boolean(token && input.userId),
    staleTime: 30_000,
    retry: false,
    meta: privateMeta(input.userId),
  });
}

export function projectInviteContextQueryOptions(projectId: string) {
  return queryOptions({
    queryKey: inviteKeys.projectContext(projectId),
    queryFn: async () => {
      const context = await fetchProjectInviteDisplayContextByProjectIds([projectId]);
      return context[projectId] ?? null;
    },
    enabled: projectId.length > 0,
    staleTime: 60_000,
    meta: { scope: "public", showInGlobalLoading: false },
  });
}

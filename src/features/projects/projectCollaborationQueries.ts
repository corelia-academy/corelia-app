import { queryOptions } from "@tanstack/react-query";

import {
  fetchHackathonProjectForOwnerSubmission,
  listCollaborationProfiles,
  listInvitableHackathonUsers,
  listProjectCollaborationInvites,
  listProjectCollaborators,
} from "@/lib/projectCollaboration";

export const projectCollaborationKeys = {
  all: ["project-collaboration"] as const,
  workspace: (userId: string, contestId: string) =>
    [...projectCollaborationKeys.all, "workspace", userId, contestId] as const,
  invitable: (userId: string, projectId: string, search: string) =>
    [
      ...projectCollaborationKeys.all,
      "invitable",
      userId,
      projectId,
      search,
    ] as const,
  profiles: (userIds: string[]) =>
    [...projectCollaborationKeys.all, "profiles", ...userIds] as const,
};

export function collaborationProfilesQueryOptions(userIds: string[]) {
  const normalizedIds = Array.from(new Set(userIds.filter(Boolean))).sort();
  return queryOptions({
    queryKey: projectCollaborationKeys.profiles(normalizedIds),
    queryFn: ({ signal }) => listCollaborationProfiles(normalizedIds, signal),
    enabled: normalizedIds.length > 0,
    staleTime: 5 * 60_000,
    meta: { scope: "public", showInGlobalLoading: false },
  });
}

export function projectCollaborationWorkspaceQueryOptions(input: {
  userId: string | undefined;
  contestId: string | undefined;
  enabled: boolean;
}) {
  const userId = input.userId ?? "";
  const contestId = input.contestId ?? "";
  return queryOptions({
    queryKey: projectCollaborationKeys.workspace(
      userId || "missing",
      contestId || "missing",
    ),
    queryFn: async () => {
      const project = await fetchHackathonProjectForOwnerSubmission(contestId, userId);
      if (!project) return { project: null, members: [], invites: [] };
      const [members, invites] = await Promise.all([
        listProjectCollaborators(project.id),
        listProjectCollaborationInvites(project.id),
      ]);
      return { project, members, invites };
    },
    enabled: Boolean(input.enabled && userId && contestId),
    staleTime: 30_000,
    meta: {
      scope: "private",
      userId: userId || "missing",
      showInGlobalLoading: false,
    },
  });
}

export function invitableHackathonUsersQueryOptions(input: {
  userId: string | undefined;
  projectId: string | undefined;
  search: string;
}) {
  const userId = input.userId ?? "";
  const projectId = input.projectId ?? "";
  const search = input.search.trim();
  return queryOptions({
    queryKey: projectCollaborationKeys.invitable(
      userId || "missing",
      projectId || "missing",
      search,
    ),
    queryFn: () => listInvitableHackathonUsers(projectId, search),
    enabled: Boolean(userId && projectId),
    staleTime: 30_000,
    meta: {
      scope: "private",
      userId: userId || "missing",
      showInGlobalLoading: false,
    },
  });
}

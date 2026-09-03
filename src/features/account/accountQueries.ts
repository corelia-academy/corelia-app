import { queryOptions } from "@tanstack/react-query";

import {
  countMintedCredentials,
  getNotificationPreferences,
} from "@/lib/notificationPreferences";
import { getProjectLocaleContent, listMyProjectsForAccount } from "@/lib/projects";
import type { Locale } from "@/types/database";

export const accountKeys = {
  all: ["account"] as const,
  projects: (userId: string) => [...accountKeys.all, "projects", userId] as const,
  projectLocale: (userId: string, projectId: string, locale: Locale) =>
    [...accountKeys.all, "project-locale", userId, projectId, locale] as const,
  notificationPreferences: (userId: string) =>
    [...accountKeys.all, "notification-preferences", userId] as const,
  mintedCredentialCount: (userId: string) =>
    [...accountKeys.all, "minted-credential-count", userId] as const,
};

function privateMeta(userId: string) {
  return { scope: "private", userId, showInGlobalLoading: false } as const;
}

export function accountProjectsQueryOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: accountKeys.projects(userId || "missing"),
    queryFn: () => listMyProjectsForAccount(),
    enabled: Boolean(userId),
    staleTime: 30_000,
    meta: privateMeta(userId || "missing"),
  });
}

export function accountProjectLocaleQueryOptions(
  userId: string | undefined,
  projectId: string | undefined,
  locale: Locale,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: accountKeys.projectLocale(
      userId || "missing",
      projectId || "missing",
      locale,
    ),
    queryFn: () => getProjectLocaleContent(projectId!, locale),
    enabled: Boolean(userId && projectId && enabled),
    staleTime: 30_000,
    meta: privateMeta(userId || "missing"),
  });
}

export function notificationPreferencesQueryOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: accountKeys.notificationPreferences(userId || "missing"),
    queryFn: () => getNotificationPreferences(userId!),
    enabled: Boolean(userId),
    staleTime: 60_000,
    meta: privateMeta(userId || "missing"),
  });
}

export function mintedCredentialCountQueryOptions(
  userId: string | undefined,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: accountKeys.mintedCredentialCount(userId || "missing"),
    queryFn: () => countMintedCredentials(userId!),
    enabled: Boolean(userId && enabled),
    staleTime: 60_000,
    meta: privateMeta(userId || "missing"),
  });
}

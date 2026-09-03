import { queryOptions } from "@tanstack/react-query";

import {
  getJobBySlug,
  getJobMarketSnapshot,
  getJobTaxonomy,
  getUserJobState,
  listAdminJobs,
  listCrawlerRuns,
  listConnectedJobSources,
  listJobOperationalAlerts,
  listJobCompaniesAdmin,
  listJobs,
  listJobSourcesAdmin,
  listUserJobs,
} from "@/lib/jobs";
import type { JobFilters } from "@/types/jobs";

const publicMeta = { scope: "public", showInGlobalLoading: false } as const;

export const jobKeys = {
  all: ["jobs"] as const,
  catalog: (filters: JobFilters, userId: string) => [...jobKeys.all, "catalog", filters, userId] as const,
  detail: (slug: string) => [...jobKeys.all, "detail", slug] as const,
  taxonomy: () => [...jobKeys.all, "taxonomy"] as const,
  sources: () => [...jobKeys.all, "sources"] as const,
  state: (userId: string, jobId: string) => [...jobKeys.all, "state", userId, jobId] as const,
  userList: (userId: string, mode: string) => [...jobKeys.all, "user-list", userId, mode] as const,
  market: (days: number) => [...jobKeys.all, "market", days] as const,
  admin: ["jobs-admin"] as const,
  adminJobs: (status: string) => [...jobKeys.admin, "jobs", status] as const,
  adminSources: () => [...jobKeys.admin, "sources"] as const,
  adminCompanies: () => [...jobKeys.admin, "companies"] as const,
  adminRuns: () => [...jobKeys.admin, "runs"] as const,
  adminAlerts: () => [...jobKeys.admin, "alerts"] as const,
};

export function jobsCatalogQueryOptions(filters: JobFilters, userId?: string) {
  return queryOptions({
    queryKey: jobKeys.catalog(filters, userId ?? "public"),
    queryFn: () => listJobs(filters, userId),
    staleTime: 60_000,
    meta: userId
      ? { scope: "private", userId, showInGlobalLoading: false }
      : publicMeta,
  });
}

export function jobDetailQueryOptions(slug?: string) {
  const normalized = slug?.trim() ?? "";
  return queryOptions({
    queryKey: jobKeys.detail(normalized || "missing"),
    queryFn: () => getJobBySlug(normalized),
    enabled: Boolean(normalized),
    staleTime: 60_000,
    meta: publicMeta,
  });
}

export function jobTaxonomyQueryOptions() {
  return queryOptions({
    queryKey: jobKeys.taxonomy(),
    queryFn: getJobTaxonomy,
    staleTime: 24 * 60 * 60_000,
    meta: publicMeta,
  });
}

export function jobSourceConnectionsQueryOptions() {
  return queryOptions({
    queryKey: jobKeys.sources(),
    queryFn: listConnectedJobSources,
    staleTime: 15 * 60_000,
    meta: publicMeta,
  });
}

export function userJobStateQueryOptions(userId: string | undefined, jobId: string | undefined) {
  return queryOptions({
    queryKey: jobKeys.state(userId ?? "missing", jobId ?? "missing"),
    queryFn: () => getUserJobState(userId!, jobId!),
    enabled: Boolean(userId && jobId),
    staleTime: 30_000,
    meta: { scope: "private", userId: userId ?? "missing", showInGlobalLoading: false },
  });
}

export function userJobsQueryOptions(userId: string | undefined, mode: "saved" | "applied" | "hidden") {
  return queryOptions({
    queryKey: jobKeys.userList(userId ?? "missing", mode),
    queryFn: () => listUserJobs(userId!, mode),
    enabled: Boolean(userId),
    staleTime: 30_000,
    meta: { scope: "private", userId: userId ?? "missing", showInGlobalLoading: false },
  });
}

export function jobMarketQueryOptions(days = 90) {
  return queryOptions({
    queryKey: jobKeys.market(days),
    queryFn: () => getJobMarketSnapshot(days),
    staleTime: 15 * 60_000,
    meta: publicMeta,
  });
}

export function adminJobsQueryOptions(userId: string | undefined, status = "") {
  return queryOptions({
    queryKey: jobKeys.adminJobs(status),
    queryFn: () => listAdminJobs(status || undefined),
    enabled: Boolean(userId),
    staleTime: 15_000,
    meta: { scope: "private", userId: userId ?? "missing", showInGlobalLoading: false },
  });
}

export function adminJobSourcesQueryOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: jobKeys.adminSources(),
    queryFn: listJobSourcesAdmin,
    enabled: Boolean(userId),
    staleTime: 15_000,
    meta: { scope: "private", userId: userId ?? "missing", showInGlobalLoading: false },
  });
}

export function adminJobCompaniesQueryOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: jobKeys.adminCompanies(),
    queryFn: listJobCompaniesAdmin,
    enabled: Boolean(userId),
    staleTime: 15_000,
    meta: { scope: "private", userId: userId ?? "missing", showInGlobalLoading: false },
  });
}

export function adminCrawlerRunsQueryOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: jobKeys.adminRuns(),
    queryFn: listCrawlerRuns,
    enabled: Boolean(userId),
    staleTime: 10_000,
    meta: { scope: "private", userId: userId ?? "missing", showInGlobalLoading: false },
  });
}

export function adminJobOperationalAlertsQueryOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: jobKeys.adminAlerts(),
    queryFn: () => listJobOperationalAlerts(false),
    enabled: Boolean(userId),
    staleTime: 10_000,
    meta: { scope: "private", userId: userId ?? "missing", showInGlobalLoading: false },
  });
}

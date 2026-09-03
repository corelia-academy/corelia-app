import type { JobFilters, JobsPageResult } from "@/types/jobs";

export function getNextJobsPageParam(lastPage: JobsPageResult) {
  return lastPage.page * lastPage.pageSize < lastPage.total
    ? lastPage.page + 1
    : undefined;
}

export function getInfiniteJobsFilters(filters: JobFilters): JobFilters {
  const catalogFilters = { ...filters };
  delete catalogFilters.page;
  return catalogFilters;
}

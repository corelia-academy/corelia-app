import { describe, expect, it } from "vitest";

import { getInfiniteJobsFilters, getNextJobsPageParam } from "./jobPagination";
import type { JobsPageResult } from "@/types/jobs";

function page(overrides: Partial<JobsPageResult> = {}): JobsPageResult {
  return {
    items: [],
    total: 50,
    page: 1,
    pageSize: 24,
    stateByJobId: {},
    hiddenCount: 0,
    ...overrides,
  };
}

describe("jobs infinite catalog query", () => {
  it("loads the next batch while more jobs remain", () => {
    expect(getNextJobsPageParam(page())).toBe(2);
    expect(getNextJobsPageParam(page({ page: 2 }))).toBe(3);
  });

  it("stops after the final batch", () => {
    expect(getNextJobsPageParam(page({ page: 3 }))).toBeUndefined();
    expect(getNextJobsPageParam(page({ total: 48, page: 2 }))).toBeUndefined();
  });

  it("always starts at the first batch instead of a URL page", () => {
    const filters = getInfiniteJobsFilters({ page: 8, pageSize: 24 });

    expect(filters).toEqual({ pageSize: 24 });
  });
});

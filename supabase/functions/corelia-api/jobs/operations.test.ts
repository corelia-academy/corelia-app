import { describe, expect, it } from "vitest";

import { alertTypesForRun } from "./operations.ts";

const base = {
  sourceId: "source",
  companyId: "company",
  fetchedCount: 12,
  failedCount: 0,
  classificationFailedCount: 0,
  expiredCount: 0,
  activeJobsBeforeRun: 10,
  errorMessage: null,
  recentStatuses: ["succeeded", "succeeded", "succeeded"],
};

describe("jobs operational alerts", () => {
  it("raises only after three consecutive failed runs", () => {
    expect(alertTypesForRun({ ...base, recentStatuses: ["failed", "failed", "failed"] }))
      .toContain("consecutive_failures");
    expect(alertTypesForRun({ ...base, recentStatuses: ["failed", "succeeded", "failed"] }))
      .not.toContain("consecutive_failures");
  });

  it("detects an unexpected empty feed only when active jobs existed", () => {
    expect(alertTypesForRun({ ...base, fetchedCount: 0 })).toContain("unexpected_zero_jobs");
    expect(alertTypesForRun({ ...base, fetchedCount: 0, activeJobsBeforeRun: 0 }))
      .not.toContain("unexpected_zero_jobs");
  });

  it("classifies schema, rate-limit, and AI failure spikes", () => {
    expect(alertTypesForRun({ ...base, errorMessage: "unexpected response schema" }))
      .toContain("api_schema_change");
    expect(alertTypesForRun({ ...base, errorMessage: "HTTP 429 rate_limit" }))
      .toContain("rate_limited");
    expect(alertTypesForRun({
      ...base,
      fetchedCount: 12,
      classificationFailedCount: 4,
    })).toContain("classification_failure_spike");
  });

  it("alerts when a complete source removes a material share of active listings", () => {
    expect(alertTypesForRun({ ...base, activeJobsBeforeRun: 12, expiredCount: 4 }))
      .toContain("dead_link_spike");
    expect(alertTypesForRun({ ...base, activeJobsBeforeRun: 12, expiredCount: 2 }))
      .not.toContain("dead_link_spike");
  });
});

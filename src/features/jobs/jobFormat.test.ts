import { describe, expect, it } from "vitest";

import { formatJobSalary } from "./jobFormat";
import type { Job } from "@/types/jobs";

function salaryJob(overrides: Partial<Job>): Job {
  return {
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    salary_period: null,
    ...overrides,
  } as Job;
}

describe("job salary formatting", () => {
  it("does not invent a currency or pay period", () => {
    expect(formatJobSalary(salaryJob({ salary_min: 100_000 }), "en")).toBeNull();
    expect(formatJobSalary(salaryJob({ salary_min: 100_000, salary_currency: "USD" }), "en"))
      .not.toContain("/year");
  });

  it("fails safely for an invalid source currency", () => {
    expect(formatJobSalary(salaryJob({ salary_min: 100, salary_currency: "INVALID" }), "en")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { classifyJob, classifyJobDeterministically } from "./classify.ts";
import type { NormalizedSourceJob } from "./types.ts";

function job(overrides: Partial<NormalizedSourceJob> = {}): NormalizedSourceJob {
  return {
    sourceJobId: "1",
    title: "Senior Backend Engineer",
    companyName: "Example",
    descriptionHtml: "",
    descriptionPlain: "Build APIs with TypeScript, PostgreSQL and Docker. 5+ years of experience required. Nice to have: Kubernetes and AWS.",
    locationText: "Remote APAC",
    employmentType: "full_time",
    sourceUrl: "https://example.com/jobs/1",
    applyUrl: "https://example.com/jobs/1/apply",
    postedAt: "2026-09-01T00:00:00.000Z",
    sourceUpdatedAt: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    sourceTags: ["Engineering"],
    raw: {},
    ...overrides,
  };
}

describe("deterministic job classifier", () => {
  it("classifies role, seniority, skills, experience and region", () => {
    const result = classifyJobDeterministically(job());
    expect(result.isRelevant).toBe(true);
    expect(result.primaryRole).toBe("backend-engineering");
    expect(result.seniority).toBe("senior");
    expect(result.experienceMinYears).toBe(5);
    expect(result.requiredSkills).toEqual(expect.arrayContaining(["typescript", "postgresql", "docker"]));
    expect(result.preferredSkills).toEqual(expect.arrayContaining(["kubernetes", "aws"]));
    expect(result.remoteType).toBe("remote");
    expect(result.regions).toContain("APAC");
  });

  it("normalizes an AI experience range that would violate the database constraint", async () => {
    const output = {
      is_relevant: true,
      primary_role: "backend-engineering",
      roles: ["backend-engineering"],
      domains: ["developer-tools"],
      required_skills: ["typescript"],
      preferred_skills: [],
      seniority: "senior",
      experience_min_years: 8,
      experience_max_years: 3,
      remote_type: "remote",
      country_codes: ["VN"],
      regions: ["APAC"],
      remote_eligibility: "Vietnam",
      summary: "Backend role grounded in the supplied posting.",
      quality_score: 80,
      confidence: 0.9,
      evidence: { role: "Backend Engineer", skills: ["TypeScript"], seniority: "Senior", experience: "8 years", location: "Vietnam" },
    };
    const result = await classifyJob(job(), {
      apiKey: "test-key",
      fetcher: async () => new Response(JSON.stringify({ output_text: JSON.stringify(output) }), { status: 200 }),
    });
    expect(result.experienceMinYears).toBe(8);
    expect(result.experienceMaxYears).toBeNull();
  });

  it("normalizes an AI quality ratio to the canonical 0..100 scale", async () => {
    const output = {
      is_relevant: true,
      primary_role: "backend-engineering",
      roles: ["backend-engineering"],
      domains: ["web3"],
      required_skills: ["typescript"],
      preferred_skills: [],
      seniority: "senior",
      experience_min_years: 5,
      experience_max_years: null,
      remote_type: "remote",
      country_codes: [],
      regions: [],
      remote_eligibility: "Worldwide",
      summary: "Senior backend role grounded in the supplied posting.",
      quality_score: 0.95,
      confidence: 0.98,
      evidence: { role: "Backend Engineer", skills: ["TypeScript"], seniority: "Senior", experience: "5 years", location: "Remote" },
    };
    const result = await classifyJob(job(), {
      apiKey: "test-key",
      fetcher: async () => new Response(JSON.stringify({ output_text: JSON.stringify(output) }), { status: 200 }),
    });
    expect(result.qualityScore).toBe(95);
    expect(result.classifierVersion).toBe("jobs-ai-2");
  });

  it("falls back safely when the provider output does not match the required schema", async () => {
    const result = await classifyJob(job(), {
      apiKey: "test-key",
      fetcher: async () => new Response(JSON.stringify({ output_text: JSON.stringify({ is_relevant: true }) }), { status: 200 }),
    });
    expect(result.classifierVersion).toBe("jobs-deterministic-1");
    expect(result.confidence).toBeLessThan(0.8);
  });

  it("uses token-aware matching for Go", () => {
    const falsePositive = classifyJobDeterministically(job({
      title: "Software Engineer",
      descriptionPlain: "Work at Google on ongoing Java services.",
    }));
    expect(falsePositive.requiredSkills).not.toContain("go");
    const actual = classifyJobDeterministically(job({
      descriptionPlain: "Build distributed services in Go and PostgreSQL.",
    }));
    expect(actual.requiredSkills).toContain("go");
  });

  it("rejects clearly unrelated roles before AI", () => {
    const result = classifyJobDeterministically(job({
      title: "Store Manager",
      descriptionPlain: "Manage retail staff and weekly inventory.",
    }));
    expect(result.isRelevant).toBe(false);
  });
});

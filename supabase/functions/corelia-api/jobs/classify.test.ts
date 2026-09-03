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
    expect(result.jobType).toBe("tech");
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
      job_type: "tech",
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
      evidence: { role: "Backend Engineer", job_type: "Build APIs", skills: ["TypeScript"], seniority: "Senior", experience: "8 years", location: "Vietnam" },
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
      job_type: "tech",
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
      evidence: { role: "Backend Engineer", job_type: "Build backend systems", skills: ["TypeScript"], seniority: "Senior", experience: "5 years", location: "Remote" },
    };
    const result = await classifyJob(job(), {
      apiKey: "test-key",
      fetcher: async () => new Response(JSON.stringify({ output_text: JSON.stringify(output) }), { status: 200 }),
    });
    expect(result.qualityScore).toBe(95);
    expect(result.classifierVersion).toBe("jobs-ai-3");
  });

  it("falls back safely when the provider output does not match the required schema", async () => {
    const result = await classifyJob(job(), {
      apiKey: "test-key",
      fetcher: async () => new Response(JSON.stringify({ output_text: JSON.stringify({ is_relevant: true }) }), { status: 200 }),
    });
    expect(result.classifierVersion).toBe("jobs-deterministic-2");
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

  it("classifies a social-first technical-content job as non-tech without invented coding skills", () => {
    const result = classifyJobDeterministically(job({
      title: "Social & Technical Content Manager",
      sourceTags: ["Marketing"],
      descriptionPlain: "About the Role\nOwn editorial planning for our social channels and turn engineering interviews into social posts.\nWhat we're looking for\n3+ years creating social or technical content. You do not need to be an engineer.",
    }));
    expect(result.isRelevant).toBe(true);
    expect(result.jobType).toBe("non_tech");
    expect(result.primaryRole).toBe("social-media");
    expect(result.roles).not.toContain("general-software-engineering");
    expect(result.requiredSkills).toEqual([]);
    expect(result.preferredSkills).toEqual([]);
  });

  it("drops AI skills that are not backed by the returned source evidence", async () => {
    const output = {
      is_relevant: true,
      job_type: "tech",
      primary_role: "technical-writing",
      roles: ["technical-writing"],
      domains: ["web3"],
      required_skills: ["javascript", "typescript"],
      preferred_skills: ["python", "react"],
      seniority: "mid",
      experience_min_years: 3,
      experience_max_years: null,
      remote_type: "onsite",
      country_codes: ["US"],
      regions: ["AMER"],
      remote_eligibility: null,
      summary: "Social-first content role.",
      quality_score: 84,
      confidence: 0.78,
      evidence: {
        role: "Social & Technical Content Manager",
        job_type: "social-first role",
        skills: ["technical curiosity", "developer tools"],
        seniority: "3+ years creating social content",
        experience: "3+ years",
        location: "San Francisco",
      },
    };
    const result = await classifyJob(job({ title: "Social & Technical Content Manager" }), {
      apiKey: "test-key",
      fetcher: async () => new Response(JSON.stringify({ output_text: JSON.stringify(output) }), { status: 200 }),
    });
    expect(result.jobType).toBe("non_tech");
    expect(result.primaryRole).toBe("social-media");
    expect(result.roles).toEqual(expect.arrayContaining(["social-media"]));
    expect(result.roles).not.toContain("technical-writing");
    expect(result.requiredSkills).toEqual([]);
    expect(result.preferredSkills).toEqual([]);
  });
});

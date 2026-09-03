import { describe, expect, it, vi } from "vitest";

import { fetchCompanyJobs } from "./adapters.ts";
import type { JobCompanyRow } from "./types.ts";

const company: JobCompanyRow = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Example",
  slug: "example",
  logo_url: null,
  website_url: null,
  careers_url: null,
  domains: ["developer-tools"],
  source_type: "greenhouse",
  source_identifier: "example",
  source_region: "global",
  active: true,
  verified: true,
  crawl_interval_hours: null,
  priority: 50,
  last_success_at: null,
};

describe("ATS adapters", () => {
  it("normalizes Greenhouse payloads", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      jobs: [{
        id: 123,
        title: "Backend Engineer",
        absolute_url: "https://boards.greenhouse.io/example/jobs/123?gh_src=test",
        content: "<p>Build APIs with Go.</p>",
        location: { name: "Remote" },
        updated_at: "2026-09-01T00:00:00Z",
        departments: [{ name: "Engineering" }],
      }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const jobs = await fetchCompanyJobs(company, fetcher);
    expect(fetcher).toHaveBeenCalledWith(
      "https://boards-api.greenhouse.io/v1/boards/example/jobs?content=true",
      expect.any(Object),
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      sourceJobId: "123",
      title: "Backend Engineer",
      descriptionPlain: "Build APIs with Go.",
      locationText: "Remote",
      sourceUrl: "https://boards.greenhouse.io/example/jobs/123",
    });
  });

  it("uses the EU Lever host when configured", async () => {
    const fetcher = vi.fn(async () => new Response("[]", { status: 200 }));
    await fetchCompanyJobs({ ...company, source_type: "lever", source_region: "eu" }, fetcher);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("https://api.eu.lever.co/");
  });

  it("paginates Lever feeds before treating them as complete", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: `job-${index}`,
      text: `Engineer ${index}`,
      hostedUrl: `https://jobs.lever.co/example/job-${index}`,
      categories: {},
    }));
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(firstPage), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    const jobs = await fetchCompanyJobs({ ...company, source_type: "lever" }, fetcher);
    expect(jobs).toHaveLength(100);
    expect(String(fetcher.mock.calls[1]?.[0])).toContain("skip=100");
  });

  it("fails closed when a non-paginated ATS feed exceeds the processing cap", async () => {
    const jobs = Array.from({ length: 5_001 }, (_, index) => ({
      id: index,
      title: `Engineer ${index}`,
      absolute_url: `https://boards.greenhouse.io/example/jobs/${index}`,
      content: "Build software.",
      location: { name: "Remote" },
    }));
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ jobs }), { status: 200 }));
    await expect(fetchCompanyJobs(company, fetcher)).rejects.toThrow("source_feed_too_large:greenhouse:5001");
  });
});

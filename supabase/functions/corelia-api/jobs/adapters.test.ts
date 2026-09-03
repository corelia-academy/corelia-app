import { describe, expect, it, vi } from "vitest";

import { fetchCompanyJobs, sourceHasCompleteSnapshot } from "./adapters.ts";
import type { JobCompanyRow } from "./types.ts";

const company: JobCompanyRow = {
  id: "00000000-0000-4000-8000-000000000001",
  source_id: "00000000-0000-4000-8000-000000000002",
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
  last_revalidated_at: null,
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

  it("reads visible Ashby salary components from the nested compensation payload", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      jobs: [{
        id: "ashby-job",
        title: "Ecosystem Manager",
        jobUrl: "https://jobs.ashbyhq.com/example/ashby-job",
        applyUrl: "https://jobs.ashbyhq.com/example/ashby-job/application",
        descriptionPlain: "Build the ecosystem.",
        shouldDisplayCompensationOnJobPostings: true,
        compensation: {
          summaryComponents: [
            { compensationType: "Salary", minValue: 140_000, maxValue: 170_000, currencyCode: "USD", interval: "1 YEAR" },
            { compensationType: "Bonus", minValue: null, maxValue: null, currencyCode: "USD", interval: "1 YEAR" },
          ],
        },
      }],
    }), { status: 200 }));
    const jobs = await fetchCompanyJobs({ ...company, source_type: "ashby" }, fetcher);
    expect(jobs[0]).toMatchObject({
      salaryMin: 140_000,
      salaryMax: 170_000,
      salaryCurrency: "USD",
      salaryPeriod: "year",
    });
  });

  it("does not expose Ashby compensation when the posting disables salary display", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      jobs: [{
        id: "private-salary",
        title: "Engineer",
        jobUrl: "https://jobs.ashbyhq.com/example/private-salary",
        descriptionPlain: "Build software.",
        shouldDisplayCompensationOnJobPostings: false,
        compensation: {
          summaryComponents: [
            { compensationType: "Salary", minValue: 100_000, maxValue: 120_000, currencyCode: "USD", interval: "1 YEAR" },
          ],
        },
      }],
    }), { status: 200 }));
    const jobs = await fetchCompanyJobs({ ...company, source_type: "ashby" }, fetcher);
    expect(jobs[0]).toMatchObject({
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryPeriod: null,
    });
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

  it("normalizes web3.career's mixed response and preserves its required apply URL", async () => {
    const applyUrl = "https://web3.career/apply/example?ref=required&utm_source=web3career";
    const fetcher = vi.fn(async () => new Response(JSON.stringify([
      "ok",
      "v1",
      [{
        id: "web3-job",
        title: "Solidity Engineer",
        company: "Protocol Labs",
        location: "Remote",
        remote: true,
        description: "<p>Build smart contracts.</p>",
        tags: ["solidity", "ethereum"],
        apply_url: applyUrl,
        url: "https://web3.career/solidity-engineer-protocol-labs",
        salary: "$120k - $160k",
        postedAt: "2026-09-03T00:00:00Z",
      }],
    ]), { status: 200 }));

    const jobs = await fetchCompanyJobs(
      { ...company, source_type: "web3career" },
      fetcher,
      { adapterConfig: { limit: 25 }, web3CareerApiToken: "secret-token" },
    );

    expect(String(fetcher.mock.calls[0]?.[0])).toContain("token=secret-token");
    expect(jobs[0]).toMatchObject({
      sourceJobId: "web3-job",
      title: "Solidity Engineer",
      companyName: "Protocol Labs",
      descriptionPlain: "Build smart contracts.",
      applyUrl,
      salaryMin: 120_000,
      salaryMax: 160_000,
      salaryCurrency: "USD",
      salaryPeriod: "year",
      preserveApplyUrl: true,
    });
  });

  it("does not place a web3.career token in HTTP errors", async () => {
    const fetcher = vi.fn(async () => new Response("unauthorized", { status: 401 }));
    await expect(fetchCompanyJobs(
      { ...company, source_type: "web3career" },
      fetcher,
      { web3CareerApiToken: "secret-token" },
    )).rejects.toThrow("source_http_401:https://web3.career/api/v1");
  });

  it("honors the per-run cap when requesting web3.career", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    await fetchCompanyJobs(
      { ...company, source_type: "web3career" },
      fetcher,
      {
        adapterConfig: { limit: 100, max_jobs_per_run: 12 },
        web3CareerApiToken: "secret-token",
      },
    );

    expect(String(fetcher.mock.calls[0]?.[0])).toContain("limit=12");
    expect(sourceHasCompleteSnapshot("web3career", { max_jobs_per_run: 12 })).toBe(false);
  });

  it("paginates and normalizes the official CryptoJobsList API", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jobs: [{
          id: "cjl-1",
          jobTitle: "Senior Solidity Engineer",
          companyName: "Example Protocol",
          companyLogo: "https://example.org/logo.png",
          jobDescription: "<p>Build secure contracts.</p>",
          jobLocation: "Remote",
          remote: true,
          tags: ["solidity", "defi"],
          employmentType: ["FULL_TIME"],
          salary: "$150k - $190k/year",
          publishedAt: "2026-09-03T00:00:00Z",
          canonicalURL: "https://cryptojobslist.com/jobs/senior-solidity-engineer",
        }],
        meta: { totalCount: 2, page: 1, totalPages: 2 },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jobs: [{
          id: "cjl-2",
          jobTitle: "Community Lead",
          companyName: "Example DAO",
          jobDescription: "Grow the community.",
          jobLocation: "Europe",
          employmentType: ["CONTRACT"],
          canonicalURL: "https://cryptojobslist.com/jobs/community-lead",
        }],
        meta: { totalCount: 2, page: 2, totalPages: 2 },
      }), { status: 200 }));

    const jobs = await fetchCompanyJobs(
      { ...company, source_type: "cryptojobslist" },
      fetcher,
      { adapterConfig: { page_size: 1 }, cryptoJobsListApiKey: "cjl-secret" },
    );

    expect(jobs).toHaveLength(2);
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({ "x-api-key": "cjl-secret" });
    expect(String(fetcher.mock.calls[1]?.[0])).toContain("page=2&limit=1");
    expect(jobs[0]).toMatchObject({
      title: "Senior Solidity Engineer",
      companyName: "Example Protocol",
      descriptionPlain: "Build secure contracts.",
      employmentType: "full_time",
      sourceUrl: "https://cryptojobslist.com/jobs/senior-solidity-engineer",
      applyUrl: "https://cryptojobslist.com/jobs/senior-solidity-engineer",
      salaryMin: 150_000,
      salaryMax: 190_000,
      salaryCurrency: "USD",
      salaryPeriod: "year",
      preserveApplyUrl: true,
    });
  });

  it("requires the CryptoJobsList API key before making a request", async () => {
    const fetcher = vi.fn();
    await expect(fetchCompanyJobs(
      { ...company, source_type: "cryptojobslist" },
      fetcher,
    )).rejects.toThrow("missing_secret:CRYPTOJOBS_LIST_API_KEY");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("walks the complete Himalayas cursor feed and keeps provider metadata", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        totalCount: 2,
        nextCursor: "next-page",
        jobs: [{
          guid: "himalayas-1",
          title: "Protocol Engineer",
          companyName: "Example Labs",
          companyLogo: "https://example.com/logo.png",
          description: "<p>Build distributed systems.</p>",
          employmentType: "Full Time",
          minSalary: 150_000,
          maxSalary: 190_000,
          salaryPeriod: "annual",
          currency: "USD",
          locationRestrictions: [],
          categories: ["Engineering"],
          pubDate: 1_788_421_936,
          expiryDate: 1_791_013_936,
          applicationLink: "https://himalayas.app/companies/example/jobs/1",
        }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        totalCount: 2,
        jobs: [{
          guid: "himalayas-2",
          title: "Community Lead",
          companyName: "Example Labs",
          description: "Lead the community.",
          employmentType: "Contract",
          locationRestrictions: ["Vietnam"],
          applicationLink: "https://himalayas.app/companies/example/jobs/2",
        }],
      }), { status: 200 }));

    const jobs = await fetchCompanyJobs({ ...company, source_type: "himalayas" }, fetcher);
    expect(jobs).toHaveLength(2);
    expect(String(fetcher.mock.calls[1]?.[0])).toContain("cursor=next-page");
    expect(jobs[0]).toMatchObject({
      postedAt: "2026-09-03T07:52:16.000Z",
      salaryMin: 150_000,
      salaryMax: 190_000,
      salaryPeriod: "year",
      companyLogoUrl: "https://example.com/logo.png",
      preserveApplyUrl: true,
    });
  });

  it("normalizes We Work Remotely RSS and deduplicates feed entries", async () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><title>Acme &amp; Co: Senior Engineer</title><region>Anywhere in the World</region>
      <type>Full-Time</type><category>Programming</category>
      <description>&lt;p&gt;Pay Range $140,000 — $180,000 USD&lt;/p&gt;</description>
      <pubDate>Thu, 03 Sep 2026 07:31:03 +0000</pubDate>
      <expires_at>Sat, 03 Oct 2026 07:31:03 +0000</expires_at>
      <guid>https://weworkremotely.com/remote-jobs/acme-senior-engineer</guid>
      <link>https://weworkremotely.com/remote-jobs/acme-senior-engineer</link></item>
    </channel></rss>`;
    const fetcher = vi.fn(async () => new Response(xml, { status: 200 }));
    const jobs = await fetchCompanyJobs(
      { ...company, source_type: "weworkremotely" },
      fetcher,
      { adapterConfig: { feed_urls: ["https://weworkremotely.com/remote-jobs.rss"] } },
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      companyName: "Acme & Co",
      title: "Senior Engineer",
      employmentType: "full_time",
      salaryMin: 140_000,
      salaryMax: 180_000,
      salaryCurrency: "USD",
      salaryPeriod: "year",
      preserveApplyUrl: true,
    });
  });

  it("normalizes configured Atom feeds with href links and category terms", async () => {
    const xml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
      <entry><id>urn:job:atom-1</id><title>Example Labs: Protocol Engineer</title>
      <author><name>Example Labs</name></author>
      <summary type="html">&lt;p&gt;Build distributed systems.&lt;/p&gt;</summary>
      <updated>2026-09-03T09:00:00Z</updated>
      <category term="rust"/><category term="web3"/>
      <link rel="alternate" href="https://jobs.example.org/protocol-engineer?utm_source=feed"/>
      </entry></feed>`;
    const fetcher = vi.fn(async () => new Response(xml, { status: 200 }));
    const jobs = await fetchCompanyJobs(
      { ...company, source_type: "rss" },
      fetcher,
      { adapterConfig: { feed_urls: ["https://jobs.example.org/feed.atom"] } },
    );

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      sourceJobId: "urn:job:atom-1",
      title: "Protocol Engineer",
      companyName: "Example Labs",
      descriptionPlain: "Build distributed systems.",
      sourceUrl: "https://jobs.example.org/protocol-engineer?utm_source=feed",
      postedAt: "2026-09-03T09:00:00.000Z",
      sourceTags: ["rust", "web3"],
    });
  });

  it("rejects generic feeds that target localhost or private network hosts", async () => {
    const fetcher = vi.fn();

    await expect(fetchCompanyJobs(
      { ...company, source_type: "rss" },
      fetcher,
      { adapterConfig: { feed_urls: ["http://127.0.0.1/internal"] } },
    )).rejects.toThrow("source_missing_feed_url:rss");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("normalizes Remotive API jobs and treats the response as complete", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      jobs: [{
        id: 42,
        url: "https://remotive.com/remote-jobs/software-dev/example-42",
        title: "Backend Engineer",
        company_name: "Example",
        company_logo_url: "https://remotive.com/job/42/logo",
        category: "Software Development",
        tags: ["Go", "Web3"],
        job_type: "full_time",
        publication_date: "2026-09-03T07:00:00Z",
        candidate_required_location: "Worldwide",
        salary: "$120k-$160k",
        description: "<p>Build APIs.</p>",
      }],
    }), { status: 200 }));
    const jobs = await fetchCompanyJobs({ ...company, source_type: "remotive" }, fetcher);
    expect(jobs[0]).toMatchObject({
      sourceJobId: "42",
      salaryMin: 120_000,
      salaryMax: 160_000,
      companyLogoUrl: "https://remotive.com/job/42/logo",
      preserveApplyUrl: true,
    });
    expect(sourceHasCompleteSnapshot("remotive")).toBe(true);
  });

  it("caps aggregate feeds and does not treat a capped window as a complete snapshot", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      jobs: [
        {
          id: 1,
          url: "https://remotive.com/remote-jobs/software-dev/first-1",
          title: "First Engineer",
          company_name: "Example",
          publication_date: "2026-09-03T07:00:00Z",
          description: "First role",
        },
        {
          id: 2,
          url: "https://remotive.com/remote-jobs/software-dev/second-2",
          title: "Second Engineer",
          company_name: "Example",
          publication_date: "2026-09-03T06:00:00Z",
          description: "Second role",
        },
      ],
    }), { status: 200 }));
    const adapterConfig = { max_jobs_per_run: 1 };
    const jobs = await fetchCompanyJobs(
      { ...company, source_type: "remotive" },
      fetcher,
      { adapterConfig },
    );

    expect(jobs.map((job) => job.sourceJobId)).toEqual(["1"]);
    expect(sourceHasCompleteSnapshot("remotive", adapterConfig)).toBe(false);
  });

  it("skips Remote OK legal metadata and keeps its required listing link", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify([
      { legal: "Link back to Remote OK" },
      {
        id: "99",
        position: "Solana Engineer",
        company: "Protocol",
        description: "<p>Build on Solana.</p>",
        location: "Remote",
        tags: ["solana", "rust"],
        apply_url: "https://remoteok.com/remote-jobs/99?ref=required",
        date: "2026-09-03T07:00:00Z",
        salary_min: 130_000,
        salary_max: 170_000,
      },
    ]), { status: 200 }));
    const jobs = await fetchCompanyJobs({ ...company, source_type: "remoteok" }, fetcher);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      sourceJobId: "99",
      applyUrl: "https://remoteok.com/remote-jobs/99?ref=required",
      salaryCurrency: "USD",
      preserveApplyUrl: true,
    });
    expect(sourceHasCompleteSnapshot("remoteok")).toBe(false);
  });
});

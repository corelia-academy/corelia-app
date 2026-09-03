import {
  finiteNumber,
  htmlToText,
  isoDate,
  normalizeEmploymentType,
  normalizeUrl,
  recordValue,
  stringArray,
  stringValue,
} from "./normalization.ts";
import type { JobCompanyRow, NormalizedSourceJob } from "./types.ts";

export type JobFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const REQUEST_TIMEOUT_MS = 20_000;
const PAGE_SIZE = 100;
const MAX_JOBS_PER_COMPANY = 5_000;

function ensureCompleteFeedSize(jobs: NormalizedSourceJob[], sourceType: string): NormalizedSourceJob[] {
  if (jobs.length > MAX_JOBS_PER_COMPANY) {
    throw new Error(`source_feed_too_large:${sourceType}:${jobs.length}`);
  }
  return jobs;
}

async function fetchJson(fetcher: JobFetch, url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetcher(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "accept": "application/json",
        "user-agent": "CoreliaJobs/1.0 (+https://corelia.vn/jobs)",
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) throw new Error(`source_http_${response.status}:${url}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function greenhouseJobs(payload: unknown, company: JobCompanyRow): NormalizedSourceJob[] {
  const jobs = Array.isArray(recordValue(payload).jobs) ? recordValue(payload).jobs as unknown[] : [];
  return jobs.map((item) => {
    const raw = recordValue(item);
    const location = recordValue(raw.location);
    const descriptionHtml = stringValue(raw.content);
    const sourceUrl = normalizeUrl(stringValue(raw.absolute_url));
    const tags = [
      ...((Array.isArray(raw.departments) ? raw.departments : []).map((entry) => stringValue(recordValue(entry).name))),
      ...((Array.isArray(raw.offices) ? raw.offices : []).map((entry) => stringValue(recordValue(entry).name))),
    ].filter(Boolean);
    return {
      sourceJobId: String(raw.id ?? "").trim(),
      title: stringValue(raw.title),
      companyName: company.name,
      descriptionHtml,
      descriptionPlain: htmlToText(descriptionHtml),
      locationText: stringValue(location.name),
      employmentType: normalizeEmploymentType(tags.find((tag) => /time|contract|intern/i.test(tag))),
      sourceUrl,
      applyUrl: sourceUrl,
      postedAt: isoDate(raw.first_published),
      sourceUpdatedAt: isoDate(raw.updated_at),
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryPeriod: null,
      sourceTags: tags,
      raw,
    };
  });
}

function leverJobs(payload: unknown, company: JobCompanyRow): NormalizedSourceJob[] {
  const jobs = Array.isArray(payload) ? payload : [];
  return jobs.map((item) => {
    const raw = recordValue(item);
    const categories = recordValue(raw.categories);
    const salary = recordValue(raw.salaryRange);
    const descriptionHtml = stringValue(raw.description) || stringValue(raw.descriptionBody);
    const descriptionPlain = stringValue(raw.descriptionPlain) || htmlToText(descriptionHtml);
    const sourceUrl = normalizeUrl(stringValue(raw.hostedUrl));
    return {
      sourceJobId: stringValue(raw.id),
      title: stringValue(raw.text),
      companyName: company.name,
      descriptionHtml,
      descriptionPlain,
      locationText: stringValue(categories.location),
      employmentType: normalizeEmploymentType(categories.commitment),
      sourceUrl,
      applyUrl: normalizeUrl(stringValue(raw.applyUrl) || sourceUrl),
      postedAt: isoDate(raw.createdAt),
      sourceUpdatedAt: null,
      salaryMin: finiteNumber(salary.min),
      salaryMax: finiteNumber(salary.max),
      salaryCurrency: stringValue(salary.currency).toUpperCase() || null,
      salaryPeriod: "year",
      sourceTags: [categories.team, categories.department, categories.commitment].map(stringValue).filter(Boolean),
      raw,
    };
  });
}

function compensationPeriod(value: unknown): NormalizedSourceJob["salaryPeriod"] {
  const interval = stringValue(value).toLowerCase();
  if (/hour/.test(interval)) return "hour";
  if (/day/.test(interval)) return "day";
  if (/week/.test(interval)) return "week";
  if (/month/.test(interval)) return "month";
  if (/year|annual/.test(interval)) return "year";
  return null;
}

function ashbySalary(raw: Record<string, unknown>): Pick<
  NormalizedSourceJob,
  "salaryMin" | "salaryMax" | "salaryCurrency" | "salaryPeriod"
> {
  if (raw.shouldDisplayCompensationOnJobPostings === false) {
    return { salaryMin: null, salaryMax: null, salaryCurrency: null, salaryPeriod: null };
  }
  const compensation = recordValue(raw.compensation);
  const summaryComponents = Array.isArray(compensation.summaryComponents)
    ? compensation.summaryComponents
    : [];
  const tierComponents = (Array.isArray(compensation.compensationTiers)
    ? compensation.compensationTiers
    : []).flatMap((tier) => {
      const components = recordValue(tier).components;
      return Array.isArray(components) ? components : [];
    });
  const salary = [...summaryComponents, ...tierComponents]
    .map(recordValue)
    .find((component) =>
      stringValue(component.compensationType).toLowerCase() === "salary" &&
      (finiteNumber(component.minValue) != null || finiteNumber(component.maxValue) != null)
    );
  if (!salary) {
    return { salaryMin: null, salaryMax: null, salaryCurrency: null, salaryPeriod: null };
  }
  return {
    salaryMin: finiteNumber(salary.minValue),
    salaryMax: finiteNumber(salary.maxValue),
    salaryCurrency: stringValue(salary.currencyCode).toUpperCase() || null,
    salaryPeriod: compensationPeriod(salary.interval),
  };
}

function ashbyJobs(payload: unknown, company: JobCompanyRow): NormalizedSourceJob[] {
  const jobs = Array.isArray(recordValue(payload).jobs) ? recordValue(payload).jobs as unknown[] : [];
  return jobs.map((item) => {
    const raw = recordValue(item);
    const salary = ashbySalary(raw);
    const descriptionHtml = stringValue(raw.descriptionHtml);
    const descriptionPlain = stringValue(raw.descriptionPlain) || htmlToText(descriptionHtml);
    const sourceUrl = normalizeUrl(stringValue(raw.jobUrl));
    const location = [stringValue(raw.location), ...stringArray(raw.secondaryLocations)].filter(Boolean).join(" · ");
    return {
      sourceJobId: stringValue(raw.id) || stringValue(raw.jobUrl),
      title: stringValue(raw.title),
      companyName: company.name,
      descriptionHtml,
      descriptionPlain,
      locationText: location,
      employmentType: normalizeEmploymentType(raw.employmentType),
      sourceUrl,
      applyUrl: normalizeUrl(stringValue(raw.applyUrl) || sourceUrl),
      postedAt: isoDate(raw.publishedAt),
      sourceUpdatedAt: null,
      ...salary,
      sourceTags: [raw.department, raw.team, raw.employmentType].map(stringValue).filter(Boolean),
      raw,
    };
  });
}

function smartRecruitersJob(payload: unknown, company: JobCompanyRow): NormalizedSourceJob {
  const raw = recordValue(payload);
  const location = recordValue(raw.location);
  const companyData = recordValue(raw.company);
  const jobAd = recordValue(raw.jobAd);
  const sections = recordValue(jobAd.sections);
  const sectionHtml = Object.values(sections)
    .map((section) => stringValue(recordValue(section).text))
    .filter(Boolean)
    .join("\n");
  const sourceUrl = normalizeUrl(stringValue(raw.applyUrl) || stringValue(raw.ref));
  return {
    sourceJobId: stringValue(raw.uuid) || stringValue(raw.id),
    title: stringValue(raw.name),
    companyName: stringValue(companyData.name) || company.name,
    descriptionHtml: sectionHtml,
    descriptionPlain: htmlToText(sectionHtml),
    locationText: [location.city, location.region, location.country].map(stringValue).filter(Boolean).join(", "),
    employmentType: normalizeEmploymentType(recordValue(raw.typeOfEmployment).label),
    sourceUrl,
    applyUrl: sourceUrl,
    postedAt: isoDate(raw.releasedDate),
    sourceUpdatedAt: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    sourceTags: [recordValue(raw.department).label, recordValue(raw.experienceLevel).label].map(stringValue).filter(Boolean),
    raw,
  };
}

async function fetchSmartRecruiters(company: JobCompanyRow, fetcher: JobFetch): Promise<NormalizedSourceJob[]> {
  const identifier = encodeURIComponent(company.source_identifier);
  const summaries: unknown[] = [];
  let reportedTotal: number | null = null;
  for (let offset = 0; offset < MAX_JOBS_PER_COMPANY; offset += PAGE_SIZE) {
    const list = recordValue(await fetchJson(
      fetcher,
      `https://api.smartrecruiters.com/v1/companies/${identifier}/postings?limit=${PAGE_SIZE}&offset=${offset}`,
    ));
    const page = Array.isArray(list.content) ? list.content as unknown[] : [];
    summaries.push(...page);
    reportedTotal = finiteNumber(list.totalFound);
    if (reportedTotal != null && reportedTotal > MAX_JOBS_PER_COMPANY) {
      throw new Error(`source_feed_too_large:smartrecruiters:${reportedTotal}`);
    }
    if (page.length < PAGE_SIZE || (reportedTotal != null && summaries.length >= reportedTotal)) break;
  }
  if (summaries.length >= MAX_JOBS_PER_COMPANY && reportedTotal == null) {
    throw new Error("source_feed_too_large:smartrecruiters");
  }
  const jobs: NormalizedSourceJob[] = [];
  for (let offset = 0; offset < summaries.length; offset += 5) {
    const batch = summaries.slice(offset, offset + 5);
    const details = await Promise.all(batch.map(async (summary) => {
      const id = stringValue(recordValue(summary).uuid) || stringValue(recordValue(summary).id);
      if (!id) return summary;
      return fetchJson(fetcher, `https://api.smartrecruiters.com/v1/companies/${identifier}/postings/${encodeURIComponent(id)}`);
    }));
    jobs.push(...details.map((detail) => smartRecruitersJob(detail, company)));
  }
  return jobs;
}

async function fetchLever(company: JobCompanyRow, fetcher: JobFetch): Promise<NormalizedSourceJob[]> {
  const identifier = encodeURIComponent(company.source_identifier);
  const host = company.source_region === "eu" ? "api.eu.lever.co" : "api.lever.co";
  const jobs: NormalizedSourceJob[] = [];
  let lastPageLength = 0;
  for (let skip = 0; skip < MAX_JOBS_PER_COMPANY; skip += PAGE_SIZE) {
    const payload = await fetchJson(
      fetcher,
      `https://${host}/v0/postings/${identifier}?mode=json&skip=${skip}&limit=${PAGE_SIZE}`,
    );
    const page = leverJobs(payload, company);
    lastPageLength = page.length;
    jobs.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  if (jobs.length >= MAX_JOBS_PER_COMPANY && lastPageLength === PAGE_SIZE) {
    throw new Error("source_feed_too_large:lever");
  }
  return jobs;
}

export async function fetchCompanyJobs(
  company: JobCompanyRow,
  fetcher: JobFetch = fetch,
): Promise<NormalizedSourceJob[]> {
  const identifier = encodeURIComponent(company.source_identifier);
  if (company.source_type === "greenhouse") {
    const payload = await fetchJson(fetcher, `https://boards-api.greenhouse.io/v1/boards/${identifier}/jobs?content=true`);
    return ensureCompleteFeedSize(greenhouseJobs(payload, company), "greenhouse");
  }
  if (company.source_type === "lever") {
    return fetchLever(company, fetcher);
  }
  if (company.source_type === "ashby") {
    const payload = await fetchJson(fetcher, `https://api.ashbyhq.com/posting-api/job-board/${identifier}?includeCompensation=true`);
    return ensureCompleteFeedSize(ashbyJobs(payload, company), "ashby");
  }
  return fetchSmartRecruiters(company, fetcher);
}

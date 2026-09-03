import {
  decodeHtmlEntities,
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

type JobAdapterOptions = {
  adapterConfig?: Record<string, unknown>;
  cryptoJobsListApiKey?: string;
  web3CareerApiToken?: string;
};

function ensureCompleteFeedSize(jobs: NormalizedSourceJob[], sourceType: string): NormalizedSourceJob[] {
  if (jobs.length > MAX_JOBS_PER_COMPANY) {
    throw new Error(`source_feed_too_large:${sourceType}:${jobs.length}`);
  }
  return jobs;
}

function configuredJobLimit(options: JobAdapterOptions): number {
  const value = finiteNumber(options.adapterConfig?.max_jobs_per_run);
  return value == null ? MAX_JOBS_PER_COMPANY : Math.max(1, Math.min(MAX_JOBS_PER_COMPANY, Math.trunc(value)));
}

function limitConfiguredJobs(
  jobs: NormalizedSourceJob[],
  sourceType: string,
  options: JobAdapterOptions,
): NormalizedSourceJob[] {
  return ensureCompleteFeedSize(jobs, sourceType).slice(0, configuredJobLimit(options));
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
    if (!response.ok) {
      const requestUrl = new URL(url);
      throw new Error(`source_http_${response.status}:${requestUrl.origin}${requestUrl.pathname}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(fetcher: JobFetch, url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetcher(url, {
      signal: controller.signal,
      headers: {
        "accept": "application/rss+xml, application/atom+xml, application/xml, text/xml",
        "user-agent": "CoreliaJobs/1.0 (+https://corelia.vn/jobs)",
      },
    });
    if (!response.ok) {
      const requestUrl = new URL(url);
      throw new Error(`source_http_${response.status}:${requestUrl.origin}${requestUrl.pathname}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function salaryNumber(value: string, suffix: string): number | null {
  const parsed = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return null;
  if (suffix.toLowerCase() === "k") return parsed * 1_000;
  if (suffix.toLowerCase() === "m") return parsed * 1_000_000;
  return parsed;
}

function textSalary(value: unknown): Pick<
  NormalizedSourceJob,
  "salaryMin" | "salaryMax" | "salaryCurrency" | "salaryPeriod"
> {
  const text = stringValue(value);
  const currency = /\b(EUR|GBP|USD|CAD|AUD|SGD|CHF|JPY)\b/i.exec(text)?.[1]?.toUpperCase()
    ?? (text.includes("€") ? "EUR" : text.includes("£") ? "GBP" : text.includes("$") ? "USD" : null);
  const values = Array.from(text.matchAll(/(?:^|[^\w])([0-9]+(?:[,.][0-9]+)*)([km]?)(?=$|[^\w])/gi))
    .map((match) => salaryNumber(match[1], match[2]))
    .filter((entry): entry is number => entry != null);
  const period = compensationPeriod(text);
  if (!currency || !values.length) {
    return { salaryMin: null, salaryMax: null, salaryCurrency: null, salaryPeriod: null };
  }
  return {
    salaryMin: values[0],
    salaryMax: values[1] ?? values[0],
    salaryCurrency: currency,
    salaryPeriod: period ?? (Math.max(...values) >= 10_000 ? "year" : null),
  };
}

function web3CareerJobs(payload: unknown): NormalizedSourceJob[] {
  if (!Array.isArray(payload)) throw new Error("source_invalid_payload:web3career");
  const nested = payload.find((entry) => Array.isArray(entry));
  let jobs: unknown[];
  if (Array.isArray(nested)) jobs = nested;
  else if (payload.every((entry) => entry && typeof entry === "object" && !Array.isArray(entry))) jobs = payload;
  else throw new Error("source_invalid_payload:web3career");
  return jobs.map((item) => {
    const raw = recordValue(item);
    const descriptionHtml = stringValue(raw.description);
    const sourceUrl = normalizeUrl(stringValue(raw.url));
    const applyUrl = stringValue(raw.apply_url);
    const salary = textSalary(raw.salary);
    return {
      sourceJobId: stringValue(raw.id) || sourceUrl || applyUrl,
      title: stringValue(raw.title),
      companyName: stringValue(raw.company),
      descriptionHtml,
      descriptionPlain: htmlToText(descriptionHtml),
      locationText: stringValue(raw.location) || (raw.remote === true ? "Remote" : ""),
      employmentType: normalizeEmploymentType(raw.employment_type),
      sourceUrl: sourceUrl || normalizeUrl(applyUrl),
      applyUrl,
      postedAt: isoDate(raw.postedAt),
      sourceUpdatedAt: null,
      ...salary,
      sourceTags: [...stringArray(raw.tags), ...(raw.remote === true ? ["remote"] : [])],
      preserveApplyUrl: true,
      raw,
    };
  });
}

function cryptoJobsListJobs(payload: unknown): NormalizedSourceJob[] {
  const jobs = recordValue(payload).jobs;
  if (!Array.isArray(jobs)) throw new Error("source_invalid_payload:cryptojobslist");
  return jobs.map((item) => {
    const raw = recordValue(item);
    const descriptionHtml = stringValue(raw.jobDescription) || stringValue(raw.descriptionHtml) ||
      stringValue(raw.description);
    const sourceUrl = normalizeUrl(
      stringValue(raw.canonicalURL) || stringValue(raw.canonicalUrl) || stringValue(raw.url),
    );
    const structuredMin = finiteNumber(raw.salaryMin) ?? finiteNumber(raw.minSalary);
    const structuredMax = finiteNumber(raw.salaryMax) ?? finiteNumber(raw.maxSalary);
    const structuredCurrency = stringValue(raw.salaryCurrency) || stringValue(raw.currency);
    const parsedSalary = textSalary(raw.salary ?? raw.compensation);
    const employment = Array.isArray(raw.employmentType)
      ? raw.employmentType.map(stringValue).find(Boolean)
      : raw.employmentType;
    return {
      sourceJobId: String(raw.id ?? raw.jobId ?? "").trim() || sourceUrl,
      title: stringValue(raw.jobTitle) || stringValue(raw.title),
      companyName: stringValue(raw.companyName) || stringValue(raw.company),
      companyLogoUrl: normalizeUrl(
        stringValue(raw.companyLogo) || stringValue(raw.companyLogoURL) || stringValue(raw.logo),
      ) || null,
      descriptionHtml,
      descriptionPlain: htmlToText(descriptionHtml),
      locationText: stringValue(raw.jobLocation) || stringValue(raw.location) ||
        (raw.remote === true ? "Remote" : ""),
      employmentType: normalizeEmploymentType(employment),
      sourceUrl,
      applyUrl: sourceUrl,
      postedAt: isoDate(raw.publishedAt) || isoDate(raw.postedAt),
      sourceUpdatedAt: isoDate(raw.updatedAt),
      expiresAt: isoDate(raw.validThrough) || isoDate(raw.expiresAt),
      salaryMin: structuredMin ?? parsedSalary.salaryMin,
      salaryMax: structuredMax ?? parsedSalary.salaryMax,
      salaryCurrency: structuredCurrency.toUpperCase() || parsedSalary.salaryCurrency,
      salaryPeriod: compensationPeriod(raw.salaryPeriod) ?? parsedSalary.salaryPeriod,
      sourceTags: [...stringArray(raw.tags), ...(raw.remote === true ? ["remote"] : [])],
      preserveApplyUrl: true,
      raw,
    };
  });
}

async function fetchCryptoJobsList(
  fetcher: JobFetch,
  options: JobAdapterOptions,
): Promise<NormalizedSourceJob[]> {
  const apiKey = options.cryptoJobsListApiKey?.trim() ?? "";
  if (!apiKey) throw new Error("missing_secret:CRYPTOJOBS_LIST_API_KEY");
  const configuredLimit = finiteNumber(options.adapterConfig?.page_size);
  const target = configuredJobLimit(options);
  const pageLimit = configuredLimit == null ? PAGE_SIZE : Math.max(1, Math.min(PAGE_SIZE, Math.trunc(configuredLimit)));
  const limit = Math.min(pageLimit, target);
  const jobs: NormalizedSourceJob[] = [];
  for (let page = 1; jobs.length < target; page += 1) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    const payload = await fetchJson(
      fetcher,
      `https://api.cryptojobslist.com/public/jobs?${params}`,
      { headers: { "x-api-key": apiKey } },
    );
    const pageJobs = cryptoJobsListJobs(payload);
    jobs.push(...pageJobs);
    const meta = recordValue(recordValue(payload).meta);
    const totalCount = finiteNumber(meta.totalCount);
    const totalPages = finiteNumber(meta.totalPages);
    if (target === MAX_JOBS_PER_COMPANY && totalCount != null && totalCount > MAX_JOBS_PER_COMPANY) {
      throw new Error(`source_feed_too_large:cryptojobslist:${totalCount}`);
    }
    if (jobs.length >= target || pageJobs.length < limit || (totalPages != null && page >= totalPages)) {
      return limitConfiguredJobs(jobs, "cryptojobslist", options);
    }
  }
  throw new Error("source_feed_too_large:cryptojobslist");
}

function xmlValue(xml: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}\\s*>`, "i").exec(xml);
  if (!match) return "";
  const value = match[1].trim().replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/i, "$1");
  return decodeHtmlEntities(value).trim();
}

function xmlValues(xml: string, tag: string): string[] {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Array.from(xml.matchAll(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}\\s*>`, "gi")))
    .map((match) => decodeHtmlEntities(match[1].trim().replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/i, "$1")).trim())
    .filter(Boolean);
}

function xmlAttributeValues(xml: string, tag: string, attribute: string): string[] {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedAttribute = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Array.from(xml.matchAll(new RegExp(
    `<${escapedTag}\\b[^>]*\\b${escapedAttribute}\\s*=\\s*["']([^"']+)["'][^>]*\\/?\\s*>`,
    "gi",
  )))
    .map((match) => decodeHtmlEntities(match[1]).trim())
    .filter(Boolean);
}

function atomLink(xml: string): string {
  const tags = Array.from(xml.matchAll(/<link\b[^>]*>/gi), (match) => match[0]);
  const preferred = tags.find((tag) => /\brel\s*=\s*["']alternate["']/i.test(tag)) ?? tags[0] ?? "";
  return xmlAttributeValues(preferred, "link", "href")[0] ?? "";
}

function rssJobs(xml: string, company: JobCompanyRow): NormalizedSourceJob[] {
  const entries = [
    ...Array.from(xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item\s*>/gi), (match) => ({ body: match[1], atom: false })),
    ...Array.from(xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry\s*>/gi), (match) => ({ body: match[1], atom: true })),
  ];
  if (!entries.length && !/<rss\b|<feed\b/i.test(xml)) throw new Error(`source_invalid_payload:${company.source_type}`);
  return entries.map(({ body: item, atom }) => {
    const feedTitle = xmlValue(item, "title");
    const explicitCompany = xmlValue(item, "company") || xmlValue(item, "dc:creator") ||
      (atom ? xmlValue(xmlValue(item, "author"), "name") : "");
    const titleSeparator = feedTitle.indexOf(": ");
    const titlePrefix = titleSeparator > 0 ? feedTitle.slice(0, titleSeparator).trim() : "";
    const companyName = explicitCompany || titlePrefix || company.name;
    const title = titleSeparator > 0 && (!explicitCompany || titlePrefix.toLowerCase() === explicitCompany.toLowerCase())
      ? feedTitle.slice(titleSeparator + 2).trim()
      : feedTitle;
    const descriptionHtml = xmlValue(item, "description") || xmlValue(item, "content:encoded") ||
      xmlValue(item, "content") || xmlValue(item, "summary");
    const sourceUrl = xmlValue(item, "link") || (atom ? atomLink(item) : "") ||
      xmlValue(item, "guid") || xmlValue(item, "id");
    const categories = [...xmlValues(item, "category"), ...xmlAttributeValues(item, "category", "term")];
    const skills = xmlValue(item, "skills").split(",").map((value) => value.trim()).filter(Boolean);
    const salary = textSalary(htmlToText(descriptionHtml));
    return {
      sourceJobId: xmlValue(item, "jobId") || xmlValue(item, "guid") || xmlValue(item, "id") || sourceUrl,
      title,
      companyName,
      descriptionHtml,
      descriptionPlain: htmlToText(descriptionHtml),
      locationText: xmlValue(item, "location") || xmlValue(item, "region") || xmlValue(item, "country"),
      employmentType: normalizeEmploymentType(xmlValue(item, "type")),
      sourceUrl,
      applyUrl: sourceUrl,
      postedAt: isoDate(xmlValue(item, "pubDate") || xmlValue(item, "published") || xmlValue(item, "updated")),
      sourceUpdatedAt: null,
      expiresAt: isoDate(xmlValue(item, "expires_at") || xmlValue(item, "expirationDate")),
      ...salary,
      sourceTags: [...categories, ...skills],
      preserveApplyUrl: true,
      raw: {
        title: feedTitle,
        company: companyName,
        description: descriptionHtml,
        location: xmlValue(item, "location") || xmlValue(item, "region") || xmlValue(item, "country"),
        type: xmlValue(item, "type"),
        categories,
        skills,
        source_url: sourceUrl,
        published_at: xmlValue(item, "pubDate") || xmlValue(item, "published") || xmlValue(item, "updated"),
        expires_at: xmlValue(item, "expires_at") || xmlValue(item, "expirationDate"),
      },
    };
  });
}

function configuredFeedUrls(company: JobCompanyRow, options: JobAdapterOptions): string[] {
  const configured = options.adapterConfig?.feed_urls;
  const defaults = company.source_type === "weworkremotely"
    ? ["https://weworkremotely.com/remote-jobs.rss"]
    : [];
  const values = Array.isArray(configured) ? configured.map(stringValue).filter(Boolean) : defaults;
  const urls = values.slice(0, 10).filter((value) => {
    try {
      const url = new URL(value);
      const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
      const privateIpv4 = /^(?:127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(hostname);
      return (url.protocol === "https:" || url.protocol === "http:") &&
        hostname !== "localhost" && hostname !== "::1" && !hostname.endsWith(".localhost") && !privateIpv4;
    } catch {
      return false;
    }
  });
  if (!urls.length) throw new Error(`source_missing_feed_url:${company.source_type}`);
  return urls;
}

async function fetchRss(
  company: JobCompanyRow,
  fetcher: JobFetch,
  options: JobAdapterOptions,
): Promise<NormalizedSourceJob[]> {
  const jobs = (await Promise.all(configuredFeedUrls(company, options).map(async (url) =>
    rssJobs(await fetchText(fetcher, url), company)
  ))).flat();
  const unique = new Map(jobs.map((job) => [job.sourceJobId, job]));
  return limitConfiguredJobs(Array.from(unique.values()), company.source_type, options);
}

function himalayasJobs(items: unknown[]): NormalizedSourceJob[] {
  return items.map((item) => {
    const raw = recordValue(item);
    const descriptionHtml = stringValue(raw.description);
    const sourceUrl = stringValue(raw.applicationLink);
    const locationRestrictions = stringArray(raw.locationRestrictions);
    const minSalary = finiteNumber(raw.minSalary);
    const maxSalary = finiteNumber(raw.maxSalary);
    return {
      sourceJobId: stringValue(raw.guid) || sourceUrl,
      title: stringValue(raw.title),
      companyName: stringValue(raw.companyName),
      companyLogoUrl: normalizeUrl(stringValue(raw.companyLogo)) || null,
      descriptionHtml,
      descriptionPlain: htmlToText(descriptionHtml) || stringValue(raw.excerpt),
      locationText: locationRestrictions.length ? locationRestrictions.join(", ") : "Worldwide",
      employmentType: normalizeEmploymentType(raw.employmentType),
      sourceUrl,
      applyUrl: sourceUrl,
      postedAt: isoDate(raw.pubDate),
      sourceUpdatedAt: null,
      expiresAt: isoDate(raw.expiryDate),
      salaryMin: minSalary != null && minSalary > 0 ? minSalary : null,
      salaryMax: maxSalary != null && maxSalary > 0 ? maxSalary : null,
      salaryCurrency: stringValue(raw.currency).toUpperCase() || null,
      salaryPeriod: compensationPeriod(raw.salaryPeriod),
      sourceTags: [
        ...stringArray(raw.categories),
        ...stringArray(raw.parentCategories),
        stringValue(raw.seniority),
        stringValue(raw.employmentType),
        ...(locationRestrictions.length ? locationRestrictions : ["remote", "worldwide"]),
      ].filter(Boolean),
      preserveApplyUrl: true,
      raw,
    };
  });
}

async function fetchHimalayas(fetcher: JobFetch, options: JobAdapterOptions): Promise<NormalizedSourceJob[]> {
  const items: unknown[] = [];
  const seenCursors = new Set<string>();
  const target = configuredJobLimit(options);
  let cursor = "";
  for (let page = 0; page < 250; page += 1) {
    const params = new URLSearchParams({ limit: "20" });
    if (cursor) params.set("cursor", cursor);
    const payload = recordValue(await fetchJson(fetcher, `https://himalayas.app/jobs/api?${params}`));
    if (!Array.isArray(payload.jobs)) throw new Error("source_invalid_payload:himalayas");
    items.push(...payload.jobs);
    const reportedTotal = finiteNumber(payload.totalCount);
    if (target === MAX_JOBS_PER_COMPANY && reportedTotal != null && reportedTotal > MAX_JOBS_PER_COMPANY) {
      throw new Error(`source_feed_too_large:himalayas:${reportedTotal}`);
    }
    if (items.length >= target) return himalayasJobs(items).slice(0, target);
    const nextCursor = stringValue(payload.nextCursor);
    if (!nextCursor) return himalayasJobs(items);
    if (seenCursors.has(nextCursor)) throw new Error("source_repeated_cursor:himalayas");
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }
  throw new Error("source_feed_too_large:himalayas");
}

function remotiveJobs(payload: unknown): NormalizedSourceJob[] {
  const jobs = recordValue(payload).jobs;
  if (!Array.isArray(jobs)) throw new Error("source_invalid_payload:remotive");
  return jobs.map((item) => {
    const raw = recordValue(item);
    const descriptionHtml = stringValue(raw.description);
    const sourceUrl = stringValue(raw.url);
    return {
      sourceJobId: String(raw.id ?? "").trim() || sourceUrl,
      title: stringValue(raw.title),
      companyName: stringValue(raw.company_name),
      companyLogoUrl: normalizeUrl(stringValue(raw.company_logo_url) || stringValue(raw.company_logo)) || null,
      descriptionHtml,
      descriptionPlain: htmlToText(descriptionHtml),
      locationText: stringValue(raw.candidate_required_location) || "Remote",
      employmentType: normalizeEmploymentType(raw.job_type),
      sourceUrl,
      applyUrl: sourceUrl,
      postedAt: isoDate(raw.publication_date),
      sourceUpdatedAt: null,
      ...textSalary(raw.salary),
      sourceTags: [stringValue(raw.category), ...stringArray(raw.tags), "remote"].filter(Boolean),
      preserveApplyUrl: true,
      raw,
    };
  });
}

function remoteOkJobs(payload: unknown): NormalizedSourceJob[] {
  if (!Array.isArray(payload)) throw new Error("source_invalid_payload:remoteok");
  return payload.flatMap((item) => {
    const raw = recordValue(item);
    const sourceJobId = String(raw.id ?? "").trim();
    const title = stringValue(raw.position);
    if (!sourceJobId || !title) return [];
    const sourceUrl = stringValue(raw.apply_url) || stringValue(raw.url);
    const minSalary = finiteNumber(raw.salary_min);
    const maxSalary = finiteNumber(raw.salary_max);
    const hasSalary = (minSalary != null && minSalary > 0) || (maxSalary != null && maxSalary > 0);
    const descriptionHtml = stringValue(raw.description);
    return [{
      sourceJobId,
      title,
      companyName: stringValue(raw.company),
      companyLogoUrl: normalizeUrl(stringValue(raw.company_logo) || stringValue(raw.logo)) || null,
      descriptionHtml,
      descriptionPlain: htmlToText(descriptionHtml),
      locationText: stringValue(raw.location) || "Remote",
      employmentType: normalizeEmploymentType(raw.job_type),
      sourceUrl,
      applyUrl: sourceUrl,
      postedAt: isoDate(raw.date) || isoDate(raw.epoch),
      sourceUpdatedAt: null,
      salaryMin: hasSalary && minSalary && minSalary > 0 ? minSalary : null,
      salaryMax: hasSalary && maxSalary && maxSalary > 0 ? maxSalary : null,
      salaryCurrency: hasSalary ? "USD" : null,
      salaryPeriod: hasSalary ? "year" as const : null,
      sourceTags: [...stringArray(raw.tags), "remote"],
      preserveApplyUrl: true,
      raw,
    }];
  });
}

async function fetchWeb3Career(
  fetcher: JobFetch,
  options: JobAdapterOptions,
): Promise<NormalizedSourceJob[]> {
  const token = options.web3CareerApiToken?.trim() ?? "";
  if (!token) throw new Error("missing_secret:WEB3_CAREER_API_TOKEN");
  const configuredLimit = finiteNumber(options.adapterConfig?.limit);
  const providerLimit = configuredLimit == null ? 25 : Math.max(1, Math.min(100, Math.trunc(configuredLimit)));
  const limit = Math.min(providerLimit, configuredJobLimit(options));
  const showDescription = options.adapterConfig?.show_description !== false;
  const params = new URLSearchParams({
    token,
    limit: String(limit),
    show_description: String(showDescription),
  });
  const payload = await fetchJson(fetcher, `https://web3.career/api/v1?${params.toString()}`);
  return limitConfiguredJobs(web3CareerJobs(payload), "web3career", options);
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
  options: JobAdapterOptions = {},
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
  if (company.source_type === "cryptojobslist") {
    return fetchCryptoJobsList(fetcher, options);
  }
  if (company.source_type === "web3career") {
    return fetchWeb3Career(fetcher, options);
  }
  if (company.source_type === "himalayas") {
    return fetchHimalayas(fetcher, options);
  }
  if (company.source_type === "weworkremotely" || company.source_type === "rss") {
    return fetchRss(company, fetcher, options);
  }
  if (company.source_type === "remotive") {
    return limitConfiguredJobs(
      remotiveJobs(await fetchJson(fetcher, "https://remotive.com/api/remote-jobs")),
      "remotive",
      options,
    );
  }
  if (company.source_type === "remoteok") {
    return limitConfiguredJobs(
      remoteOkJobs(await fetchJson(fetcher, "https://remoteok.com/api")),
      "remoteok",
      options,
    );
  }
  if (company.source_type === "smartrecruiters") {
    return fetchSmartRecruiters(company, fetcher);
  }
  throw new Error(`unsupported_source_adapter:${company.source_type}`);
}

export function sourceHasCompleteSnapshot(
  sourceType: JobCompanyRow["source_type"],
  adapterConfig: Record<string, unknown> = {},
): boolean {
  if (finiteNumber(adapterConfig.max_jobs_per_run) != null) return false;
  return ["greenhouse", "lever", "ashby", "smartrecruiters", "cryptojobslist", "himalayas", "remotive"].includes(sourceType);
}

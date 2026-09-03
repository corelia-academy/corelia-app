export type JobSourceType = "greenhouse" | "lever" | "ashby" | "smartrecruiters";

export type NormalizedSourceJob = {
  sourceJobId: string;
  title: string;
  companyName: string;
  descriptionHtml: string;
  descriptionPlain: string;
  locationText: string;
  employmentType: string | null;
  sourceUrl: string;
  applyUrl: string;
  postedAt: string | null;
  sourceUpdatedAt: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: "hour" | "day" | "week" | "month" | "year" | null;
  sourceTags: string[];
  raw: Record<string, unknown>;
};

export type JobClassification = {
  isRelevant: boolean;
  primaryRole: string | null;
  roles: string[];
  domains: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  seniority: string | null;
  experienceMinYears: number | null;
  experienceMaxYears: number | null;
  remoteType: "remote" | "hybrid" | "onsite" | "unknown";
  countryCodes: string[];
  regions: string[];
  remoteEligibility: string | null;
  summary: string;
  qualityScore: number;
  confidence: number;
  evidence: Record<string, unknown>;
  model: string;
  classifierVersion: string;
};

export type JobCompanyRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website_url: string | null;
  careers_url: string | null;
  domains: string[] | null;
  source_type: JobSourceType;
  source_identifier: string;
  source_region: "global" | "eu";
  active: boolean;
  verified: boolean;
  crawl_interval_hours: number | null;
  priority: number;
  last_success_at: string | null;
};

export type JobSourceRow = {
  id: string;
  name: string;
  slug: string;
  source_type: JobSourceType;
  enabled: boolean;
  priority: number;
  policy_reviewed_at: string | null;
  allow_description_display: boolean;
  canonical_link_required: boolean;
};

export type CrawlCounters = {
  fetched_count: number;
  new_raw_count: number;
  unchanged_count: number;
  duplicate_count: number;
  ai_queued_count: number;
  published_count: number;
  review_count: number;
  rejected_count: number;
  failed_count: number;
  expired_count: number;
};

export const emptyCrawlCounters = (): CrawlCounters => ({
  fetched_count: 0,
  new_raw_count: 0,
  unchanged_count: 0,
  duplicate_count: 0,
  ai_queued_count: 0,
  published_count: 0,
  review_count: 0,
  rejected_count: 0,
  failed_count: 0,
  expired_count: 0,
});

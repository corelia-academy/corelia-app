export type JobStatus = "review" | "active" | "rejected" | "expired" | "disabled" | "duplicate";
export type JobRemoteType = "remote" | "hybrid" | "onsite" | "unknown";
export type JobType = "tech" | "non_tech";

export type Job = {
  id: string;
  slug: string;
  title: string;
  company_id: string | null;
  company_name: string;
  company_logo_url: string | null;
  description_html: string | null;
  description_plain: string | null;
  summary: string | null;
  job_type: JobType;
  primary_role: string | null;
  roles: string[];
  domains: string[];
  required_skills: string[];
  preferred_skills: string[];
  mentioned_skills: string[];
  seniority: string | null;
  experience_min_years: number | null;
  experience_max_years: number | null;
  employment_type: string | null;
  remote_type: JobRemoteType | null;
  location_text: string | null;
  country_codes: string[];
  regions: string[];
  remote_eligibility: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  source_id: string;
  source_job_id: string;
  source_url: string;
  canonical_url: string;
  apply_url: string;
  posted_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  expires_at: string | null;
  status: JobStatus;
  review_reason?: string | null;
  quality_score?: number | null;
  classification_confidence?: number | null;
  manual_overrides?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  job_sources?: {
    name: string;
    slug: string;
    attribution_required: boolean;
    attribution_text: string | null;
    allow_seo_indexing: boolean;
  } | null;
};

export type AdminJob = Job & {
  review_reason: string | null;
  quality_score: number | null;
  classification_confidence: number | null;
  manual_overrides: Record<string, unknown>;
};

export type UserJobState = {
  user_id: string;
  job_id: string;
  saved: boolean;
  applied: boolean;
  hidden: boolean;
  saved_at: string | null;
  applied_at: string | null;
  updated_at: string;
};

export type JobFilters = {
  query?: string;
  jobType?: JobType;
  role?: string;
  domain?: string;
  skill?: string;
  seniority?: string;
  remoteType?: string;
  region?: string;
  employmentType?: string;
  postedWithinDays?: number;
  salaryMin?: number;
  salaryCurrency?: string;
  page?: number;
  pageSize?: number;
};

export type JobsPageResult = {
  items: Job[];
  total: number;
  page: number;
  pageSize: number;
  stateByJobId: Record<string, UserJobState>;
};

export type JobTaxonomyItem = {
  slug: string;
  name: string;
  group_name?: string;
  category?: string;
};

export type JobTaxonomy = {
  roles: JobTaxonomyItem[];
  domains: JobTaxonomyItem[];
  skills: JobTaxonomyItem[];
};

export type MarketDailyStat = {
  date: string;
  active_jobs: number;
  new_jobs: number;
  expired_jobs: number;
  remote_jobs: number;
  entry_level_jobs: number;
  salary_jobs: number;
  comparable_new_jobs: number;
  comparable_total_jobs: number;
};

export type MarketDimensionStat = {
  date: string;
  role?: string;
  skill?: string;
  domain?: string;
  new_jobs: number;
  active_jobs: number;
  comparable_new_jobs: number;
  comparable_total_jobs: number;
  remote_jobs?: number;
  required_count?: number;
  preferred_count?: number;
};

export type JobMarketSnapshot = {
  daily: MarketDailyStat[];
  latest: MarketDailyStat | null;
  roles: MarketDimensionStat[];
  skills: MarketDimensionStat[];
  domains: MarketDimensionStat[];
};

export type JobSourceAdmin = {
  id: string;
  name: string;
  slug: string;
  source_type: string;
  default_crawl_hours: number;
  priority: number;
  enabled: boolean;
  attribution_required: boolean;
  policy_reviewed_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
};

export type JobCompanyAdmin = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website_url: string | null;
  careers_url: string | null;
  domains: string[];
  source_type: string;
  source_identifier: string;
  source_region: string;
  crawl_interval_hours: number | null;
  priority: number;
  verified: boolean;
  active: boolean;
  last_success_at: string | null;
  last_error: string | null;
};

export type CrawlerRun = {
  id: string;
  target_type: string;
  target_value: string | null;
  trigger_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  fetched_count: number;
  new_raw_count: number;
  unchanged_count: number;
  published_count: number;
  review_count: number;
  rejected_count: number;
  failed_count: number;
  expired_count: number;
  error_message: string | null;
};

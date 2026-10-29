/**
 * Public catalog data for the SEO pages (courses, hackathons, jobs).
 *
 * Reads the same public rows the learning app shows to signed-out visitors, through
 * PostgREST with the publishable key, so RLS decides what is visible. The filters mirror
 * `src/lib/courses.ts`, `src/lib/hackathons.ts` and `src/lib/jobs.ts` in the app; keep them
 * in sync when the app's public visibility rules change.
 */
import { SITE_LOCALES, type SiteLocale } from "@corelia/ui/locales";

const SUPABASE_URL = String(import.meta.env.PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const SUPABASE_KEY = String(import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "");
/** Edge cache for upstream reads (Cloudflare `cf` fetch options; ignored elsewhere). */
const EDGE_CACHE_SECONDS = 300;

export const CATALOG_DEFAULT_CONTENT_LOCALE: SiteLocale = "vi";

type EntityI18n = { primary_content_locale?: unknown; supported_locales?: unknown } | null | undefined;

export class CatalogUnavailableError extends Error {}

export function catalogConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

async function rest<T>(path: string, params: Record<string, string>): Promise<T> {
  if (!catalogConfigured()) throw new CatalogUnavailableError("catalog_unconfigured");
  const url = `${SUPABASE_URL}/rest/v1/${path}?${new URLSearchParams(params)}`;
  const response = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, accept: "application/json" },
    cf: { cacheTtl: EDGE_CACHE_SECONDS, cacheEverything: true },
  } as RequestInit);
  if (!response.ok) throw new CatalogUnavailableError(`catalog_${path}_${response.status}`);
  return response.json() as Promise<T>;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function asLocale(value: unknown): SiteLocale | null {
  if (typeof value !== "string") return null;
  const tag = value.trim().toLowerCase().replaceAll("_", "-");
  if (["zh-tw", "zh-hk", "zh-mo", "zh-hant"].includes(tag)) return "zh-TW";
  if (tag.startsWith("zh")) return "zh-CN";
  return SITE_LOCALES.find((locale) => locale.toLowerCase() === tag.split("-")[0]) ?? null;
}

/** Locales an entity's content exists in (primary first), as the app decides it. */
export function contentLocales(config: EntityI18n): SiteLocale[] {
  const primary = asLocale(config?.primary_content_locale) ?? CATALOG_DEFAULT_CONTENT_LOCALE;
  const supported = Array.isArray(config?.supported_locales)
    ? config.supported_locales.map(asLocale).filter((l): l is SiteLocale => Boolean(l))
    : [];
  return [...new Set([primary, ...supported])];
}

/** Content locale to show for a UI locale: the same one if translated, else the primary. */
export function pickContentLocale(config: EntityI18n, uiLocale: SiteLocale): SiteLocale {
  const available = contentLocales(config);
  return available.includes(uiLocale) ? uiLocale : available[0];
}

// ─── Courses ────────────────────────────────────────────────────────────────

export type CatalogCourse = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  thumbnailUrl: string;
  level: string;
  durationSeconds: number;
  instructorName: string;
  learningOutcomes: string[];
  skills: string[];
  updatedAt: string;
  /** Locale the text is in; differs from the page locale when no translation exists. */
  contentLocale: SiteLocale;
  locales: SiteLocale[];
};

type CourseRow = { id: string; slug: string; updated_at: string; data: Record<string, unknown> | null };
type LocaleRow = { data: Record<string, unknown> | null } & Record<string, unknown>;

function courseFromRow(row: CourseRow, uiLocale: SiteLocale, localized: Record<string, unknown> | null): CatalogCourse {
  const d = row.data ?? {};
  const l = localized ?? {};
  const config = d.i18n as EntityI18n;
  return {
    id: row.id,
    slug: row.slug,
    title: text(l.title) || text(d.title),
    shortDescription: text(l.short_description) || text(d.short_description),
    description: text(l.description) || text(d.description),
    thumbnailUrl: text(d.thumbnail_url),
    level: text(d.level),
    durationSeconds: Number(d.total_duration_seconds) || 0,
    instructorName: text(d.instructor_name),
    learningOutcomes: list(l.learning_outcomes).length ? list(l.learning_outcomes) : list(d.learning_outcomes),
    skills: list(d.skills),
    updatedAt: row.updated_at,
    contentLocale: pickContentLocale(config, uiLocale),
    locales: contentLocales(config),
  };
}

async function localizedRows(table: "course_locales" | "hackathon_locales", key: string, ids: string[], locale: SiteLocale) {
  if (!ids.length) return new Map<string, Record<string, unknown>>();
  const rows = await rest<LocaleRow[]>(table, {
    select: `${key},data`,
    [key]: `in.(${ids.join(",")})`,
    locale: `eq.${locale}`,
  });
  return new Map(rows.filter((row) => row.data).map((row) => [String(row[key]), row.data!]));
}

async function localizeCourses(rows: CourseRow[], uiLocale: SiteLocale): Promise<CatalogCourse[]> {
  const byLocale = new Map<SiteLocale, string[]>();
  for (const row of rows) {
    const locale = pickContentLocale((row.data ?? {}).i18n as EntityI18n, uiLocale);
    byLocale.set(locale, [...(byLocale.get(locale) ?? []), row.id]);
  }
  const maps = new Map(await Promise.all([...byLocale].map(async ([locale, ids]) =>
    [locale, await localizedRows("course_locales", "course_id", ids, locale)] as const)));
  return rows.map((row) => {
    const locale = pickContentLocale((row.data ?? {}).i18n as EntityI18n, uiLocale);
    return courseFromRow(row, uiLocale, maps.get(locale)?.get(row.id) ?? null);
  });
}

export async function listCourses(uiLocale: SiteLocale): Promise<CatalogCourse[]> {
  const rows = await rest<CourseRow[]>("courses", {
    select: "id,slug,updated_at,data",
    published: "eq.true",
    archived_at: "is.null",
    order: "updated_at.desc",
  });
  return localizeCourses(rows.filter((row) => row.slug), uiLocale);
}

export async function getCourse(slug: string, uiLocale: SiteLocale): Promise<CatalogCourse | null> {
  const rows = await rest<CourseRow[]>("courses", {
    select: "id,slug,updated_at,data",
    slug: `eq.${slug}`,
    published: "eq.true",
    archived_at: "is.null",
    limit: "1",
  });
  if (!rows[0]) return null;
  return (await localizeCourses(rows, uiLocale))[0];
}

// ─── Hackathons ─────────────────────────────────────────────────────────────

export const PUBLIC_HACKATHON_STATUSES = ["published", "running", "ended"] as const;

export type CatalogHackathon = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  mode: string;
  hostName: string;
  imageUrl: string;
  prizeSummary: string;
  participants: number;
  updatedAt: string;
  contentLocale: SiteLocale;
  locales: SiteLocale[];
};

type HackathonRow = {
  id: string; status: string; participants_count: number | null; updated_at: string;
  document: Record<string, unknown> | null;
};

function hackathonFromRow(row: HackathonRow, uiLocale: SiteLocale, localized: Record<string, unknown> | null): CatalogHackathon {
  const d = row.document ?? {};
  const l = localized ?? {};
  const config = d.i18n as EntityI18n;
  const host = (d.host ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    slug: text(d.slug) || row.id,
    title: text(l.title) || text(d.title),
    tagline: text(l.short_description) || text(l.tagline) || text(d.short_description) || text(d.tagline),
    description: text(l.description_markdown) || text(l.description) || text(d.description_markdown) || text(d.description),
    status: row.status,
    startsAt: text(d.starts_at) || null,
    endsAt: text(d.ends_at) || null,
    mode: text(d.mode) || text(d.location),
    hostName: text(host.name),
    imageUrl: text(d.cover_image_url) || text(d.thumbnail_url),
    prizeSummary: text(l.prize_pool_summary) || text(d.prize_pool_summary),
    participants: row.participants_count ?? 0,
    updatedAt: row.updated_at,
    contentLocale: pickContentLocale(config, uiLocale),
    locales: contentLocales(config),
  };
}

async function localizeHackathons(rows: HackathonRow[], uiLocale: SiteLocale): Promise<CatalogHackathon[]> {
  const byLocale = new Map<SiteLocale, string[]>();
  for (const row of rows) {
    const locale = pickContentLocale((row.document ?? {}).i18n as EntityI18n, uiLocale);
    byLocale.set(locale, [...(byLocale.get(locale) ?? []), row.id]);
  }
  const maps = new Map(await Promise.all([...byLocale].map(async ([locale, ids]) =>
    [locale, await localizedRows("hackathon_locales", "hackathon_id", ids, locale)] as const)));
  return rows.map((row) => {
    const locale = pickContentLocale((row.document ?? {}).i18n as EntityI18n, uiLocale);
    return hackathonFromRow(row, uiLocale, maps.get(locale)?.get(row.id) ?? null);
  });
}

const HACKATHON_SELECT = "id,status,participants_count,updated_at,document";

export async function listHackathons(uiLocale: SiteLocale): Promise<CatalogHackathon[]> {
  const rows = await rest<HackathonRow[]>("hackathons", {
    select: HACKATHON_SELECT,
    status: `in.(${PUBLIC_HACKATHON_STATUSES.join(",")})`,
    order: "updated_at.desc",
  });
  return localizeHackathons(rows, uiLocale);
}

export async function getHackathon(slug: string, uiLocale: SiteLocale): Promise<CatalogHackathon | null> {
  const rows = await rest<HackathonRow[]>("hackathons", {
    select: HACKATHON_SELECT,
    "document->>slug": `eq.${slug}`,
    status: `in.(${PUBLIC_HACKATHON_STATUSES.join(",")})`,
    limit: "1",
  });
  if (!rows[0]) return null;
  return (await localizeHackathons(rows, uiLocale))[0];
}

// ─── Jobs ───────────────────────────────────────────────────────────────────

export type CatalogJob = {
  id: string;
  slug: string;
  title: string;
  companyName: string;
  companyLogoUrl: string;
  summary: string;
  description: string;
  employmentType: string;
  remoteType: string;
  locationText: string;
  countryCodes: string[];
  regions: string[];
  seniority: string;
  skills: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: string;
  postedAt: string | null;
  expiresAt: string | null;
  applyUrl: string;
  updatedAt: string;
  /** The source allows search engines to index its postings. */
  indexable: boolean;
};

const JOB_SELECT = [
  "id,slug,title,company_name,company_logo_url,summary,description_plain,employment_type,remote_type",
  "location_text,country_codes,regions,seniority,required_skills,salary_min,salary_max,salary_currency",
  "salary_period,posted_at,first_seen_at,expires_at,apply_url,source_url,updated_at",
  "job_sources!inner(enabled,policy_reviewed_at,allow_seo_indexing),job_companies!inner(active,verified)",
].join(",");

function publicJobFilters(): Record<string, string> {
  return {
    status: "eq.active",
    or: `(expires_at.is.null,expires_at.gt.${new Date().toISOString()})`,
    "job_sources.enabled": "eq.true",
    "job_sources.policy_reviewed_at": "not.is.null",
    "job_companies.active": "eq.true",
    "job_companies.verified": "eq.true",
  };
}

type JobRow = Record<string, unknown> & { job_sources?: { allow_seo_indexing?: boolean } | null };

function jobFromRow(row: JobRow): CatalogJob {
  const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  return {
    id: text(row.id),
    slug: text(row.slug),
    title: text(row.title),
    companyName: text(row.company_name),
    companyLogoUrl: text(row.company_logo_url),
    summary: text(row.summary),
    description: text(row.description_plain) || text(row.summary),
    employmentType: text(row.employment_type),
    remoteType: text(row.remote_type),
    locationText: text(row.location_text),
    countryCodes: list(row.country_codes),
    regions: list(row.regions),
    seniority: text(row.seniority),
    skills: list(row.required_skills),
    salaryMin: number(row.salary_min),
    salaryMax: number(row.salary_max),
    salaryCurrency: text(row.salary_currency),
    salaryPeriod: text(row.salary_period),
    postedAt: text(row.posted_at) || text(row.first_seen_at) || null,
    expiresAt: text(row.expires_at) || null,
    applyUrl: text(row.apply_url) || text(row.source_url),
    updatedAt: text(row.updated_at),
    indexable: row.job_sources?.allow_seo_indexing === true,
  };
}

export async function listJobs(limit = 60): Promise<CatalogJob[]> {
  const rows = await rest<JobRow[]>("jobs", {
    select: JOB_SELECT,
    ...publicJobFilters(),
    order: "posted_at.desc.nullslast,id.asc",
    limit: String(limit),
  });
  return rows.map(jobFromRow).filter((job) => job.slug);
}

export async function getJob(slug: string): Promise<CatalogJob | null> {
  const rows = await rest<JobRow[]>("jobs", { select: JOB_SELECT, slug: `eq.${slug}`, ...publicJobFilters(), limit: "1" });
  return rows[0] ? jobFromRow(rows[0]) : null;
}

/** Indexable job slugs for the sitemap (sources that allow SEO indexing). */
export async function listIndexableJobs(): Promise<Array<{ slug: string; updatedAt: string }>> {
  const rows = await rest<JobRow[]>("jobs", {
    select: `slug,updated_at,job_sources!inner(enabled,policy_reviewed_at,allow_seo_indexing),job_companies!inner(active,verified)`,
    ...publicJobFilters(),
    "job_sources.allow_seo_indexing": "eq.true",
    order: "updated_at.desc",
    limit: "5000",
  });
  return rows.map((row) => ({ slug: text(row.slug), updatedAt: text(row.updated_at) })).filter((row) => row.slug);
}

import { DEFAULT_SITE_LOCALE, SITE_LOCALES, SITE_LOCALE_META, type SiteLocale } from "@corelia/ui/locales";

/**
 * Locale from the optional leading path segment of a catalog route (`/[...locale]/courses`).
 * `undefined` is English; "en" itself is not a valid prefix (it redirects to the root).
 */
export function routeLocale(segment: string | undefined): SiteLocale | null {
  if (!segment) return DEFAULT_SITE_LOCALE;
  const lower = segment.toLowerCase();
  return SITE_LOCALES.find((locale) => SITE_LOCALE_META[locale].slug === lower && lower !== "") ?? null;
}

/** Slugs come from the database; anything else is a 404 without a database round trip. */
export function validSlug(value: string | undefined): value is string {
  return typeof value === "string" && value.length <= 200 && /^[\p{L}\p{N}][\p{L}\p{N}._~-]*$/u.test(value);
}

/** Edge/browser caching for server-rendered catalog pages; upstream reads are cached for 5 minutes too. */
export function setCatalogCacheHeaders(headers: Headers, status = 200): void {
  headers.set(
    "Cache-Control",
    status === 200 ? "public, max-age=300, s-maxage=600, stale-while-revalidate=86400" : "no-store",
  );
}

type AssetsBinding = { fetch(input: Request | URL | string): Promise<Response> };

/**
 * The prerendered 404 page with a 404 status. (Astro cannot rewrite a server route to a
 * prerendered page, so it is read from the static assets binding.)
 */
export async function catalogNotFound(request: Request, locals: unknown): Promise<Response> {
  const assets = (locals as { runtime?: { env?: { ASSETS?: AssetsBinding } } }).runtime?.env?.ASSETS;
  const page = assets ? await assets.fetch(new URL("/404", request.url)).catch(() => null) : null;
  return new Response(page?.ok ? page.body : "Not Found", {
    status: 404,
    headers: { "Content-Type": page?.ok ? "text/html; charset=utf-8" : "text/plain; charset=utf-8", "Cache-Control": "public, max-age=60" },
  });
}

/** Upstream failure: a short, uncached 503 so crawlers retry instead of indexing an error page. */
export function catalogUnavailable(message: string): Response {
  return new Response(message, {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "60" },
  });
}

export function formatDate(value: string | null, locale: SiteLocale): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(SITE_LOCALE_META[locale].hreflang, { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" }).format(date);
}

export function formatSalary(
  job: { salaryMin: number | null; salaryMax: number | null; salaryCurrency: string },
  locale: SiteLocale,
): string {
  if (!job.salaryCurrency || (job.salaryMin == null && job.salaryMax == null)) return "";
  const format = (value: number) => {
    try {
      return new Intl.NumberFormat(SITE_LOCALE_META[locale].hreflang, {
        style: "currency", currency: job.salaryCurrency, maximumFractionDigits: 0,
      }).format(value);
    } catch {
      // Unknown currency code in the source data.
      return `${value.toLocaleString(SITE_LOCALE_META[locale].hreflang)} ${job.salaryCurrency}`;
    }
  };
  if (job.salaryMin != null && job.salaryMax != null) return `${format(job.salaryMin)} – ${format(job.salaryMax)}`;
  return format((job.salaryMin ?? job.salaryMax)!);
}

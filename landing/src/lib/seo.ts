import { DEFAULT_SITE_LOCALE, SITE_LOCALE_META, localizePath, type SiteLocale } from "@corelia/ui/locales";

export const SITE_ORIGIN = String(import.meta.env.PUBLIC_SITE_URL ?? "https://corelia.academy").replace(/\/+$/, "");
export const APP_URL = String(import.meta.env.PUBLIC_APP_URL ?? "/learn").replace(/\/+$/, "");
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/corelia-og-site-v2-en.png`;

export function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * The app's branded 1200×630 share card. The revision-less URL redirects to the current
 * revision, so it stays valid while this page's HTML sits in a cache.
 */
export function ogCardUrl(entity: "course" | "hackathon", slug: string): string {
  const path = `${APP_URL}/api/og/${entity}/${encodeURIComponent(slug)}`;
  return /^https?:\/\//.test(path) ? path : absoluteUrl(path);
}

export type Alternate ={ hreflang: string; href: string };

/** hreflang links for a page that exists in `locales`, plus x-default (English, or the first locale). */
export function alternates(path: string, locales: readonly SiteLocale[]): Alternate[] {
  const links = locales.map((locale) => ({ hreflang: SITE_LOCALE_META[locale].hreflang, href: absoluteUrl(localizePath(path, locale)) }));
  const fallback = locales.includes(DEFAULT_SITE_LOCALE) ? DEFAULT_SITE_LOCALE : locales[0];
  return fallback ? [...links, { hreflang: "x-default", href: absoluteUrl(localizePath(path, fallback)) }] : links;
}

/** JSON for a `<script type="application/ld+json">`, safe to inline in HTML. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function truncate(value: string, max = 160): string {
  const clean = value.replace(/[#*_`>\[\]]/g, "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Plain paragraphs from Markdown-ish text, for server-rendered descriptions. */
export function paragraphs(value: string): string[] {
  return value
    .split(/\n{2,}/)
    .map((block) => block.replace(/^#+\s*/gm, "").replace(/[*_`]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim())
    .filter(Boolean);
}

const ORGANIZATION = {
  "@type": "Organization",
  name: "Corelia Academy",
  url: SITE_ORIGIN,
  logo: `${SITE_ORIGIN}/corelia_favicon.svg`,
};

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function courseJsonLd(course: {
  title: string; description: string; url: string; image?: string; inLanguage: SiteLocale;
  skills: string[]; durationSeconds: number; instructorName: string;
}) {
  const hours = Math.round(course.durationSeconds / 3600);
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.description,
    url: course.url,
    inLanguage: SITE_LOCALE_META[course.inLanguage].hreflang,
    provider: ORGANIZATION,
    ...(course.image ? { image: course.image } : {}),
    ...(course.skills.length ? { teaches: course.skills } : {}),
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "Online",
      ...(hours > 0 ? { courseWorkload: `PT${hours}H` } : {}),
      ...(course.instructorName ? { instructor: { "@type": "Person", name: course.instructorName } } : {}),
    },
  };
}

export function hackathonJsonLd(event: {
  title: string; description: string; url: string; image?: string; startsAt: string | null; endsAt: string | null;
  mode: string; hostName: string; inLanguage: SiteLocale;
}) {
  const online = event.mode === "online";
  const mixed = event.mode === "hybrid";
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description,
    url: event.url,
    inLanguage: SITE_LOCALE_META[event.inLanguage].hreflang,
    ...(event.startsAt ? { startDate: event.startsAt } : {}),
    ...(event.endsAt ? { endDate: event.endsAt } : {}),
    ...(event.image ? { image: event.image } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: online
      ? "https://schema.org/OnlineEventAttendanceMode"
      : mixed ? "https://schema.org/MixedEventAttendanceMode" : "https://schema.org/OfflineEventAttendanceMode",
    location: online || mixed ? { "@type": "VirtualLocation", url: event.url } : { "@type": "Place", name: event.hostName || "Corelia Academy" },
    organizer: event.hostName ? { "@type": "Organization", name: event.hostName } : ORGANIZATION,
  };
}

export function jobPostingJsonLd(job: {
  title: string; description: string; url: string; postedAt: string | null; expiresAt: string | null;
  employmentType: string; companyName: string; companyLogoUrl: string; remoteType: string; locationText: string;
  countryCodes: string[]; regions: string[];
  salaryMin: number | null; salaryMax: number | null; salaryCurrency: string; salaryPeriod: string;
}) {
  // Same shape as the app's JobDetailPage structured data.
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    ...(job.postedAt ? { datePosted: job.postedAt } : {}),
    ...(job.expiresAt ? { validThrough: job.expiresAt } : {}),
    ...(job.employmentType ? { employmentType: job.employmentType.toUpperCase() } : {}),
    hiringOrganization: { "@type": "Organization", name: job.companyName, ...(job.companyLogoUrl ? { logo: job.companyLogoUrl } : {}) },
    ...(job.remoteType === "remote" ? { jobLocationType: "TELECOMMUTE" } : {}),
    ...(job.remoteType !== "remote" && job.locationText ? {
      jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: job.locationText } },
    } : {}),
    ...(job.countryCodes.length || job.regions.length ? {
      applicantLocationRequirements: [
        ...job.countryCodes.map((name) => ({ "@type": "Country", name })),
        ...job.regions.map((name) => ({ "@type": "AdministrativeArea", name })),
      ],
    } : {}),
    ...(job.salaryCurrency && (job.salaryMin != null || job.salaryMax != null) ? {
      baseSalary: {
        "@type": "MonetaryAmount",
        currency: job.salaryCurrency,
        value: {
          "@type": "QuantitativeValue",
          ...(job.salaryMin != null ? { minValue: job.salaryMin } : {}),
          ...(job.salaryMax != null ? { maxValue: job.salaryMax } : {}),
          unitText: (job.salaryPeriod || "year").toUpperCase(),
        },
      },
    } : {}),
    url: job.url,
  };
}

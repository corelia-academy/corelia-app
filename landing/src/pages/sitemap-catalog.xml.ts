import type { APIRoute } from "astro";
import { SITE_LOCALES, localizePath, type SiteLocale } from "@corelia/ui/locales";
import { listCourses, listHackathons, listIndexableJobs } from "@/lib/catalog";
import { alternates, absoluteUrl } from "@/lib/seo";

export const prerender = false;

type Entry = { path: string; locales: readonly SiteLocale[]; lastmod?: string };

const xmlEscape = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** One <url> per indexable locale version, each listing its hreflang siblings. */
function render(entries: Entry[]): string {
  const urls = entries.flatMap(({ path, locales, lastmod }) => {
    const links = alternates(path, locales)
      .map((link) => `    <xhtml:link rel="alternate" hreflang="${link.hreflang}" href="${xmlEscape(link.href)}"/>`)
      .join("\n");
    return locales.map((locale) => [
      "  <url>",
      `    <loc>${xmlEscape(absoluteUrl(localizePath(path, locale)))}</loc>`,
      lastmod ? `    <lastmod>${new Date(lastmod).toISOString()}</lastmod>` : null,
      locales.length > 1 ? links : null,
      "  </url>",
    ].filter(Boolean).join("\n"));
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`;
}

export const GET: APIRoute = async () => {
  try {
    // Catalog content is listed in the locales it is actually written in (see the detail pages).
    const [courses, hackathons, jobs] = await Promise.all([listCourses("en"), listHackathons("en"), listIndexableJobs()]);
    const entries: Entry[] = [
      { path: "/courses", locales: SITE_LOCALES },
      { path: "/hackathons", locales: SITE_LOCALES },
      { path: "/jobs", locales: ["en"] },
      ...courses.map((course) => ({ path: `/courses/${course.slug}`, locales: course.locales, lastmod: course.updatedAt })),
      ...hackathons.map((event) => ({ path: `/hackathons/${event.slug}`, locales: event.locales, lastmod: event.updatedAt })),
      ...jobs.map((job) => ({ path: `/jobs/${job.slug}`, locales: ["en"] as const, lastmod: job.updatedAt })),
    ];
    return new Response(render(entries), {
      headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    });
  } catch (error) {
    console.error("[sitemap] catalog", error instanceof Error ? error.message : error);
    return new Response("Sitemap temporarily unavailable", { status: 503, headers: { "Retry-After": "300", "Cache-Control": "no-store" } });
  }
};

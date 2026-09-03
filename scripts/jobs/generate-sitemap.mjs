import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnv } from "vite";

const DEFAULT_ORIGIN = "https://app.corelia.academy";

function xmlEscape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function renderJobUrls(origin, jobs) {
  return jobs.map((job) => [
    "  <url>",
    `    <loc>${xmlEscape(`${origin}/jobs/${encodeURIComponent(job.slug)}`)}</loc>`,
    job.updated_at ? `    <lastmod>${xmlEscape(new Date(job.updated_at).toISOString())}</lastmod>` : null,
    "    <changefreq>daily</changefreq>",
    "    <priority>0.7</priority>",
    "  </url>",
  ].filter(Boolean).join("\n")).join("\n");
}

export function mergeJobUrls(baseXml, origin, jobs) {
  const normalizedOrigin = origin.replace(/\/$/, "");
  let xml = baseXml.replaceAll(DEFAULT_ORIGIN, normalizedOrigin);
  const existing = new Set(Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1]));
  const uniqueJobs = Array.from(new Map(
    jobs
      .filter((job) => typeof job.slug === "string" && job.slug.trim())
      .map((job) => [job.slug.trim(), job]),
  ).values()).filter((job) => !existing.has(`${normalizedOrigin}/jobs/${encodeURIComponent(job.slug)}`));
  if (!uniqueJobs.length) return xml;
  const entries = renderJobUrls(normalizedOrigin, uniqueJobs);
  return xml.replace("</urlset>", `${entries}\n</urlset>`);
}

export function rewriteDeploymentOrigin(content, origin) {
  return content.replaceAll(DEFAULT_ORIGIN, origin.replace(/\/$/, ""));
}

async function fetchIndexableJobs(supabaseUrl, publicKey) {
  const jobs = [];
  const pageSize = 1_000;
  for (let offset = 0; offset < 100_000; offset += pageSize) {
    const params = new URLSearchParams({
      select: "slug,updated_at,job_sources!inner(allow_seo_indexing)",
      status: "eq.active",
      "job_sources.allow_seo_indexing": "eq.true",
      order: "updated_at.desc",
      limit: String(pageSize),
      offset: String(offset),
    });
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/jobs?${params}`, {
      headers: { apikey: publicKey, authorization: `Bearer ${publicKey}` },
    });
    if (!response.ok) throw new Error(`jobs_sitemap_fetch_failed:${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error("jobs_sitemap_invalid_response");
    jobs.push(...rows);
    if (rows.length < pageSize) return jobs;
  }
  throw new Error("jobs_sitemap_limit_exceeded");
}

function configured(value) {
  return Boolean(value && !/[<>]/.test(value));
}

export async function generateSitemap({ cwd = process.cwd(), mode = "production" } = {}) {
  const env = loadEnv(mode, cwd, "");
  const origin = (process.env.VITE_PUBLIC_APP_URL || env.VITE_PUBLIC_APP_URL ||
    (mode === "staging" ? "https://staging.corelia.academy" : DEFAULT_ORIGIN)).replace(/\/$/, "");
  const supabaseUrl = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || "";
  const publicKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "";
  const distPath = resolve(cwd, "dist/sitemap.xml");
  const robotsPath = resolve(cwd, "dist/robots.txt");
  const [baseXml, baseRobots] = await Promise.all([
    readFile(distPath, "utf8"),
    readFile(robotsPath, "utf8"),
  ]);
  const jobs = configured(supabaseUrl) && configured(publicKey)
    ? await fetchIndexableJobs(supabaseUrl, publicKey)
    : [];
  await Promise.all([
    writeFile(distPath, mergeJobUrls(baseXml, origin, jobs)),
    writeFile(robotsPath, rewriteDeploymentOrigin(baseRobots, origin)),
  ]);
  return { origin, dynamicJobs: jobs.length };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const modeIndex = process.argv.indexOf("--mode");
  const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : "production";
  const result = await generateSitemap({ mode });
  console.log(`[jobs:sitemap] ${result.dynamicJobs} indexable job URLs written for ${result.origin}`);
}

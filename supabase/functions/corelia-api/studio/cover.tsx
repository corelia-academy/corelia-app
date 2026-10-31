// Generates cover PNG images for AI-generated Studio courses when publishing.
// If a course mentions known technology brands (e.g. Stellar, Solana, Rust),
// vector logos are retrieved from Iconify (simple-icons, devicon, logos, token-branded).
// If no logo is found, renders a crisp typographic cover with the path or course title.
// Dimensions: 1200x675 (16:9). Safe margins and white paper and ink strokes like the lesson diagrams.

import { initWasm, Resvg } from "npm:@resvg/resvg-wasm@2.6.2";
import type { SupabaseClient } from "../lib/supabase.ts";
import { textWidth } from "./diagram.ts";

export const ICONIFY_HOST = "api.iconify.design";
export const ALLOWED_COLLECTIONS = new Set(["simple-icons", "devicon", "logos", "token-branded"]);
const COLLECTION_PREFERENCE = ["simple-icons", "devicon", "logos", "token-branded"];

/** Candidates that produce misleading, generic, or unrelated cryptocurrency token icons on Iconify. */
export const DISALLOWED_CANDIDATES = new Set(["anchor", "prompt", "move", "base", "edu"]);

export interface PathItem {
  title: string;
  learning_order?: number;
}

export type CoverPlan =
  | { kind: "logo"; logos: Array<{ name: string; svg: string }> }
  | { kind: "text"; text: string };

/** Normalizes a path title to lowercase alphanumeric characters. */
export function normalizePathCandidate(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^a-z0-9]/g, "");
}

/** Checks whether a path's title appears verbatim (as an intact word or phrase) in the course title. */
export function pathAppearsInTitle(pathTitle: string, title: string): { appears: boolean; index: number } {
  const trimmed = pathTitle.trim();
  if (!trimmed) return { appears: false, index: -1 };
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu");
  const match = regex.exec(title);
  if (match) {
    const index = match.index + match[1].length;
    return { appears: true, index };
  }
  return { appears: false, index: -1 };
}

/** Queries Iconify search API for an icon candidate strictly matching allowed collections and rules. */
export async function queryIconify(
  candidate: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ prefix: string; name: string } | null> {
  const norm = normalizePathCandidate(candidate);
  if (!norm || norm.length < 2 || DISALLOWED_CANDIDATES.has(norm)) return null;

  const url = `https://${ICONIFY_HOST}/search?query=${encodeURIComponent(norm)}&prefixes=${Array.from(ALLOWED_COLLECTIONS).join(",")}`;
  const res = await fetchFn(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(3000),
  });

  if (res.status !== 200) return null;
  const data = (await res.json().catch(() => null)) as { icons?: string[] } | null;
  if (!data?.icons || !Array.isArray(data.icons)) return null;

  const matches: Array<{ prefix: string; name: string }> = [];
  for (const item of data.icons) {
    const idx = item.indexOf(":");
    if (idx <= 0) continue;
    const prefix = item.slice(0, idx);
    const name = item.slice(idx + 1);
    if (!ALLOWED_COLLECTIONS.has(prefix)) continue;

    if (prefix === "token-branded") {
      // Must be exact match or candidate + identifier suffix (e.g. arbitrum-one for arbitrum).
      // Disallow background icons.
      if (name === norm) {
        matches.push({ prefix, name });
      } else if (name.startsWith(`${norm}-`) && !name.endsWith("-background")) {
        matches.push({ prefix, name });
      }
    } else {
      // simple-icons, devicon, logos: exact match on normalized candidate name only
      if (name === norm) {
        matches.push({ prefix, name });
      }
    }
  }

  if (matches.length === 0) return null;

  // Pick by preference: simple-icons > devicon > logos > token-branded
  for (const pref of COLLECTION_PREFERENCE) {
    const found = matches.find((m) => m.prefix === pref);
    if (found) return found;
  }
  return matches[0];
}

/** Fetches vector SVG content from Iconify. Enforces timeout, max size (100KB), and SVG validity. */
export async function fetchIconSvg(
  prefix: string,
  name: string,
  fetchFn: typeof fetch = fetch,
): Promise<string | null> {
  const url = `https://${ICONIFY_HOST}/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`;
  const res = await fetchFn(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(3000),
  });

  if (res.status !== 200) return null;
  const cl = res.headers.get("content-length");
  if (cl && parseInt(cl, 10) > 100 * 1024) return null;

  const text = await res.text();
  if (text.length > 100 * 1024) return null;
  if (!text.includes("<svg") || !text.includes("</svg>")) return null;

  return text;
}

/** Prepares SVG for the white cover: currentColor and unfilled icons are drawn in ink. */
export function prepareSvgForCover(svgText: string): string {
  let s = svgText;
  s = s.replace(/currentColor/gi, "#1e1e1e");
  if (!/<svg[^>]*\sfill=/i.test(s)) {
    s = s.replace(/<svg\b/i, '<svg fill="#1e1e1e"');
  }
  return s;
}

export function svgToDataUri(svg: string): string {
  const b64 = typeof Buffer !== "undefined"
    ? Buffer.from(svg).toString("base64")
    : btoa(svg);
  return `data:image/svg+xml;base64,${b64}`;
}

/** Resolves whether the course cover should be 1 logo, 2 logos, or text fallback. */
export async function resolveCoverPlan(
  title: string,
  paths: PathItem[] = [],
  fetchFn: typeof fetch = fetch,
): Promise<CoverPlan> {
  // 1. Resolve logo for each unique path candidate
  const pathLogos = new Map<string, { candidate: string; svg: string }>();

  for (const p of paths) {
    const cand = normalizePathCandidate(p.title);
    if (!cand || cand.length < 2 || pathLogos.has(cand)) continue;
    try {
      const match = await queryIconify(cand, fetchFn);
      if (match) {
        const svg = await fetchIconSvg(match.prefix, match.name, fetchFn);
        if (svg) {
          pathLogos.set(cand, { candidate: cand, svg });
        }
      }
    } catch {
      // Ignore network / lookup errors
    }
  }

  // 2. Identify paths with logos that appear verbatim in the course title
  const titlePathsWithLogo: Array<{ path: PathItem; index: number; logo: { candidate: string; svg: string } }> = [];
  for (const p of paths) {
    const cand = normalizePathCandidate(p.title);
    const logo = pathLogos.get(cand);
    if (!logo) continue;

    const { appears, index } = pathAppearsInTitle(p.title, title);
    if (appears) {
      titlePathsWithLogo.push({ path: p, index, logo });
    }
  }

  // Sort by earliest appearance in course title
  titlePathsWithLogo.sort((a, b) => a.index - b.index);

  // If two or more paths with logo appear in the title: show up to two side-by-side
  if (titlePathsWithLogo.length >= 2) {
    return {
      kind: "logo",
      logos: [
        { name: titlePathsWithLogo[0].logo.candidate, svg: titlePathsWithLogo[0].logo.svg },
        { name: titlePathsWithLogo[1].logo.candidate, svg: titlePathsWithLogo[1].logo.svg },
      ],
    };
  }

  // If exactly one path with logo appears in the title: show it
  if (titlePathsWithLogo.length === 1) {
    return {
      kind: "logo",
      logos: [
        { name: titlePathsWithLogo[0].logo.candidate, svg: titlePathsWithLogo[0].logo.svg },
      ],
    };
  }

  // 3. If no path with logo appears in the title: pick the path with lowest learning_order that has a logo
  const sortedPaths = [...paths].sort((a, b) => (a.learning_order ?? 0) - (b.learning_order ?? 0));
  for (const p of sortedPaths) {
    const cand = normalizePathCandidate(p.title);
    const logo = pathLogos.get(cand);
    if (logo) {
      return {
        kind: "logo",
        logos: [{ name: logo.candidate, svg: logo.svg }],
      };
    }
  }

  // 4. No logo found: text fallback
  const fallbackText = sortedPaths.length > 0 && sortedPaths[0].title.trim()
    ? sortedPaths[0].title.trim()
    : title.trim();

  return {
    kind: "text",
    text: fallbackText,
  };
}

// ---- Asset loading for Satori & Resvg ---------------------------------------------------------

async function readAsset(url: URL): Promise<Uint8Array> {
  if (typeof Deno !== "undefined" && typeof Deno.readFile === "function") return Deno.readFile(url);
  const { readFile } = await import("node:fs/promises");
  return readFile(url);
}

const INK = "#1e1e1e";
const WIDTH = 1200;
const HEIGHT = 675;

let assetsPromise: Promise<{ rough: any; font: Uint8Array }> | null = null; // deno-lint-ignore no-explicit-any

/** roughjs, the Patrick Hand font (same as the lesson diagrams) and the resvg wasm, loaded once. */
function loadAssets(): Promise<{ rough: any; font: Uint8Array }> { // deno-lint-ignore no-explicit-any
  assetsPromise ??= (async () => {
    const [{ default: rough }, wasm, font] = await Promise.all([
      import("npm:roughjs@4.6.6/bundled/rough.esm.js"),
      readAsset(new URL("../og/assets/resvg.wasm", import.meta.url)),
      readAsset(new URL("./assets/PatrickHand-Regular.ttf", import.meta.url)),
    ]);
    try {
      await initWasm(wasm);
    } catch (e) {
      // og/ initializes the same module in the same isolate.
      if (!/already/i.test(e instanceof Error ? e.message : String(e))) throw e;
    }
    return { rough, font };
  })();
  assetsPromise.catch(() => (assetsPromise = null));
  return assetsPromise;
}

function computeFontSize(text: string): number {
  if (text.length <= 15) return 112;
  if (text.length <= 30) return 92;
  if (text.length <= 50) return 72;
  if (text.length <= 80) return 58;
  return 46;
}

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Greedy word wrap using the diagram font metrics; a word longer than the line stays on its own line. */
function wrapText(text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Renders a 1200x675 hand-drawn cover PNG (white paper, ink strokes, Patrick Hand) from the plan. */
export async function renderCoverPng(plan: CoverPlan): Promise<Uint8Array> {
  const { rough, font } = await loadAssets();
  const gen = rough.generator();
  const opts = { roughness: 1.3, bowing: 0.9, stroke: INK, strokeWidth: 3, seed: 11, preserveVertices: true };
  // deno-lint-ignore no-explicit-any
  const strokes = (drawable: any) =>
    gen.toPaths(drawable).map((p: { d: string; strokeWidth: number }) =>
      `<path d="${p.d}" stroke="${INK}" stroke-width="${p.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    ).join("");

  let body = strokes(gen.rectangle(40, 40, WIDTH - 80, HEIGHT - 80, opts));
  body += strokes(gen.rectangle(56, 54, WIDTH - 112, HEIGHT - 108, { ...opts, seed: 23, roughness: 1.8, strokeWidth: 2 }));

  if (plan.kind === "logo" && plan.logos.length > 0) {
    const size = plan.logos.length >= 2 ? 240 : 300;
    const gap = 96;
    const total = plan.logos.length * size + (plan.logos.length - 1) * gap;
    const x0 = (WIDTH - total) / 2;
    const y0 = (HEIGHT - size) / 2 - 20;
    plan.logos.forEach((logo, i) => {
      const x = x0 + i * (size + gap);
      body += `<image href="${svgToDataUri(prepareSvgForCover(logo.svg))}" x="${x}" y="${y0}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`;
    });
    body += strokes(gen.line(x0, y0 + size + 44, x0 + total, y0 + size + 50, { ...opts, seed: 31 }));
  } else {
    const text = plan.kind === "text" ? plan.text : "";
    const size = computeFontSize(text);
    const lines = wrapText(text, size, 900).slice(0, 4);
    const lineHeight = size * 1.15;
    const top = HEIGHT / 2 - ((lines.length - 1) * lineHeight) / 2 - 10;
    lines.forEach((line, i) => {
      body += `<text x="${WIDTH / 2}" y="${top + i * lineHeight}" font-family="Patrick Hand" font-size="${size}" fill="${INK}" text-anchor="middle" dominant-baseline="middle">${escapeXml(line)}</text>`;
    });
    const widest = Math.max(...lines.map((l) => textWidth(l, size)), 0);
    const underlineY = top + (lines.length - 1) * lineHeight + size * 0.62;
    body += strokes(gen.line(WIDTH / 2 - widest / 2, underlineY, WIDTH / 2 + widest / 2, underlineY + 5, { ...opts, seed: 37 }));
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff"/>${body}</svg>`;
  const renderer = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: { fontBuffers: [font], defaultFontFamily: "Patrick Hand", loadSystemFonts: false },
  });
  try {
    return renderer.render().asPng();
  } finally {
    renderer.free();
  }
}

// ---- Storage and URL helpers -----------------------------------------------------------------

/** Course covers live in the public `cdn` bucket: the private `app` bucket has no public URLs. */
export const COVER_BUCKET = "cdn";

/** Storage path of the course cover inside COVER_BUCKET. */
export function appCoverPath(courseId: string): string {
  return `course-thumbnails/${courseId}/cover.png`;
}

/** Permanent public storage URL of the course cover. */
export function appCoverUrl(db: SupabaseClient, courseId: string): string {
  const { data } = db.storage.from(COVER_BUCKET).getPublicUrl(appCoverPath(courseId));
  return data.publicUrl;
}

/**
 * Returns true if thumbnail_url is empty or points to the system-generated cover.
 * Operator-provided images (different file name or external URL) return false.
 */
export function isSystemCover(thumbnailUrl: string | null | undefined, courseId: string): boolean {
  if (!thumbnailUrl || !thumbnailUrl.trim()) return true;
  return thumbnailUrl.includes(`course-thumbnails/${courseId}/cover.png`);
}

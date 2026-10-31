// Generates cover PNG images for AI-generated Studio courses when publishing.
// If a course mentions known technology brands (e.g. Stellar, Solana, Rust),
// vector logos are retrieved from Iconify (simple-icons, devicon, logos, token-branded).
// If no logo is found, renders a crisp typographic cover with the path or course title.
// Dimensions: 1200x675 (16:9). Safe margins and app brand palette (#0a0913).

import React from "npm:react@19.2.0";
import satori from "npm:satori@0.33.5";
import { initWasm, Resvg } from "npm:@resvg/resvg-wasm@2.6.2";
import type { SupabaseClient } from "../lib/supabase.ts";

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

/** Prepares SVG for dark-background rendering: ensures currentColor maps to white. */
export function prepareSvgForCover(svgText: string): string {
  let s = svgText;
  s = s.replace(/currentColor/gi, "#ffffff");
  if (!/<svg[^>]*\sfill=/i.test(s)) {
    s = s.replace(/<svg\b/i, '<svg fill="#ffffff"');
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

type FontConfig = Array<{ name: string; data: ArrayBuffer; weight: 400 | 500 | 700; style: "normal" }>;
let fontPromise: Promise<FontConfig> | null = null;
let wasmPromise: Promise<void> | null = null;

async function loadAssets(): Promise<{ fonts: FontConfig }> {
  const fontFiles = [
    ["akt-medium.ttf", "Akt", 500],
    ["tt-norms-pro-normal.ttf", "TT Norms Pro Trial", 400],
    ["tt-norms-pro-medium.ttf", "TT Norms Pro Trial", 500],
    ["latin-400.woff", "Be Vietnam Pro", 400],
    ["vietnamese-400.woff", "Be Vietnam Pro", 400],
    ["latin-700.woff", "Be Vietnam Pro", 700],
    ["vietnamese-700.woff", "Be Vietnam Pro", 700],
  ] as const;

  fontPromise ??= Promise.all(
    fontFiles.map(async ([filename, name, weight]) => ({
      name,
      data: Uint8Array.from(await readAsset(new URL(`../og/assets/${filename}`, import.meta.url))).buffer,
      weight,
      style: "normal" as const,
    })),
  );

  wasmPromise ??= (async () => {
    const wasm = await readAsset(new URL("../og/assets/resvg.wasm", import.meta.url));
    try {
      await initWasm(wasm);
    } catch (e) {
      if (!/already/i.test(e instanceof Error ? e.message : String(e))) throw e;
    }
  })();

  await wasmPromise;
  const fonts = await fontPromise;
  return { fonts };
}

function computeFontSize(text: string): number {
  if (text.length <= 15) return 72;
  if (text.length <= 30) return 60;
  if (text.length <= 50) return 48;
  if (text.length <= 80) return 40;
  return 34;
}

/** Renders a 1200x675 cover PNG from the plan. */
export async function renderCoverPng(plan: CoverPlan): Promise<Uint8Array> {
  const { fonts } = await loadAssets();

  let element: React.JSX.Element;
  if (plan.kind === "logo" && plan.logos.length >= 2) {
    element = (
      <div
        style={{
          display: "flex",
          position: "relative",
          width: 1200,
          height: 675,
          backgroundColor: "#0a0913",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 64,
        }}
      >
        <img
          src={svgToDataUri(prepareSvgForCover(plan.logos[0].svg))}
          width={220}
          height={220}
          style={{ width: 220, height: 220, objectFit: "contain" }}
          alt=""
        />
        <img
          src={svgToDataUri(prepareSvgForCover(plan.logos[1].svg))}
          width={220}
          height={220}
          style={{ width: 220, height: 220, objectFit: "contain" }}
          alt=""
        />
      </div>
    );
  } else if (plan.kind === "logo" && plan.logos.length === 1) {
    element = (
      <div
        style={{
          display: "flex",
          position: "relative",
          width: 1200,
          height: 675,
          backgroundColor: "#0a0913",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={svgToDataUri(prepareSvgForCover(plan.logos[0].svg))}
          width={280}
          height={280}
          style={{ width: 280, height: 280, objectFit: "contain" }}
          alt=""
        />
      </div>
    );
  } else {
    const text = plan.kind === "text" ? plan.text : "";
    const size = computeFontSize(text);
    element = (
      <div
        style={{
          display: "flex",
          position: "relative",
          width: 1200,
          height: 675,
          backgroundColor: "#0a0913",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#ffffff",
            fontFamily: "Akt, Be Vietnam Pro",
            fontSize: size,
            fontWeight: 500,
            lineHeight: 1.25,
            textAlign: "center",
            alignItems: "center",
            justifyContent: "center",
            maxWidth: 1040,
            maxHeight: 480,
            overflow: "hidden",
            wordBreak: "break-word",
          }}
        >
          {text}
        </div>
      </div>
    );
  }

  const svg = await satori(element, { width: 1200, height: 675, fonts });
  const renderer = new Resvg(svg, { fitTo: { mode: "original" } });
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

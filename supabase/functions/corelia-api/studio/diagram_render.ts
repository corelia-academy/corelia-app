// Renders a diagram spec (diagram.ts) to a hand-drawn PNG: roughjs makes the strokes, resvg-wasm
// (the package and resvg.wasm that og/ uses) rasterizes the SVG. Ported from
// docs/prototypes/diagram-render/diagram.ts in corelia-studio. Font: Patrick Hand (SIL OFL).

import { initWasm, Resvg } from "npm:@resvg/resvg-wasm@2.6.2";

import { border, edgeGeometry, edgeLabel, FONT_SIZE, LABEL_FONT_SIZE, layout, textWidth, type Diagram } from "./diagram.ts";

const INK = "#1e1e1e", PAD = 50;
/** PNG scale: the diagram is drawn at about 1300 px wide, so 2x stays sharp on retina screens. */
const ZOOM = 2;

async function readAsset(url: URL): Promise<Uint8Array> {
  if (typeof Deno !== "undefined" && typeof Deno.readFile === "function") return Deno.readFile(url);
  const { readFile } = await import("node:fs/promises");
  return readFile(url);
}

let ready: Promise<{ rough: any; font: Uint8Array }> | null = null;

function load() {
  ready ??= (async () => {
    // roughjs is imported here so that modules that only need the naming helpers do not load it.
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
  ready.catch(() => (ready = null));
  return ready;
}

export class FontLoadError extends Error {
  readonly kind: "configuration" | "missing" | "network";
  constructor(message: string, kind: "configuration" | "missing" | "network" = "missing") {
    super(message);
    this.name = "FontLoadError";
    this.kind = kind;
  }
}

export const CJK_FONT_FAMILIES: Record<string, string> = {
  "zh-CN": "Noto Sans SC",
  "zh-TW": "Noto Sans TC",
  "ko": "Noto Sans KR",
  "ja": "Noto Sans JP",
};

const fontRegistry = new Map<string, Uint8Array>();

export function registerFontBuffer(locale: string, buffer: Uint8Array): void {
  fontRegistry.set(locale, buffer);
}

export function clearFontRegistry(): void {
  fontRegistry.clear();
}

let customResolver: ((locale: string) => Promise<Uint8Array | null>) | null = null;

export function setFontResolver(fn: ((locale: string) => Promise<Uint8Array | null>) | null): void {
  customResolver = fn;
}

export function createStorageFontResolver(storageClient: any): (locale: string) => Promise<Uint8Array | null> {
  return async (locale: string): Promise<Uint8Array | null> => {
    const family = CJK_FONT_FAMILIES[locale];
    if (!family) return null;
    const fileName = `${family.replace(/ /g, "")}.ttf`;
    let res: any;
    try {
      res = await storageClient.from("studio-assets").download(`fonts/${fileName}`);
    } catch (e: any) {
      throw new FontLoadError(`[${locale}] Lỗi mạng khi kết nối Storage: ${e?.message || String(e)}`, "network");
    }

    if (res?.error) {
      const status = res.error.status || res.error.statusCode;
      const msg = res.error.message || String(res.error);
      if (status === 404 || /not found|not_found/i.test(msg)) {
        throw new FontLoadError(`[${locale}] Không tìm thấy font CJK ${fileName} trong bucket studio-assets: ${msg}`, "missing");
      }
      throw new FontLoadError(`[${locale}] Lỗi Storage khi tải font CJK ${fileName}: ${msg}`, "network");
    }

    if (res?.data) {
      const buf = await res.data.arrayBuffer();
      return new Uint8Array(buf);
    }

    throw new FontLoadError(`[${locale}] Không tìm thấy font CJK ${fileName} trong bucket studio-assets.`, "missing");
  };
}

async function resolveLocaleFont(locale: string, customFont?: Uint8Array): Promise<{ buffer: Uint8Array; family: string }> {
  const family = CJK_FONT_FAMILIES[locale];
  if (!family) {
    throw new FontLoadError(`[${locale}] Ngôn ngữ ${locale} không được hỗ trợ font CJK.`);
  }
  if (customFont) return { buffer: customFont, family };
  if (fontRegistry.has(locale)) return { buffer: fontRegistry.get(locale)!, family };

  if (customResolver) {
    const res = await customResolver(locale);
    if (res) {
      fontRegistry.set(locale, res);
      return { buffer: res, family };
    }
    throw new FontLoadError(`[${locale}] Font resolver không tìm thấy font CJK (${family}).`);
  }

    throw new FontLoadError(`[${locale}] Không tìm thấy nguồn font CJK (${family}) cho ngôn ngữ ${locale}. Render diagram thất bại.`, "missing");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function roundedRect(x: number, y: number, w: number, h: number, r: number) {
  return `M${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} ` +
    `L${x + r},${y + h} Q${x},${y + h} ${x},${y + h - r} L${x},${y + r} Q${x},${y} ${x + r},${y} Z`;
}

export function renderSvg(rough: any, spec: Diagram, seed = 7, fontFamily = "Patrick Hand"): string {
  const gen = rough.generator();
  // deno-lint-ignore no-explicit-any
  const paths = (drawable: any, extra = "") =>
    gen.toPaths(drawable).map((p: { d: string; strokeWidth: number }) =>
      `<path d="${p.d}" stroke="${INK}" stroke-width="${p.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"${extra}/>`
    ).join("");
  // preserveVertices keeps segment endpoints fixed so lines and corner curves meet (Excalidraw does the same).
  const opts = { roughness: 1.1, bowing: 0.8, stroke: INK, strokeWidth: 2.2, seed, preserveVertices: true };
  const boxes = layout(spec);
  // Tight canvas: grow a bounding box with everything that is drawn.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (x0: number, y0: number, x1: number, y1: number) => {
    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
  };
  let out = "";
  const text = (x: number, y: number, lines: string[], size: number, anchor: "middle" | "start") => {
    const top = y - ((lines.length - 1) * size * 1.1) / 2;
    lines.forEach((l, i) => {
      const w = textWidth(l, size), ly = top + i * size * 1.1;
      grow(anchor === "middle" ? x - w / 2 : x, ly - size / 2, anchor === "middle" ? x + w / 2 : x + w, ly + size / 2);
      out += `<text x="${x}" y="${ly}" font-family="${fontFamily}" font-size="${size}" fill="${INK}" text-anchor="${anchor}" dominant-baseline="middle">${esc(l)}</text>`;
    });
  };

  spec.nodes.forEach((n, i) => {
    const b = boxes.get(n.id)!;
    grow(b.cx - b.w / 2, b.cy - b.h / 2, b.cx + b.w / 2, b.cy + b.h / 2);
    const o = { ...opts, seed: seed + i };
    out += paths(n.shape === "ellipse" ? gen.ellipse(b.cx, b.cy, b.w, b.h, o) : gen.path(roundedRect(b.cx - b.w / 2, b.cy - b.h / 2, b.w, b.h, 16), o));
    text(b.cx, b.cy, b.lines, FONT_SIZE, "middle");
  });

  spec.edges.forEach((e, i) => {
    const o = { ...opts, seed: seed + 100 + i };
    const dash = e.style === "dashed" ? ` stroke-dasharray="10 9"` : "";
    const geo = edgeGeometry(e, boxes);
    let { x2, y2 } = geo;
    const { x1, y1, cx, cy, mid } = geo;
    grow(Math.min(x1, mid[0], x2), Math.min(y1, mid[1], y2), Math.max(x1, mid[0], x2), Math.max(y1, mid[1], y2));
    const ang = Math.atan2(y2 - cy, x2 - cx);
    x2 -= Math.cos(ang) * 12;
    y2 -= Math.sin(ang) * 12;
    out += paths(gen.path(`M${x1},${y1} Q${cx},${cy} ${x2},${y2}`, o), dash);
    for (const side of [-1, 1]) {
      const t = ang + Math.PI + side * 0.45;
      out += paths(gen.line(x2, y2, x2 + Math.cos(t) * 20, y2 + Math.sin(t) * 20, o));
    }
    const [mx, my] = mid;
    if (e.crossed) out += paths(gen.line(mx - 14, my - 14, mx + 14, my + 14, o)) + paths(gen.line(mx - 14, my + 14, mx + 14, my - 14, o));
    const label = edgeLabel(e, boxes);
    if (label) text(label.x, label.y, [label.text], LABEL_FONT_SIZE, label.anchor);
  });

  if (spec.title) {
    const tx = minX, ty = minY - 70;
    text(tx, ty, [spec.title], 40, "start");
    out += paths(gen.line(tx, ty + 30, tx + textWidth(spec.title, 40), ty + 32, { ...opts, seed: seed + 999 }));
    grow(tx, ty + 30, tx + textWidth(spec.title, 40), ty + 32);
  }
  const x = minX - PAD, y = minY - PAD, W = Math.ceil(maxX - minX + PAD * 2), H = Math.ceil(maxY - minY + PAD * 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${x} ${y} ${W} ${H}">` +
    `<rect x="${x}" y="${y}" width="${W}" height="${H}" fill="#ffffff"/>${out}</svg>`;
}

/** PNG bytes of a checked diagram spec, at 2x. */
export async function renderDiagramPng(
  spec: Diagram,
  locale?: string,
  customFont?: Uint8Array
): Promise<Uint8Array> {
  const { rough, font: baseFont } = await load();
  const isCjk = Boolean(locale && CJK_FONT_FAMILIES[locale]);

  let fontFamily = "Patrick Hand";
  const fontBuffers = [baseFont];

  if (isCjk) {
    const cjk = await resolveLocaleFont(locale!, customFont);
    fontFamily = cjk.family;
    fontBuffers.unshift(cjk.buffer);
  }

  const svg = renderSvg(rough, spec, 7, fontFamily);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "zoom", value: ZOOM },
    font: { fontBuffers, defaultFontFamily: fontFamily, loadSystemFonts: false },
  });
  return resvg.render().asPng();
}

// ---- storage names ---------------------------------------------------------------------------

/** Characters the app's /lesson-image/<course>/<file> reference allows (src/lib/lessonImage.ts). */
const slug = (id: string) => id.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "x";

/** File name of a diagram image in the app (`/lesson-image/<courseId>/<file>`), unique per lesson and diagram. */
export function diagramFile(lessonId: string, diagramId: string, locale?: string): string {
  const locSuffix = locale && locale !== "en" ? `_${locale}` : "";
  return `${`${slug(lessonId)}-${slug(diagramId)}${locSuffix}`.slice(0, 60)}.png`;
}

/** Folder of a lesson's images in the studio-drafts bucket. */
export function draftDir(runId: string, lessonId: string): string {
  return `${runId}/${slug(lessonId)}`;
}

/** Object path in the studio-drafts bucket. */
export function draftPath(runId: string, lessonId: string, diagramId: string, locale?: string): string {
  const locSuffix = locale && locale !== "en" ? `_${locale}` : "";
  return `${draftDir(runId, lessonId)}/${slug(diagramId)}${locSuffix}.png`;
}

/** Where the app stores lesson images: bucket `app`. */
export function appImagePath(courseId: string, file: string): string {
  return `course-thumbnails/${courseId}/lessons/${file}`;
}

/** Markdown with diagram references pointing at the app's lesson images. */
export function publishMarkdown(markdown: string, courseId: string, lessonId: string, locale?: string): string {
  return markdown.replace(/(!\[[^\]]*\]\()diagram:([^)\s]+)\)/g, (_m, head: string, id: string) => `${head}/lesson-image/${courseId}/${diagramFile(lessonId, id, locale)})`);
}

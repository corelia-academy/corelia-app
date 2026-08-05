import { certificateVerifyUrl } from "@/lib/certificatesEdge";
import { uploadRenderedCertificate } from "@/lib/storage";

import { CERT_PLACEHOLDER, BADGE_PLACEHOLDER } from "../constants";
import type { CertificateItem, BadgeItem } from "../types";
import {
  CANVAS_H,
  CANVAS_W,
  MM_TO_PT,
  PDF_H_MM,
  PDF_W_MM,
  certificateFooterLines,
  certificateLayout,
  layoutForCanvas,
  layoutForPdf,
  type CertificateLayoutSettings,
} from "./certificateLayout";

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3
    ? h.split("").map((c) => c + c).join("")
    : h.padEnd(6, "0");
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Fetch image → blob URL (same-origin) → canvas-safe Image element.
 *  Avoids CORS canvas taint that occurs with crossOrigin on Supabase Storage. */
export async function loadImageViaBlobUrl(
  src: string,
): Promise<{ img: HTMLImageElement; blobUrl: string }> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Image fetch failed: HTTP ${res.status}`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = blobUrl;
  });
  return { img, blobUrl };
}

/** The subset of a certificate needed to draw one. Narrower than CertificateItem so
 *  the public /verify page can render straight from the verification RPC's snapshot
 *  without fabricating a whole CertificateItem. */
export type CertificateRenderInput = Pick<
  CertificateItem,
  | "imageUrl"
  | "nameXPercent"
  | "nameYPercent"
  | "nameSizePercent"
  | "nameColor"
  | "holderName"
  | "verificationCode"
  | "issuedAtIso"
  | "footerXPercent"
  | "footerYPercent"
  | "footerSizePercent"
  | "footerColor"
  | "qrXPercent"
  | "qrYPercent"
  | "qrSizePercent"
>;

/** Always carries the full fallback stack, so a font that fails to load rasterizes
 *  system sans rather than nothing. The registered family is "Google Sans Variable",
 *  NOT "Google Sans" — see src/styles/globals.css. */
const CERT_SANS = `'Google Sans Variable', ui-sans-serif, system-ui, -apple-system, sans-serif`;

const FONT_LOAD_TIMEOUT_MS = 3000;

/** Canvas does not trigger webfont loading the way the DOM does, and this font is
 *  split into 250 unicode-range-subsetted woff2 files with font-display: swap. So
 *  the exact text has to be handed to the font loader — a Latin sample will not pull
 *  down the Vietnamese subset a learner's name needs.
 *
 *  Best effort throughout: this runs on the public /verify page inside a catch that
 *  swallows everything, so a hung fetch must never become a hung render. */
async function ensureCertificateFont(
  specs: Array<{ weight: string; px: number; text: string }>,
): Promise<void> {
  const fonts = typeof document !== "undefined" ? document.fonts : undefined;
  if (!fonts?.load) return;
  const wanted = specs.filter((s) => s.text.trim());
  if (wanted.length === 0) return;
  // A malformed descriptor makes FontFaceSet.load throw synchronously, hence catch.
  const loading = Promise.all(
    wanted.map((s) => fonts.load(`${s.weight} ${Math.round(s.px)}px "Google Sans Variable"`, s.text)),
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), FONT_LOAD_TIMEOUT_MS);
  });
  try {
    const outcome = await Promise.race([loading.then(() => "loaded" as const), timeout]);
    if (outcome === "timeout") {
      console.warn("[certificate] Google Sans did not load in time; using fallback font");
    }
  } catch (err) {
    console.warn("[certificate] font load failed; using fallback font", err);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Draws the footer lines left-aligned, vertically centred on `y`. Shared by the
 *  canvas path and the PDF's offscreen raster so the two can never diverge. */
function drawFooterLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  opts: { x: number; y: number; fontPx: number; linePx: number; color: string },
): void {
  const [r, g, b] = hexToRgb(opts.color);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.font = `400 ${opts.fontPx}px ${CERT_SANS}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const firstY = opts.y - ((lines.length - 1) * opts.linePx) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, opts.x, firstY + i * opts.linePx);
  });
}

/** QR encoding the absolute verify URL, as a PNG data URL.
 *  Data URLs never taint a canvas and are exactly what jsPDF.addImage wants, so the
 *  canvas and PDF paths share this one call. Dynamically imported to keep qrcode out
 *  of the main bundle, mirroring the existing `await import("jspdf")` below. */
async function certificateQrDataUrl(code: string): Promise<string> {
  const QRCode = await import("qrcode");
  return await QRCode.toDataURL(certificateVerifyUrl(code), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 512,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

function loadDataUrlImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode QR image"));
    img.src = dataUrl;
  });
}

/** Reads the instructor's layout settings off a render input. */
function layoutSettingsOf(cert: CertificateRenderInput): CertificateLayoutSettings {
  return {
    nameXPercent: cert.nameXPercent,
    nameYPercent: cert.nameYPercent,
    nameSizePercent: cert.nameSizePercent,
    footerXPercent: cert.footerXPercent,
    footerYPercent: cert.footerYPercent,
    footerSizePercent: cert.footerSizePercent,
    qrXPercent: cert.qrXPercent,
    qrYPercent: cert.qrYPercent,
    qrSizePercent: cert.qrSizePercent,
  };
}

/** Render the certificate template with the learner's name, the Date of Issue /
 *  Certificate ID footer and the verification QR overlaid onto a 1600×1200 canvas.
 *  Returns the resulting PNG Blob, or null if there's no usable template image. */
export async function renderCertificateBlob(cert: CertificateRenderInput): Promise<Blob | null> {
  const src = cert.imageUrl;
  if (!src || src === CERT_PLACEHOLDER) return null;

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const L = layoutForCanvas(certificateLayout(layoutSettingsOf(cert)));
  const holderName = cert.holderName?.trim() ?? "";
  const footerLines = certificateFooterLines({
    issuedAtIso: cert.issuedAtIso,
    verificationCode: cert.verificationCode,
  });

  await ensureCertificateFont([
    { weight: "700", px: L.name.fontPx, text: holderName },
    { weight: "400", px: L.footer.fontPx, text: footerLines.join("") },
  ]);

  const { img, blobUrl } = await loadImageViaBlobUrl(src);
  ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
  URL.revokeObjectURL(blobUrl);

  if (holderName) {
    const [r, g, b] = hexToRgb(cert.nameColor ?? "#000000");
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.font = `bold ${L.name.fontPx}px 'Times New Roman', Times, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(holderName, L.name.x, L.name.y);
  }

  if (footerLines.length > 0) {
    drawFooterLines(ctx, footerLines, {
      x: L.footer.x,
      y: L.footer.y,
      fontPx: L.footer.fontPx,
      linePx: L.footer.linePx,
      color: cert.footerColor ?? "#000000",
    });
  }

  // Non-fatal: a QR failure must never cost the learner their certificate image.
  const code = cert.verificationCode?.trim();
  if (code) {
    try {
      const qrImg = await loadDataUrlImage(await certificateQrDataUrl(code));
      ctx.drawImage(qrImg, L.qr.left, L.qr.top, L.qr.size, L.qr.size);
    } catch (err) {
      console.error("[certificate] QR render failed (non-fatal)", err);
    }
  }

  return await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
}

/** Render the named certificate and upload it to the permanent CDN path
 *  `certificates/{userId}/{courseId}.png`. Returns the CDN URL, or null on failure.
 *
 *  Off-chain only. The OpenCampus payload takes its art from
 *  `credential_templates.image_url` (see credentials/oc_payload.ts and the note in
 *  credentials/mint.ts) and never reads this path — printing a learner's name onto
 *  an immutable on-chain credential would leak PII permanently. */
export async function renderAndUploadCertificate(
  cert: CertificateItem,
  userId: string,
): Promise<string | null> {
  if (!userId || !cert.courseId) return null;
  const blob = await renderCertificateBlob(cert);
  if (!blob) return null;
  const { url } = await uploadRenderedCertificate(userId, cert.courseId, blob);
  return url;
}

/** ~300dpi. jsPDF cannot embed Google Sans — @fontsource-variable ships woff2 only,
 *  and jsPDF's TTF parser wouldn't handle the variable axes anyway — so the footer is
 *  drawn with the SAME canvas code as the PNG and placed as a transparent image.
 *  Costs selectable text in the PDF; buys a footer that is guaranteed pixel-identical
 *  to the PNG and to the /verify re-render. */
const PDF_RASTER_PX_PER_MM = 300 / 25.4;

/** Footer text rendered to a transparent PNG data URL, sized to the text.
 *  Returns null when there is nothing to draw. */
function rasterizeFooter(
  lines: string[],
  opts: { fontPt: number; color: string },
): { dataUrl: string; widthMm: number; heightMm: number } | null {
  if (lines.length === 0) return null;
  const fontPx = (opts.fontPt / MM_TO_PT) * PDF_RASTER_PX_PER_MM;
  const linePx = fontPx * 1.35;

  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return null;
  measure.font = `400 ${fontPx}px ${CERT_SANS}`;
  const textWidth = Math.max(...lines.map((l) => measure.measureText(l).width));

  // Pad generously: descenders and italic-ish side bearings overflow the metrics.
  const padX = fontPx * 0.15;
  const padY = fontPx * 0.35;
  const width = Math.ceil(textWidth + padX * 2);
  const height = Math.ceil(linePx * lines.length + padY * 2);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // Left transparent so the template artwork shows through behind the text.
  drawFooterLines(ctx, lines, {
    x: padX,
    y: height / 2,
    fontPx,
    linePx,
    color: opts.color,
  });

  return {
    dataUrl: canvas.toDataURL("image/png"),
    widthMm: width / PDF_RASTER_PX_PER_MM,
    heightMm: height / PDF_RASTER_PX_PER_MM,
  };
}

export async function downloadCertificate(cert: CertificateItem): Promise<void> {
  const src = cert.imageUrl;
  if (!src || src === CERT_PLACEHOLDER) return;

  const L = layoutForPdf(certificateLayout(layoutSettingsOf(cert)));
  const footerLines = certificateFooterLines({
    issuedAtIso: cert.issuedAtIso,
    verificationCode: cert.verificationCode,
  });
  await ensureCertificateFont([
    {
      weight: "400",
      px: (L.footer.fontPt / MM_TO_PT) * PDF_RASTER_PX_PER_MM,
      text: footerLines.join(""),
    },
  ]);

  // 1. Fetch image via blob URL to avoid canvas CORS taint
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { img, blobUrl } = await loadImageViaBlobUrl(src);
  ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
  URL.revokeObjectURL(blobUrl);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);

  // 2. Create PDF — image as background, name rendered as vector text
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.addImage(dataUrl, "JPEG", 0, 0, PDF_W_MM, PDF_H_MM);

  if (cert.holderName?.trim()) {
    const [r, g, b] = hexToRgb(cert.nameColor ?? "#000000");
    doc.setFont("times", "bolditalic");
    doc.setFontSize(L.name.fontPt);
    doc.setTextColor(r, g, b);
    doc.text(cert.holderName.trim(), L.name.xMm, L.name.yMm, {
      align: "center",
      baseline: "middle",
    });
  }

  // 3. Footer block, drawn as a transparent hi-dpi image so it keeps Google Sans.
  //    Non-fatal — never block the download.
  try {
    const footer = rasterizeFooter(footerLines, {
      fontPt: L.footer.fontPt,
      color: cert.footerColor ?? "#000000",
    });
    if (footer) {
      doc.addImage(
        footer.dataUrl,
        "PNG",
        L.footer.xMm,
        L.footer.yMm - footer.heightMm / 2,
        footer.widthMm,
        footer.heightMm,
      );
    }
  } catch (err) {
    console.error("[certificate] footer render failed (non-fatal)", err);
  }

  // 4. Verification QR. Non-fatal.
  const code = cert.verificationCode?.trim();
  if (code) {
    try {
      const qrDataUrl = await certificateQrDataUrl(code);
      doc.addImage(qrDataUrl, "PNG", L.qr.leftMm, L.qr.topMm, L.qr.sizeMm, L.qr.sizeMm);
    } catch (err) {
      console.error("[certificate] QR render failed (non-fatal)", err);
    }
  }

  const filename = `${cert.course.replace(/[^a-z0-9]/gi, "-")}-certificate.pdf`;
  doc.save(filename);
}

export async function downloadCertificatePng(cert: CertificateItem): Promise<void> {
  const blob = await renderCertificateBlob(cert);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${cert.course.replace(/[^a-z0-9]/gi, "-")}-certificate.png`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadBadgeImage(badge: BadgeItem): Promise<void> {
  const src = badge.imageUrl;
  if (!src || src === BADGE_PLACEHOLDER) return;

  const res = await fetch(src);
  if (!res.ok) throw new Error("Image fetch failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${badge.title.replace(/[^a-z0-9]/gi, "-")}-badge.png`;
  a.click();
  URL.revokeObjectURL(url);
}


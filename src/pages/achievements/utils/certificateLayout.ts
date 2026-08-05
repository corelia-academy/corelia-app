/** Certificate layout geometry — pure, no DOM, unit-testable.
 *
 *  The same certificate is drawn onto three surfaces: a 1600×1200 canvas (the PNG
 *  download, the instructor preview, and the public /verify re-render) and an A4
 *  landscape jsPDF document (the PDF download). Those used to carry two independent
 *  sets of hardcoded constants that had already drifted apart — the QR sat at
 *  90%/85% on canvas but 91.25%/86.19% in the PDF. Everything positional now flows
 *  from one normalized layout so the surfaces cannot disagree again.
 *
 *  Instructors control these numbers per course via `courses.data`. There is NO
 *  server-side validation on that jsonb (splitCourseUpdate in src/lib/courses.ts
 *  writes any key through, and no CHECK constraint or edge validation exists), so
 *  the clamping in `certificateLayout()` is the only thing standing between a bad
 *  value and a broken render. It must stay here, at render time, on every surface.
 */

export const MM_TO_PT = 72 / 25.4;

export const CANVAS_W = 1600;
export const CANVAS_H = 1200;

// A4 landscape, matching the jsPDF document in renderCertificate.ts.
export const PDF_W_MM = 297;
export const PDF_H_MM = 210;

/** Line height as a multiple of font size, for the two-line footer block. */
const FOOTER_LINE_RATIO = 1.35;

/** Percentages as stored in `courses.data`. Every field is optional — a course that
 *  has never been configured renders at the defaults below, which reproduce the
 *  layout that shipped before these settings existed. */
export type CertificateLayoutSettings = {
  nameXPercent?: number | null;
  nameYPercent?: number | null;
  nameSizePercent?: number | null;
  footerXPercent?: number | null;
  footerYPercent?: number | null;
  footerSizePercent?: number | null;
  qrXPercent?: number | null;
  qrYPercent?: number | null;
  qrSizePercent?: number | null;
};

/** Not `as const`: these seed form state, and literal types there would infer the
 *  form fields as `50 | 5 | ...` instead of `number`. */
export const CERTIFICATE_LAYOUT_DEFAULTS: Required<{
  [K in keyof CertificateLayoutSettings]: number;
}> = {
  /** Centre of the learner name. */
  nameXPercent: 50,
  nameYPercent: 50,
  /** 5% of 1600px = 80px, and 5% of 297mm = 42pt — exactly the values hardcoded
   *  before this module existed, on both surfaces. */
  nameSizePercent: 5,
  /** Left edge / vertical middle of the footer text block. */
  footerXPercent: 5,
  footerYPercent: 85,
  /** 1.75% of 1600px = 28px. */
  footerSizePercent: 1.75,
  /** Centre of the QR square — taken from the canvas layout, which is what the
   *  preview and /verify show. The PDF QR shifts ~2mm and grows from 26mm to
   *  33.4mm as a result; larger scans more reliably. */
  qrXPercent: 90,
  qrYPercent: 85,
  /** 11.25% of 1600px = 180px. */
  qrSizePercent: 11.25,
};

/** Positions are 0-100% of the surface. Sizes are bounded well inside that so a
 *  typo (or a hostile write straight into courses.data) cannot produce a QR that
 *  swallows the certificate or text too small to read. */
const POSITION_RANGE = { min: 0, max: 100 } as const;
const FOOTER_SIZE_RANGE = { min: 0.5, max: 6 } as const;
const NAME_SIZE_RANGE = { min: 1, max: 15 } as const;
const QR_SIZE_RANGE = { min: 3, max: 30 } as const;

function clampPercent(
  value: number | null | undefined,
  fallback: number,
  range: { min: number; max: number },
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(range.min, Math.min(range.max, value));
}

/** Unit-free layout. `xFrac`/`yFrac` are fractions of surface width/height; every
 *  `*Frac` size is a fraction of surface WIDTH, so a square stays square and one
 *  number drives both surfaces despite their different aspect ratios. */
export type CertificateLayout = {
  name: { xFrac: number; yFrac: number; fontFrac: number };
  footer: { xFrac: number; yFrac: number; fontFrac: number; lineFrac: number };
  qr: { cxFrac: number; cyFrac: number; sizeFrac: number };
};

export function certificateLayout(settings: CertificateLayoutSettings): CertificateLayout {
  const d = CERTIFICATE_LAYOUT_DEFAULTS;
  const footerFontFrac =
    clampPercent(settings.footerSizePercent, d.footerSizePercent, FOOTER_SIZE_RANGE) / 100;
  return {
    name: {
      xFrac: clampPercent(settings.nameXPercent, d.nameXPercent, POSITION_RANGE) / 100,
      yFrac: clampPercent(settings.nameYPercent, d.nameYPercent, POSITION_RANGE) / 100,
      fontFrac: clampPercent(settings.nameSizePercent, d.nameSizePercent, NAME_SIZE_RANGE) / 100,
    },
    footer: {
      xFrac: clampPercent(settings.footerXPercent, d.footerXPercent, POSITION_RANGE) / 100,
      yFrac: clampPercent(settings.footerYPercent, d.footerYPercent, POSITION_RANGE) / 100,
      fontFrac: footerFontFrac,
      lineFrac: footerFontFrac * FOOTER_LINE_RATIO,
    },
    qr: {
      cxFrac: clampPercent(settings.qrXPercent, d.qrXPercent, POSITION_RANGE) / 100,
      cyFrac: clampPercent(settings.qrYPercent, d.qrYPercent, POSITION_RANGE) / 100,
      sizeFrac: clampPercent(settings.qrSizePercent, d.qrSizePercent, QR_SIZE_RANGE) / 100,
    },
  };
}

export type CanvasLayout = {
  name: { x: number; y: number; fontPx: number };
  footer: { x: number; y: number; fontPx: number; linePx: number };
  /** Top-left corner, since ctx.drawImage takes a corner while the setting is a centre. */
  qr: { left: number; top: number; size: number };
};

export function layoutForCanvas(
  layout: CertificateLayout,
  width = CANVAS_W,
  height = CANVAS_H,
): CanvasLayout {
  const qrSize = layout.qr.sizeFrac * width;
  return {
    name: {
      x: layout.name.xFrac * width,
      y: layout.name.yFrac * height,
      fontPx: layout.name.fontFrac * width,
    },
    footer: {
      x: layout.footer.xFrac * width,
      y: layout.footer.yFrac * height,
      fontPx: layout.footer.fontFrac * width,
      linePx: layout.footer.lineFrac * width,
    },
    qr: {
      left: layout.qr.cxFrac * width - qrSize / 2,
      top: layout.qr.cyFrac * height - qrSize / 2,
      size: qrSize,
    },
  };
}

export type PdfLayout = {
  name: { xMm: number; yMm: number; fontPt: number };
  footer: { xMm: number; yMm: number; fontPt: number; lineMm: number };
  qr: { leftMm: number; topMm: number; sizeMm: number };
};

export function layoutForPdf(
  layout: CertificateLayout,
  widthMm = PDF_W_MM,
  heightMm = PDF_H_MM,
): PdfLayout {
  const qrSizeMm = layout.qr.sizeFrac * widthMm;
  // jsPDF sizes fonts in points no matter what unit the document uses, so font is
  // the one value that changes unit here. Sanity check: the default 5% of 297mm
  // works out to 42.09pt — the exact figure the PDF path hardcoded before.
  const toPt = (frac: number) => frac * widthMm * MM_TO_PT;
  return {
    name: {
      xMm: layout.name.xFrac * widthMm,
      yMm: layout.name.yFrac * heightMm,
      fontPt: toPt(layout.name.fontFrac),
    },
    footer: {
      xMm: layout.footer.xFrac * widthMm,
      yMm: layout.footer.yFrac * heightMm,
      fontPt: toPt(layout.footer.fontFrac),
      lineMm: layout.footer.lineFrac * widthMm,
    },
    qr: {
      leftMm: layout.qr.cxFrac * widthMm - qrSizeMm / 2,
      topMm: layout.qr.cyFrac * heightMm - qrSizeMm / 2,
      sizeMm: qrSizeMm,
    },
  };
}

/** Date printed on the certificate.
 *
 *  Deliberately NOT localized. The viewer's locale would render the same
 *  certificate as `8/4/2026` for one person and `04/08/2026` for another —
 *  ambiguous between MDY and DMY on the one document whose whole job is to be
 *  verifiable. /verify is public and locale-detected, so that divergence is
 *  guaranteed rather than hypothetical. A spelled-out month in a fixed locale
 *  reads identically for everyone.
 *
 *  UTC is pinned because certificate_issued_at is a timestamptz: without it a
 *  viewer in UTC-8 sees the previous day for an evening-issued certificate. */
export function formatCertificateIssueDate(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(date)
    .replace(/,/g, "");
}

/** Labels are hardcoded English on purpose: they are printed onto the artifact, so
 *  localizing them would make a Vietnamese viewer's /verify re-render disagree with
 *  the English learner's downloaded PDF. */
export const FOOTER_DATE_LABEL = "Date of Issue: ";
export const FOOTER_ID_LABEL = "Certificate ID: ";

/** The footer text block, top line first. Empty when there is nothing to print. */
export function certificateFooterLines(input: {
  issuedAtIso?: string | null;
  verificationCode?: string | null;
}): string[] {
  const lines: string[] = [];
  const date = formatCertificateIssueDate(input.issuedAtIso);
  if (date) lines.push(`${FOOTER_DATE_LABEL}${date}`);
  const code = input.verificationCode?.trim();
  if (code) lines.push(`${FOOTER_ID_LABEL}${code}`);
  return lines;
}

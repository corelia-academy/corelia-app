import { describe, expect, it } from "vitest";

import {
  CANVAS_H,
  CANVAS_W,
  CERTIFICATE_LAYOUT_DEFAULTS,
  PDF_H_MM,
  PDF_W_MM,
  certificateFooterLines,
  certificateLayout,
  formatCertificateIssueDate,
  layoutForCanvas,
  layoutForPdf,
} from "./certificateLayout";

const defaults = () => certificateLayout({});

describe("layoutForCanvas — backward compatibility", () => {
  it("reproduces the QR position and size that were hardcoded before this module", () => {
    // Was: QR_PX = 180, drawn at (1600 - 180 - 70, 1200 - 180 - 90).
    const { qr } = layoutForCanvas(defaults());
    expect(qr.size).toBe(180);
    expect(qr.left).toBe(1350);
    expect(qr.top).toBe(930);
  });

  it("reproduces the learner name placement and 80px font", () => {
    const { name } = layoutForCanvas(defaults());
    expect(name.x).toBe(800);
    expect(name.y).toBe(600);
    expect(name.fontPx).toBe(80);
  });

  it("puts the footer block at the lower left", () => {
    const { footer } = layoutForCanvas(defaults());
    expect(footer.x).toBeCloseTo(80, 10);
    expect(footer.y).toBeCloseTo(1020, 10);
    expect(footer.fontPx).toBeCloseTo(28, 10);
  });
});

describe("layoutForPdf — unit conversion", () => {
  it("derives the 42pt name size the PDF path used to hardcode", () => {
    // 5% of 297mm = 14.85mm; 14.85 * 72/25.4 = 42.09pt. The old code said 42 —
    // rounded, which is why this asserts to within half a point rather than exactly.
    expect(layoutForPdf(defaults()).name.fontPt).toBeCloseTo(42, 0);
    expect(layoutForPdf(defaults()).name.fontPt).toBeCloseTo(42.0945, 3);
  });

  it("centres the name on the A4 landscape page", () => {
    const { name } = layoutForPdf(defaults());
    expect(name.xMm).toBeCloseTo(148.5, 6);
    expect(name.yMm).toBeCloseTo(105, 6);
  });

  it("sizes the QR off page width so it stays square", () => {
    const { qr } = layoutForPdf(defaults());
    expect(qr.sizeMm).toBeCloseTo(33.4125, 3);
  });
});

describe("cross-surface consistency", () => {
  it("centres the QR at the same relative spot on canvas and PDF", () => {
    const layout = certificateLayout({ qrXPercent: 33, qrYPercent: 71, qrSizePercent: 9 });
    const canvas = layoutForCanvas(layout);
    const pdf = layoutForPdf(layout);
    // The CENTRE is the invariant, not the corner. The QR is square and sized off
    // width, while the two surfaces have different aspect ratios (1.333 vs 1.414) —
    // so a square that keeps its centre and its proportions necessarily has its top
    // edge at slightly different relative heights. Keeping the centre fixed is what
    // makes the size input grow the code symmetrically in the preview.
    const canvasCx = (canvas.qr.left + canvas.qr.size / 2) / CANVAS_W;
    const canvasCy = (canvas.qr.top + canvas.qr.size / 2) / CANVAS_H;
    const pdfCx = (pdf.qr.leftMm + pdf.qr.sizeMm / 2) / PDF_W_MM;
    const pdfCy = (pdf.qr.topMm + pdf.qr.sizeMm / 2) / PDF_H_MM;
    expect(canvasCx).toBeCloseTo(pdfCx, 10);
    expect(canvasCy).toBeCloseTo(pdfCy, 10);
    expect(canvas.qr.size / CANVAS_W).toBeCloseTo(pdf.qr.sizeMm / PDF_W_MM, 10);
  });

  it("keeps the QR square on both surfaces", () => {
    const layout = certificateLayout({ qrSizePercent: 9 });
    // Square in absolute units on each surface: 144px on canvas, 26.73mm on PDF.
    expect(layoutForCanvas(layout).qr.size).toBeCloseTo(144, 10);
    expect(layoutForPdf(layout).qr.sizeMm).toBeCloseTo(26.73, 10);
  });

  it("places the footer at the same relative spot on both surfaces", () => {
    const layout = certificateLayout({ footerXPercent: 12, footerYPercent: 91 });
    const canvas = layoutForCanvas(layout);
    const pdf = layoutForPdf(layout);
    expect(canvas.footer.x / CANVAS_W).toBeCloseTo(pdf.footer.xMm / PDF_W_MM, 10);
    expect(canvas.footer.y / CANVAS_H).toBeCloseTo(pdf.footer.yMm / PDF_H_MM, 10);
  });
});

describe("certificateLayout — clamping", () => {
  it("clamps positions into safe bounded margin ranges", () => {
    const layout = certificateLayout({ nameXPercent: -10, nameYPercent: 150 });
    expect(layout.name.xFrac).toBeGreaterThanOrEqual(0.15);
    expect(layout.name.yFrac).toBeCloseTo(0.92, 10);
  });

  it("clamps the QR size into a sane band", () => {
    expect(certificateLayout({ qrSizePercent: 0 }).qr.sizeFrac).toBeCloseTo(0.03, 10);
    expect(certificateLayout({ qrSizePercent: 999 }).qr.sizeFrac).toBeCloseTo(0.3, 10);
  });

  it("clamps the footer size into a legible band", () => {
    expect(certificateLayout({ footerSizePercent: 0.01 }).footer.fontFrac).toBeCloseTo(0.005, 10);
    expect(certificateLayout({ footerSizePercent: 50 }).footer.fontFrac).toBeCloseTo(0.06, 10);
  });

  it("falls back to defaults for null, undefined and non-finite values", () => {
    const d = CERTIFICATE_LAYOUT_DEFAULTS;
    for (const bad of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      const layout = certificateLayout({ qrXPercent: bad, footerSizePercent: bad });
      expect(layout.qr.cxFrac).toBeCloseTo(d.qrXPercent / 100, 10);
      expect(layout.footer.fontFrac).toBeCloseTo(d.footerSizePercent / 100, 10);
    }
  });
});

describe("footer geometry", () => {
  it("derives line height from font size", () => {
    const layout = certificateLayout({ footerSizePercent: 2 });
    expect(layout.footer.lineFrac).toBeCloseTo(layout.footer.fontFrac * 1.35, 10);
  });

  it("keeps the two baselines symmetric about the configured y", () => {
    const { footer } = layoutForCanvas(certificateLayout({ footerYPercent: 80 }));
    const top = footer.y - footer.linePx / 2;
    const bottom = footer.y + footer.linePx / 2;
    expect((top + bottom) / 2).toBeCloseTo(footer.y, 10);
    expect(bottom - top).toBeCloseTo(footer.linePx, 10);
  });
});

describe("certificateFooterLines", () => {
  it("renders both lines with their printed labels", () => {
    expect(
      certificateFooterLines({
        issuedAtIso: "2026-08-04T10:00:00Z",
        verificationCode: "CRL-0123456789",
      }),
    ).toEqual(["Date of Issue: 04 Aug 2026", "Certificate ID: CRL-0123456789"]);
  });

  it("drops whichever line has no data", () => {
    expect(certificateFooterLines({ issuedAtIso: "2026-08-04T10:00:00Z" })).toEqual([
      "Date of Issue: 04 Aug 2026",
    ]);
    expect(certificateFooterLines({ verificationCode: "CRL-0123456789" })).toEqual([
      "Certificate ID: CRL-0123456789",
    ]);
  });

  it("returns nothing when there is nothing to print", () => {
    expect(certificateFooterLines({})).toEqual([]);
    expect(certificateFooterLines({ issuedAtIso: null, verificationCode: "   " })).toEqual([]);
  });
});

describe("formatCertificateIssueDate", () => {
  it("spells the month so the date is never ambiguous", () => {
    expect(formatCertificateIssueDate("2026-08-04T10:00:00Z")).toBe("04 Aug 2026");
  });

  it("pins UTC so the day never shifts with the viewer's timezone", () => {
    // Late-evening UTC — a local-time format would roll this to the 5th east of UTC.
    expect(formatCertificateIssueDate("2026-08-04T23:30:00Z")).toBe("04 Aug 2026");
    // Same instant expressed in UTC+7.
    expect(formatCertificateIssueDate("2026-08-04T02:00:00+07:00")).toBe("03 Aug 2026");
  });

  it("returns an empty string rather than throwing on bad input", () => {
    expect(formatCertificateIssueDate(null)).toBe("");
    expect(formatCertificateIssueDate(undefined)).toBe("");
    expect(formatCertificateIssueDate("garbage")).toBe("");
  });
});

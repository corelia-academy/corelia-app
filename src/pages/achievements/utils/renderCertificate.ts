import { uploadRenderedCertificate } from "@/lib/storage";

import { CERT_PLACEHOLDER, BADGE_PLACEHOLDER } from "../constants";
import type { CertificateItem, BadgeItem } from "../types";

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

/** Render the certificate template with the learner's name overlaid onto a
 *  1600×1200 canvas. Returns the resulting PNG Blob, or null if there's no
 *  usable template image. */
export async function renderCertificateBlob(cert: CertificateItem): Promise<Blob | null> {
  const src = cert.imageUrl;
  if (!src || src === CERT_PLACEHOLDER) return null;

  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const { img, blobUrl } = await loadImageViaBlobUrl(src);
  ctx.drawImage(img, 0, 0, 1600, 1200);
  URL.revokeObjectURL(blobUrl);

  if (cert.holderName?.trim()) {
    const x = ((cert.nameXPercent ?? 50) / 100) * 1600;
    const y = ((cert.nameYPercent ?? 50) / 100) * 1200;
    const [r, g, b] = hexToRgb(cert.nameColor ?? "#000000");
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.font = "bold 80px 'Times New Roman', Times, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(cert.holderName.trim(), x, y);
  }

  return await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
}

/** Render the named certificate and upload it to the permanent CDN path
 *  `certificates/{userId}/{courseId}.png`. Returns the CDN URL, or null on failure.
 *  Used both for the preview dialog and (critically) during the claim flow so the
 *  backend can embed the name-rendered certificate in the OpenCampus payload. */
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

// A4 landscape: 297 × 210 mm
const PDF_W_MM = 297;
const PDF_H_MM = 210;

export async function downloadCertificate(cert: CertificateItem): Promise<void> {
  const src = cert.imageUrl;
  if (!src || src === CERT_PLACEHOLDER) return;

  // 1. Fetch image via blob URL to avoid canvas CORS taint
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { img, blobUrl } = await loadImageViaBlobUrl(src);
  ctx.drawImage(img, 0, 0, 1600, 1200);
  URL.revokeObjectURL(blobUrl);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);

  // 2. Create PDF — image as background, name rendered as vector text
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.addImage(dataUrl, "JPEG", 0, 0, PDF_W_MM, PDF_H_MM);

  if (cert.holderName?.trim()) {
    const xMm = ((cert.nameXPercent ?? 50) / 100) * PDF_W_MM;
    const yMm = ((cert.nameYPercent ?? 50) / 100) * PDF_H_MM;
    const [r, g, b] = hexToRgb(cert.nameColor ?? "#000000");
    doc.setFont("times", "bolditalic");
    doc.setFontSize(42);
    doc.setTextColor(r, g, b);
    doc.text(cert.holderName.trim(), xMm, yMm, { align: "center", baseline: "middle" });
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


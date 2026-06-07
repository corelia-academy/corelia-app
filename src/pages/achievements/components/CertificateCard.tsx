import {
  Award,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Download,
  FileImage,
  FileText,
  GraduationCap,
  Loader2,
  X,
  ZoomIn,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { CERT_PLACEHOLDER } from "../constants";
import type { CertificateItem, ModalItem } from "../types";
import { OcClaimBadge } from "./OcClaimBadge";

// ── PDF download helper ─────────────────────────────────────────────────────
// A4 landscape: 297 × 210 mm
const PDF_W_MM = 297;
const PDF_H_MM = 210;

function hexToRgb(hex: string): [number, number, number] {
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

async function downloadCertificate(cert: CertificateItem): Promise<void> {
  const src = cert.imageUrl;
  if (!src || src === CERT_PLACEHOLDER) return;

  // 1. Load template image → canvas → JPEG data URL (handles CORS)
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load certificate image"));
    img.src = src;
  });
  ctx.drawImage(img, 0, 0, 1600, 1200);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);

  // 2. Create PDF — image as background, then render name as vector text
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Background image (no name baked in — text is added as PDF vector below)
  doc.addImage(dataUrl, "JPEG", 0, 0, PDF_W_MM, PDF_H_MM);

  // 3. Overlay name as crisp vector PDF text
  if (cert.holderName?.trim()) {
    const xMm = ((cert.nameXPercent ?? 50) / 100) * PDF_W_MM;
    const yMm = ((cert.nameYPercent ?? 50) / 100) * PDF_H_MM;
    const [r, g, b] = hexToRgb(cert.nameColor ?? "#000000");

    doc.setFont("times", "bolditalic");
    doc.setFontSize(30);
    doc.setTextColor(r, g, b);
    doc.text(cert.holderName.trim(), xMm, yMm, {
      align: "center",
      baseline: "middle",
    });
  }

  const filename = `${cert.course.replace(/[^a-z0-9]/gi, "-")}-certificate.pdf`;
  doc.save(filename);
}

async function downloadCertificatePng(cert: CertificateItem): Promise<void> {
  const src = cert.imageUrl;
  if (!src || src === CERT_PLACEHOLDER) return;

  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load certificate image"));
    img.src = src;
  });
  ctx.drawImage(img, 0, 0, 1600, 1200);

  if (cert.holderName?.trim()) {
    const x = ((cert.nameXPercent ?? 50) / 100) * 1600;
    const y = ((cert.nameYPercent ?? 50) / 100) * 1200;
    const [r, g, b] = hexToRgb(cert.nameColor ?? "#000000");
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.font = "bold 40px 'Times New Roman', Times, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(cert.holderName.trim(), x, y);
  }

  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cert.course.replace(/[^a-z0-9]/gi, "-")}-certificate.png`;
      a.click();
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png");
  });
}

// ── Certificate lightbox ────────────────────────────────────────────────────
function CertificatePreviewDialog({
  cert,
  open,
  onOpenChange,
}: {
  cert: CertificateItem;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation("common");
  const [downloading, setDownloading] = useState(false);
  const imageUrl = cert.imageUrl ?? CERT_PLACEHOLDER;
  const hasTemplate = imageUrl !== CERT_PLACEHOLDER;

  async function handleDownload(format: "pdf" | "png") {
    setDownloading(true);
    try {
      if (format === "pdf") await downloadCertificate(cert);
      else await downloadCertificatePng(cert);
    } catch {
      toast.error(t("achievements.certificates.downloadError"));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-3xl w-full p-0 overflow-hidden rounded-2xl border-border-subtle bg-surface-base"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-subtle">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{cert.course}</p>
            <p className="text-xs text-foreground-muted">
              {t("achievements.certificates.issuedOnPrefix", { date: cert.issuedAt })}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasTemplate && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={downloading}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-base px-3 py-1.5 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-surface-raised disabled:opacity-50"
                >
                  {downloading
                    ? <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    : <Download className="size-3.5" aria-hidden />}
                  {t("actions.download")}
                  <ChevronDown className="size-3.5" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => void handleDownload("pdf")} className="gap-2">
                    <FileText className="size-4 shrink-0 text-foreground-muted" aria-hidden />
                    {t("achievements.certificates.downloadPdf")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void handleDownload("png")} className="gap-2">
                    <FileImage className="size-4 shrink-0 text-foreground-muted" aria-hidden />
                    {t("achievements.certificates.downloadPng")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <button
              onClick={() => onOpenChange(false)}
              className="flex size-8 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-raised hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* Certificate image */}
        <div
          className="relative w-full bg-surface-raised"
          style={{ aspectRatio: "4/3" }}
        >
          <img
            src={imageUrl}
            alt={cert.course}
            className="size-full object-contain"
          />
          {cert.holderName && hasTemplate && (
            <span
              className="pointer-events-none absolute max-w-[70%] text-center font-bold leading-tight"
              style={{
                fontSize: "clamp(0.9rem, 2.2cqw, 1.5rem)",
                left: `${cert.nameXPercent ?? 50}%`,
                top: `${cert.nameYPercent ?? 50}%`,
                transform: "translate(-50%, -50%)",
                color: cert.nameColor ?? "#000000",
              }}
            >
              {cert.holderName}
            </span>
          )}
        </div>

        {/* Footer note */}
        {!hasTemplate && (
          <p className="px-4 py-3 text-center text-sm text-foreground-muted">
            {t("achievements.certificates.noTemplate")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Certificate card ────────────────────────────────────────────────────────
export function CertificateCard({
  cert,
  onOpenModal,
}: {
  cert: CertificateItem;
  onOpenModal: (item: ModalItem) => void;
}) {
  const { t } = useTranslation("common");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const imageUrl = cert.imageUrl ?? CERT_PLACEHOLDER;
  const hasTemplate = imageUrl !== CERT_PLACEHOLDER;

  async function handleDownload(format: "pdf" | "png") {
    setDownloading(true);
    try {
      if (format === "pdf") await downloadCertificate(cert);
      else await downloadCertificatePng(cert);
    } catch {
      toast.error(t("achievements.certificates.downloadError"));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card transition-[transform,background-color,border-color,box-shadow] duration-200 hover:-translate-y-0.5">
        <div
          className={cn(
            "h-1.5 w-full shrink-0",
            cert.type === "online"
              ? "bg-linear-to-r from-primary/80 via-primary to-primary/60"
              : "bg-linear-to-r from-on-primary-container/80 via-on-primary-container to-primary/70",
          )}
        />

        {/* Certificate preview — 4:3, name overlay, click to open lightbox */}
        <button
          type="button"
          className="group/preview relative w-full shrink-0 overflow-hidden bg-surface-raised cursor-zoom-in"
          style={{ aspectRatio: "4/3" }}
          onClick={() => setPreviewOpen(true)}
          aria-label={t("achievements.certificates.viewLarge")}
        >
          <img
            src={imageUrl}
            alt=""
            className="size-full object-cover transition-opacity duration-200 group-hover/preview:opacity-90"
          />
          {cert.holderName && hasTemplate && (
            <span
              className="pointer-events-none absolute max-w-[70%] truncate text-center font-semibold leading-tight"
              style={{
                fontSize: "clamp(0.55rem, 1.8cqw, 0.85rem)",
                left: `${cert.nameXPercent ?? 50}%`,
                top: `${cert.nameYPercent ?? 50}%`,
                transform: "translate(-50%, -50%)",
                color: cert.nameColor ?? "#000000",
              }}
            >
              {cert.holderName}
            </span>
          )}
          {/* Zoom hint on hover */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover/preview:opacity-100">
            <div className="rounded-full bg-black/40 p-2 backdrop-blur-sm">
              <ZoomIn className="size-5 text-white" aria-hidden />
            </div>
          </div>
        </button>

        <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-6">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-md sm:size-10",
                  cert.type === "online"
                    ? "bg-primary/10 text-primary"
                    : "bg-primary-muted text-primary",
                )}
              >
                <Award className="size-4 sm:size-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <span
                  className={cn(
                    "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                    cert.type === "online"
                      ? "bg-primary/10 text-primary"
                      : "bg-primary-muted text-primary",
                  )}
                >
                  {cert.type === "online"
                    ? t("achievements.certificates.type.online")
                    : t("achievements.certificates.type.offline")}
                </span>
                <p className="mt-0.5 line-clamp-1 text-xs text-foreground-muted">
                  {cert.title}
                </p>
              </div>
            </div>
            <BadgeCheck
              className="size-4 shrink-0 text-success sm:size-5"
              aria-hidden
            />
          </div>

          <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-foreground sm:text-base">
            {cert.course}
          </h3>

          <div className="mt-2 space-y-1 text-sm text-foreground-muted">
            <div className="flex items-center gap-2">
              <GraduationCap className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{cert.instructor}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="size-3.5 shrink-0" aria-hidden />
              <span>
                {t("achievements.certificates.issuedOnPrefix", {
                  date: cert.issuedAt,
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2
                className="size-3.5 shrink-0 text-success"
                aria-hidden
              />
              <span className="truncate font-mono text-xs">{cert.credentialId}</span>
            </div>
          </div>

          <div className="mt-2">
            <OcClaimBadge status={cert.ocClaimStatus} />
          </div>

          <div className="mt-3 flex min-w-0 flex-wrap items-stretch gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenModal({ kind: "cert", data: cert })}
              className={cn(
                cert.ocClaimStatus === "claimed"
                  ? "border-success/20 bg-success/10 text-success hover:bg-success/15"
                  : "border-border bg-surface-base hover:bg-surface-raised",
              )}
            >
              <img
                src="/open-campus-edu-logo.png"
                alt="OC"
                className="size-3.5 shrink-0 rounded-full sm:size-4"
              />
              <span className="truncate">
                {cert.ocClaimStatus === "claimed"
                  ? t("achievements.certificates.ocAction.view")
                  : t("achievements.certificates.ocAction.claim")}
              </span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={!hasTemplate || downloading}
                className="inline-flex size-9 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground disabled:opacity-40"
                title={t("actions.download")}
              >
                {downloading
                  ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  : <Download className="size-4 shrink-0" aria-hidden />}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void handleDownload("pdf")} className="gap-2">
                  <FileText className="size-4 shrink-0 text-foreground-muted" aria-hidden />
                  {t("achievements.certificates.downloadPdf")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleDownload("png")} className="gap-2">
                  <FileImage className="size-4 shrink-0 text-foreground-muted" aria-hidden />
                  {t("achievements.certificates.downloadPng")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <CertificatePreviewDialog
        cert={cert}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </>
  );
}

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
import { useEffect, useRef, useState } from "react";
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
import { certificateVerifyUrl } from "@/lib/certificatesEdge";
import { cn } from "@/lib/utils";

import { useAuth } from "@/stores/authStore";
import { CopyButton } from "./CopyButton";

import { CERT_PLACEHOLDER } from "../constants";
import type { CertificateItem, ModalItem } from "../types";
import {
  downloadCertificate,
  downloadCertificatePng,
  renderAndUploadCertificate,
  renderCertificateBlob,
} from "../utils/renderCertificate";
import { OcClaimBadge } from "./OcClaimBadge";

// ── Certificate lightbox ────────────────────────────────────────────────────
function CertificatePreviewDialog({
  cert,
  open,
  onOpenChange,
  onRendered,
}: {
  cert: CertificateItem;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRendered?: (url: string) => void;
}) {
  const { t } = useTranslation("common");
  const { user } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);
  const renderedUrlRef = useRef<string | null>(null);
  const imageUrl = cert.imageUrl ?? CERT_PLACEHOLDER;
  const hasTemplate = imageUrl !== CERT_PLACEHOLDER;

  // When dialog opens: render template + name → upload to CDN → use permanent URL
  // so right-click "Open in New Tab" shows the full certificate with the name.
  // Falls back to a local blob URL if the CDN upload fails.
  useEffect(() => {
    if (!open || !hasTemplate || !user?.id || !cert.courseId) return;
    let cancelled = false;

    (async () => {
      try {
        const url = await renderAndUploadCertificate(cert, user.id);
        if (url && !cancelled) {
          setRenderedUrl(url);
          onRendered?.(url);
          return;
        }
      } catch {
        // CDN upload failed — fall back to a local blob URL
        const blob = await renderCertificateBlob(cert).catch(() => null);
        if (blob && !cancelled) {
          const blobUrl = URL.createObjectURL(blob);
          renderedUrlRef.current = blobUrl;
          setRenderedUrl(blobUrl);
          onRendered?.(blobUrl);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (renderedUrlRef.current) {
        URL.revokeObjectURL(renderedUrlRef.current);
        renderedUrlRef.current = null;
      }
      setRenderedUrl(null);
    };
  }, [open, cert, hasTemplate, user?.id, onRendered]);

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
            {cert.verificationCode && (
              <div className="mt-0.5 flex items-center gap-1">
                <span className="font-mono text-xs text-foreground-muted">
                  {cert.verificationCode}
                </span>
                <CopyButton text={certificateVerifyUrl(cert.verificationCode)} />
              </div>
            )}
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

        {/* Certificate image — rendered URL has name baked in so right-click works */}
        <div className="relative w-full bg-surface-raised">
          <img
            src={renderedUrl ?? imageUrl}
            alt={cert.course}
            className="w-full h-auto object-contain"
          />
          {/* CSS overlay only shown while canvas render is in progress (renderedUrl not ready yet) */}
          {!renderedUrl && cert.holderName && hasTemplate && (
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
  // Once the dialog renders and uploads to CDN, cache that URL here too
  // so the card thumbnail also shows the rendered version with the name.
  const [renderedCardUrl, setRenderedCardUrl] = useState<string | null>(null);
  const imageUrl = cert.imageUrl ?? CERT_PLACEHOLDER;
  const hasTemplate = imageUrl !== CERT_PLACEHOLDER;
  const displayUrl = renderedCardUrl ?? imageUrl;
  // Certificate-only courses do not have an Open Campus credential to claim
  // or view. A previously minted OCA/OCB remains viewable even if its template
  // was later deactivated, hence the persisted status is also considered here.
  const hasOnchainCredentialAccess =
    cert.hasOnchainCredentialTemplate || cert.ocClaimStatus !== "unclaimed";
  const canClaimOnchainCredential =
    hasOnchainCredentialAccess &&
    !cert.onchainCredentialAutoIssued &&
    (cert.ocClaimStatus === "unclaimed" || cert.ocClaimStatus === "failed");
  const canViewOnchainCredential =
    cert.ocClaimStatus === "claimed" && Boolean(cert.ocCredentialUrl);

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

        {/* Certificate preview — name overlay, click to open lightbox */}
        <button
          type="button"
          className="group/preview relative w-full shrink-0 overflow-hidden bg-surface-raised cursor-zoom-in"
          onClick={() => setPreviewOpen(true)}
          aria-label={t("achievements.certificates.viewLarge")}
        >
          <img
            src={displayUrl}
            alt=""
            className="w-full h-auto transition-opacity duration-200 group-hover/preview:opacity-90"
          />
          {/* CSS overlay only shown before the rendered URL is available */}
          {!renderedCardUrl && cert.holderName && hasTemplate && (
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

          {hasOnchainCredentialAccess && (
            <div className="mt-2">
              <OcClaimBadge status={cert.ocClaimStatus} />
            </div>
          )}

          <div className="mt-3 flex min-w-0 flex-wrap items-stretch gap-2">
            {canViewOnchainCredential ? (
              <Button
                type="button"
                variant="outline"
                className="border-success/20 bg-success/10 text-success hover:bg-success/15"
                onClick={() =>
                  window.open(cert.ocCredentialUrl, "_blank", "noopener,noreferrer")
                }
              >
                <img
                  src="/open-campus-edu-logo.png"
                  alt="OC"
                  className="size-3.5 shrink-0 rounded-full sm:size-4"
                />
                <span className="truncate">
                  {t("achievements.certificates.ocAction.view")}
                </span>
              </Button>
            ) : canClaimOnchainCredential ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenModal({ kind: "cert", data: cert })}
                className="border-border bg-surface-base hover:bg-surface-raised"
              >
                <img
                  src="/open-campus-edu-logo.png"
                  alt="OC"
                  className="size-3.5 shrink-0 rounded-full sm:size-4"
                />
                <span className="truncate">
                  {t("achievements.certificates.ocAction.claim")}
                </span>
              </Button>
            ) : cert.ocClaimStatus === "awaiting_holder_id" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenModal({ kind: "cert", data: cert })}
                className="border-warning/30 bg-warning/10 text-warning-foreground hover:bg-warning/15"
              >
                <img
                  src="/open-campus-edu-logo.png"
                  alt="OC"
                  className="size-3.5 shrink-0 rounded-full sm:size-4"
                />
                <span className="truncate">
                  {t("achievements.oc.modal.awaitingHolder.cta")}
                </span>
              </Button>
            ) : null}
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
        onRendered={setRenderedCardUrl}
      />
    </>
  );
}

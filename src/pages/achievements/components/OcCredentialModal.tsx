import {
  AlertTriangle,
  ArrowLeft,
  Download,
  ExternalLink,
  Loader2,
  Share2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/stores/authStore";

import { BADGE_PLACEHOLDER, CERT_PLACEHOLDER } from "../constants";
import type { BadgeItem, CertificateItem, ModalItem } from "../types";
import {
  downloadBadgeImage,
  downloadCertificate,
} from "../utils/renderCertificate";
import { OcClaimBadge } from "./OcClaimBadge";

export function OcCredentialModal({
  item,
  open,
  onOpenChange,
  onClaim,
  onConnectOcid,
  claiming,
}: {
  item: ModalItem | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onClaim: (id: string, kind: "cert" | "badge") => void;
  onConnectOcid: () => void;
  claiming: boolean;
}) {
  const { t } = useTranslation("common");
  const { profile } = useAuth();
  const reviewKey = open && item ? item.data.id : null;
  const [reviewState, setReviewState] = useState<{
    key: string | null;
    reviewing: boolean;
  }>({ key: null, reviewing: false });
  const reviewing =
    reviewState.key === reviewKey ? reviewState.reviewing : false;
  const setReviewing = (next: boolean) => {
    setReviewState({ key: reviewKey, reviewing: next });
  };
  const [downloading, setDownloading] = useState(false);

  const isClaimedSafe = item?.data?.ocClaimStatus === "claimed";
  // Auto-close review screen if claim succeeds
  useEffect(() => {
    if (isClaimedSafe && reviewing) {
      setReviewState({ key: null, reviewing: false });
    }
  }, [isClaimedSafe, reviewing]);

  if (!item) return null;

  const d = item.data;
  const isClaimed = d.ocClaimStatus === "claimed";
  const isPending = d.ocClaimStatus === "pending";
  const isAwaitingHolder = d.ocClaimStatus === "awaiting_holder_id";
  const isReconciling = d.ocClaimStatus === "needs_reconciliation";
  const isFailed = d.ocClaimStatus === "failed";
  const isUnclaimed = d.ocClaimStatus === "unclaimed";



  const badgeScope = item.kind === "badge" ? (item.data as BadgeItem).credentialScope : undefined;
  const hackathonRole = item.kind === "badge" ? (item.data as BadgeItem).hackathonRole : undefined;
  const isOcb =
    item.kind === "badge" &&
    (item.data as BadgeItem).credentialScope !== "activity_milestone" &&
    ((item.data as BadgeItem).achievementType === "Badge" ||
      (item.data as BadgeItem).achievementType === "Award");

  const credentialName = item.kind === "cert" ? item.data.course : item.data.title;
  const issued =
    item.kind === "cert"
      ? item.data.issuedAt
      : (item.data as BadgeItem).earnedAt ?? "—";
  const credId =
    item.kind === "cert"
      ? item.data.credentialId
      : item.data.mintCredentialId?.trim() || `CRL-BADGE-${item.data.id}`;

  const holderName = profile?.full_name?.trim() || null;
  const holderOcid = profile?.ocid?.trim() || null;
  const hasName = Boolean(holderName);
  const hasOcid = Boolean(holderOcid);

  // ── Review step ────────────────────────────────────────────────────────────
  if (reviewing) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl w-full min-w-0 rounded-3xl p-0 overflow-hidden">
          <div className="h-1.5 w-full bg-linear-to-r from-[#00e5b4] via-[#0047ff] to-[#00e5b4]" />

          <div className="min-w-0 p-4 sm:p-6">
            <button
              onClick={() => setReviewing(false)}
              className="mb-4 flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" aria-hidden />
              {t("achievements.oc.modal.review.back")}
            </button>

            <h2 className="text-base font-semibold text-foreground sm:text-lg">
              {t("achievements.oc.modal.review.title")}
            </h2>
            <p className="mt-1 mb-5 text-sm text-foreground-muted">
              {t("achievements.oc.modal.review.subtitle")}
            </p>

            {/* Credential info preview */}
            <div className="mb-4 space-y-3 rounded-xl border border-border-subtle bg-surface-raised p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-0.5">
                  {t("achievements.oc.modal.review.credentialLabel")}
                </p>
                <p className="text-sm font-medium text-foreground">{credentialName}</p>
              </div>

              {item?.kind === "cert" && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-0.5">
                    {t("achievements.oc.modal.review.nameLabel")}
                  </p>
                  {hasName ? (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{holderName}</p>
                      <Link
                        to="/account"
                        onClick={() => onOpenChange(false)}
                        className="text-xs text-primary underline-offset-2 hover:underline shrink-0"
                      >
                        {t("achievements.oc.modal.review.editName")}
                      </Link>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
                      <p className="text-xs text-warning-foreground">
                        {t("achievements.oc.modal.review.nameMissing")}
                      </p>
                      <Link
                        to="/account"
                        onClick={() => onOpenChange(false)}
                        className="text-xs font-medium text-primary underline-offset-2 hover:underline shrink-0"
                      >
                        {t("achievements.oc.modal.review.setName")}
                      </Link>
                    </div>
                  )}
                </div>
              )}
              {/* OCID */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-0.5">
                  OCID
                </p>
                <p className="text-sm font-medium text-foreground">
                  {holderOcid
                    ? (holderOcid.endsWith(".edu") ? holderOcid : `${holderOcid}.edu`)
                    : "—"}
                </p>
              </div>
            </div>

            {!hasOcid && (
              <div className="mb-5 rounded-xl border border-warning/25 bg-warning/8 px-3 py-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-warning"
                    aria-hidden
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {t("achievements.oc.modal.connectRequired.title")}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
                      {t("achievements.oc.modal.connectRequired.body")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Permanence warning */}
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/8 px-3 py-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <p className="text-xs leading-relaxed text-foreground-muted">
                {t("achievements.oc.modal.review.permanenceWarning")}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {!hasOcid ? (
                <Button
                  className="w-full gap-3 text-base font-semibold"
                  size="lg"
                  onClick={onConnectOcid}
                >
                  <img
                    src="/open-campus-edu-logo.png"
                    alt=""
                    className="size-5 shrink-0 rounded-full brightness-0 invert"
                  />
                  <span>{t("achievements.oc.modal.connectRequired.cta")}</span>
                </Button>
              ) : (
                <Button
                  className="w-full gap-3 text-base font-semibold"
                  size="lg"
                  disabled={
                    claiming ||
                    (item.kind === "cert" && !hasName) ||
                    isClaimed ||
                    isPending ||
                    isAwaitingHolder ||
                    isReconciling
                  }
                  onClick={() => onClaim(d.id, item.kind)}
                >
                  {claiming ? (
                    <>
                      <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />
                      <span>{t("achievements.oc.modal.claim.issuing")}</span>
                    </>
                  ) : (
                    <>
                      <img
                        src="/open-campus-edu-logo.png"
                        alt=""
                        className="size-5 shrink-0 rounded-full brightness-0 invert"
                      />
                      <span>
                        {isFailed
                          ? t("achievements.oc.modal.claim.retry")
                          : t("achievements.oc.modal.review.confirm")}
                      </span>
                    </>
                  )}
                </Button>
              )}

              <button
                onClick={() => setReviewing(false)}
                className="py-2 text-sm text-foreground-muted underline-offset-4 hover:text-foreground hover:underline transition-colors"
              >
                {t("actions.cancel")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Main credential view ────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-full min-w-0 rounded-3xl p-0 overflow-hidden">
        <div className="h-1.5 w-full bg-linear-to-r from-[#00e5b4] via-[#0047ff] to-[#00e5b4]" />

        <div className="min-w-0 p-4 sm:p-6">
          <DialogHeader className="mb-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 shrink-0 min-w-[3rem] items-center justify-center overflow-hidden rounded-md bg-surface-raised border border-border-subtle sm:h-14 sm:min-w-[3.5rem]">
                <img
                  src={
                    item.data.imageUrl ||
                    (item.kind === "cert" ? CERT_PLACEHOLDER : BADGE_PLACEHOLDER)
                  }
                  alt=""
                  className="h-full w-auto object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold leading-snug sm:text-lg">
                  {t("achievements.oc.modal.title")}
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm sm:text-base">
                  {t("achievements.oc.modal.subtitle")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="mb-4 space-y-3 rounded-md border border-border-subtle bg-surface-raised p-3 sm:p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted sm:text-sm">
                {item.kind === "cert"
                  ? t("achievements.oc.modal.kind.cert")
                  : isOcb
                  ? t("achievements.oc.modal.kind.badge")
                  : badgeScope === "course"
                  ? t("achievements.oc.modal.kind.oca")
                  : badgeScope === "hackathon"
                  ? hackathonRole
                    ? `${t("achievements.oc.modal.kind.hackathonBadge")} · ${hackathonRole}`
                    : t("achievements.oc.modal.kind.hackathonBadge")
                  : badgeScope === "activity_milestone"
                  ? t("achievements.oc.modal.kind.milestone")
                  : t("achievements.oc.modal.kind.badge")}
              </p>
              <p className="mt-0.5 text-base font-semibold text-foreground sm:text-lg">
                {credentialName}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-foreground-muted sm:text-sm">
                  {item.kind === "cert"
                    ? t("achievements.oc.modal.date.issued")
                    : t("achievements.oc.modal.date.earned")}
                </p>
                <p className="font-medium">{issued}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-foreground-muted sm:text-sm">
                  Credential ID
                </p>
                <p className="font-mono text-xs font-medium truncate sm:text-sm">
                  {credId}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-foreground-muted sm:text-sm">
                {t("achievements.oc.modal.statusLabel")}
              </p>
              <OcClaimBadge status={d.ocClaimStatus} />
            </div>

            {isClaimed && (d as CertificateItem).ocHolderOcId && (
              <div className="border-t border-border pt-3">
                <p className="text-xs text-foreground-muted">OCID</p>
                <p className="text-sm font-medium text-foreground">
                  {(d as CertificateItem).ocHolderOcId}
                </p>
              </div>
            )}
          </div>

          {isClaimed && d.ocCredentialUrl && (
            <a
              href={d.ocCredentialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-4 flex min-w-0 items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 transition hover:bg-primary/10"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <img
                  src="/open-campus-edu-logo.png"
                  alt="OC"
                  className="size-5 shrink-0 rounded-full"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground sm:text-base">
                    {t("achievements.oc.modal.dashboardCtaTitle")}
                  </p>
                  <p className="text-xs text-foreground-muted sm:text-sm">
                    {t("achievements.oc.modal.dashboardCtaSubtitle")}
                  </p>
                </div>
              </div>
              <ExternalLink
                className="size-4 shrink-0 text-foreground-muted"
                aria-hidden
              />
            </a>
          )}

          {isAwaitingHolder && (
            <div className="mb-4 rounded-xl border border-warning/25 bg-warning/8 px-3 py-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t("achievements.oc.modal.awaitingHolder.title")}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
                    {t("achievements.oc.modal.awaitingHolder.body")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {isReconciling && (
            <div className="mb-4 rounded-xl border border-primary/25 bg-primary/5 px-3 py-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t("achievements.oc.modal.reconciliation.title")}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
                    {t("achievements.oc.modal.reconciliation.body")}
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="mb-4 text-xs leading-relaxed text-foreground-muted sm:text-sm">
            {t("achievements.oc.modal.standardsNote")}
          </p>

          <div className="flex flex-col gap-3 mt-2">
            {isAwaitingHolder && (
              <Button
                className="w-full gap-3 text-base font-semibold"
                size="lg"
                onClick={onConnectOcid}
              >
                <img
                  src="/open-campus-edu-logo.png"
                  alt=""
                  className="size-5 shrink-0 rounded-full brightness-0 invert"
                />
                <span>{t("achievements.oc.modal.awaitingHolder.cta")}</span>
              </Button>
            )}

            {(isUnclaimed || isFailed) && (
              <Button
                className="w-full gap-3 text-base font-semibold"
                size="lg"
                disabled={claiming}
                onClick={() => {
                  if (!hasOcid) {
                    onConnectOcid();
                    return;
                  }
                  setReviewing(true);
                }}
              >
                {claiming ? (
                  <>
                    <Loader2
                      className="size-5 shrink-0 animate-spin"
                      aria-hidden
                    />
                    <span>{t("achievements.oc.modal.claim.issuing")}</span>
                  </>
                ) : (
                  <>
                    <img
                      src="/open-campus-edu-logo.png"
                      alt=""
                      className="size-5 shrink-0 rounded-full brightness-0 invert"
                    />
                    <span>
                      {!hasOcid
                        ? t("achievements.oc.modal.connectRequired.cta")
                        : isFailed
                        ? t("achievements.oc.modal.claim.retry")
                        : t("achievements.oc.modal.claim.issue")}
                    </span>
                  </>
                )}
              </Button>
            )}

            {isPending && (
              <Button disabled className="w-full gap-3 text-base" size="lg">
                <Loader2
                  className="size-5 shrink-0 animate-spin"
                  aria-hidden
                />
                <span>{t("achievements.oc.modal.claim.pending")}</span>
              </Button>
            )}

            {isClaimed && (
              <div className="flex w-full gap-3">
                <Button
                  variant="outline"
                  className="flex-1 gap-2 text-sm sm:text-base"
                  size="lg"
                  disabled={downloading}
                  onClick={async () => {
                    setDownloading(true);
                    try {
                      if (item.kind === "cert") {
                        await downloadCertificate(d as CertificateItem);
                      } else {
                        await downloadBadgeImage(d as BadgeItem);
                      }
                    } catch (error) {
                      console.error("Failed to download", error);
                      toast.error(t("achievements.certificates.downloadError"));
                    } finally {
                      setDownloading(false);
                    }
                  }}
                >
                  {downloading ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  ) : (
                    <Download className="size-4 shrink-0" aria-hidden />
                  )}
                  <span>
                    {item.kind === "cert"
                      ? t("achievements.oc.modal.claimedActions.downloadPdf")
                      : t("achievements.certificates.downloadPng")}
                  </span>
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2 text-sm sm:text-base"
                  size="lg"
                  onClick={async () => {
                    const shareUrl = d.ocCredentialUrl || `${window.location.origin}/u/${profile?.username || ""}`;
                    const shareTitle = item.kind === "cert" ? (d as CertificateItem).course : (d as BadgeItem).title;
                    const shareText = `Tôi vừa nhận được thành tích "${shareTitle}" từ Corelia Academy trên chuỗi khối Open Campus!`;

                    if (navigator.share) {
                      try {
                        await navigator.share({
                          title: shareTitle,
                          text: shareText,
                          url: shareUrl,
                        });
                        toast.success(t("achievements.share.success", { defaultValue: "Đã chia sẻ thành công!" }));
                      } catch (err) {
                        if ((err as Error).name !== "AbortError") {
                          console.error("Error sharing:", err);
                        }
                      }
                    } else {
                      try {
                        await navigator.clipboard.writeText(shareUrl);
                        toast.success(t("achievements.share.copied", { defaultValue: "Đã sao chép liên kết vào bộ nhớ tạm!" }));
                      } catch (err) {
                        console.error("Clipboard copy failed:", err);
                        toast.error(t("achievements.share.error", { defaultValue: "Không thể sao chép liên kết." }));
                      }
                    }
                  }}
                >
                  <Share2 className="size-4 shrink-0" aria-hidden />
                  <span>{t("actions.share")}</span>
                </Button>
              </div>
            )}

            <a
              href="https://devdocs.educhain.xyz/start-building/open-campus-achievements-badges/introduction"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2 text-sm text-foreground-muted underline underline-offset-4 transition-colors hover:text-foreground"
            >
              {t("achievements.oc.modal.learnMore")}
              <ExternalLink className="size-4 shrink-0" aria-hidden />
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

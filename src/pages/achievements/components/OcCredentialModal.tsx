import {
  Download,
  ExternalLink,
  Loader2,
  Share2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { BADGE_PLACEHOLDER, CERT_PLACEHOLDER } from "../constants";
import type { BadgeItem, CertificateItem, ModalItem } from "../types";
import { CopyButton } from "./CopyButton";
import { OcClaimBadge } from "./OcClaimBadge";

export function OcCredentialModal({
  item,
  open,
  onOpenChange,
  onClaim,
  claiming,
}: {
  item: ModalItem | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onClaim: (id: string, kind: "cert" | "badge") => void;
  claiming: boolean;
}) {
  const { t } = useTranslation("common");
  if (!item) return null;

  const d = item.data;
  const isClaimed = d.ocClaimStatus === "claimed";
  const isPending = d.ocClaimStatus === "pending";
  const isFailed = d.ocClaimStatus === "failed";
  const isUnclaimed = d.ocClaimStatus === "unclaimed";

  const name = item.kind === "cert" ? item.data.course : item.data.title;
  const issued =
    item.kind === "cert"
      ? item.data.issuedAt
      : (item.data as BadgeItem).earnedAt ?? "—";
  const credId =
    item.kind === "cert" ? item.data.credentialId : `CRL-BADGE-${item.data.id}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-full min-w-0 rounded-lg p-0 overflow-hidden">
        <div className="h-1.5 w-full bg-linear-to-r from-[#00e5b4] via-[#0047ff] to-[#00e5b4]" />

        <div className="min-w-0 p-4 sm:p-6">
          <DialogHeader className="mb-4">
            <div className="flex items-start gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted border border-border-subtle sm:size-14">
                <img
                  src={
                    item.data.imageUrl ||
                    (item.kind === "cert" ? CERT_PLACEHOLDER : BADGE_PLACEHOLDER)
                  }
                  alt=""
                  className="size-full object-cover"
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

          <div className="mb-4 space-y-3 rounded-md border border-border-subtle bg-muted/40 p-3 sm:p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:text-sm">
                {item.kind === "cert"
                  ? t("achievements.oc.modal.kind.cert")
                  : t("achievements.oc.modal.kind.badge")}
              </p>
              <p className="mt-0.5 text-base font-semibold text-foreground sm:text-lg">
                {name}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {item.kind === "cert"
                    ? t("achievements.oc.modal.date.issued")
                    : t("achievements.oc.modal.date.earned")}
                </p>
                <p className="font-medium">{issued}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Credential ID
                </p>
                <p className="font-mono text-xs font-medium truncate sm:text-sm">
                  {credId}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-muted-foreground sm:text-sm">
                {t("achievements.oc.modal.statusLabel")}
              </p>
              <OcClaimBadge status={d.ocClaimStatus} />
            </div>

            {isClaimed && d.ocTransactionHash && (
              <div className="space-y-2 border-t border-border pt-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    Transaction Hash
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate font-mono text-xs text-foreground sm:text-sm">
                      {d.ocTransactionHash}
                    </p>
                    <CopyButton text={d.ocTransactionHash} />
                    <a
                      href={`https://opencampus-codex.blockscout.com/tx/${d.ocTransactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      title={t("achievements.oc.modal.explorerTooltip")}
                    >
                      <ExternalLink className="size-4" aria-hidden />
                    </a>
                  </div>
                </div>
                {(d as CertificateItem).ocHolderOcId && (
                  <div>
                    <p className="text-xs text-muted-foreground">OCID</p>
                    <p className="text-sm font-medium text-foreground">
                      {(d as CertificateItem).ocHolderOcId}
                    </p>
                  </div>
                )}
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
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    {t("achievements.oc.modal.dashboardCtaSubtitle")}
                  </p>
                </div>
              </div>
              <ExternalLink
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </a>
          )}

          <p className="mb-4 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {t("achievements.oc.modal.standardsNote")}
          </p>

          <div className="flex flex-col gap-3 mt-2">
            {(isUnclaimed || isFailed) && (
              <Button
                className="w-full gap-3 text-base font-semibold"
                size="lg"
                disabled={claiming}
                onClick={() => onClaim(d.id, item.kind)}
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
                      {isFailed
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
                >
                  <Download className="size-4 shrink-0" aria-hidden />
                  <span>
                    {t("achievements.oc.modal.claimedActions.downloadPdf")}
                  </span>
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2 text-sm sm:text-base"
                  size="lg"
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
              className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
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

import { BadgeCheck, Lock, Loader2, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { BADGE_PLACEHOLDER } from "../constants";
import type { BadgeItem, ModalItem } from "../types";
import { OcClaimBadge } from "./OcClaimBadge";
import { callCoreliaApi } from "@/lib/coreliaEdgeApi";
import { toast } from "sonner";

export function BadgeCard({
  badge,
  onOpenModal,
}: {
  badge: BadgeItem;
  onOpenModal: (item: ModalItem) => void;
}) {
  const { t } = useTranslation("common");
  const [retrying, setRetrying] = useState(false);
  const imageUrl = badge.imageUrl ?? BADGE_PLACEHOLDER;
  const isPending = badge.ocClaimStatus === "pending" || retrying;
  const isAwaitingHolder = badge.ocClaimStatus === "awaiting_holder_id";
  const isReconciling = badge.ocClaimStatus === "needs_reconciliation";
  const isFailed = badge.ocClaimStatus === "failed";

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!badge.issuanceId || retrying) return;
    setRetrying(true);
    try {
      const result = await callCoreliaApi<{
        status: string;
        ocCredentialId: string | null;
        message?: string;
      }>("credentials.retryPending", { issuanceId: badge.issuanceId });
      if (result.status === "failed") {
        toast.error(t("achievements.sync.retryError"));
        return;
      }
      window.dispatchEvent(new Event("corelia:credential-sync"));
      if (result.status === "minted" && !result.ocCredentialId?.trim()) {
        toast.info(t("achievements.oc.modal.reconciliation.title"));
      } else {
        toast.success(t("achievements.sync.retrySuccess"));
      }
    } catch (error) {
      console.error("[achievements] credential retry failed", error);
      toast.error(t("achievements.sync.retryError"));
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      className={cn(
        "group relative flex min-w-0 flex-col items-center gap-2 rounded-md border p-3 text-center transition-[transform,background-color,border-color,box-shadow] duration-200 sm:gap-3 sm:p-4",
        badge.locked
          ? "border-border bg-surface-raised opacity-60 grayscale"
          : isFailed
          ? "border-red-500/50 bg-red-500/10 cursor-pointer"
          : cn(
              badge.bgColor,
              badge.borderColor,
              "cursor-pointer hover:-translate-y-0.5",
            ),
      )}
      onClick={() => {
        if (!badge.locked && !isPending) {
          if (
            badge.collectionSymbol === "ocbadge" &&
            badge.ocClaimStatus === "claimed" &&
            badge.ocCredentialUrl
          ) {
            window.open(badge.ocCredentialUrl, "_blank", "noopener,noreferrer");
            return;
          }
          onOpenModal({ kind: "badge", data: badge });
        }
      }}
    >
      {badge.locked && (
        <div className="absolute right-2 top-2 sm:right-3 sm:top-3">
          <Lock className="size-4 text-foreground-muted sm:size-5" />
        </div>
      )}

      {!badge.locked && (
        <div className="absolute left-2 top-2 sm:left-3 sm:top-3">
          {badge.ocClaimStatus === "claimed" ? (
            <span title={t("achievements.badges.ocDot.claimedTooltip")}>
              <BadgeCheck
                className="size-4 text-success sm:size-5"
                aria-hidden
              />
            </span>
          ) : isFailed ? (
            <span title={t("achievements.badges.ocDot.failedTooltip")}>
              <AlertCircle
                className="size-4 text-red-500 sm:size-5"
                aria-hidden
              />
            </span>
          ) : (
            <span title={t("achievements.badges.ocDot.unclaimedTooltip")}>
              <img
                src="/open-campus-edu-logo.png"
                alt="OC"
                className={cn("size-4 rounded-full sm:size-5", isPending ? "animate-pulse opacity-100" : "opacity-50")}
              />
            </span>
          )}
        </div>
      )}

      <div
        className={cn(
          "relative h-14 min-w-[3.5rem] shrink-0 overflow-hidden rounded-md border-2 sm:h-20 sm:min-w-[5rem]",
          badge.locked
            ? "border-border bg-surface-raised"
            : cn("border-2", badge.borderColor, badge.bgColor),
        )}
      >
        <img
          src={imageUrl}
          alt=""
          className={cn(
            "h-full w-auto object-contain transition-opacity duration-200 group-hover:opacity-95",
            badge.locked && "opacity-60",
            isPending && "opacity-60"
          )}
        />
        {badge.locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-raised/70">
            {badge.icon}
          </div>
        )}
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[2px]">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-0.5">
        <p
          className={cn(
            "text-xs font-semibold sm:text-sm",
            badge.locked ? "text-foreground-muted" : "text-foreground",
          )}
        >
          {badge.title}
        </p>
        <p className="line-clamp-2 text-xs text-foreground-muted">
          {badge.description}
        </p>
        {!badge.locked && badge.earnedAt && !isPending && (
          <p className={cn("text-xs font-medium", isFailed ? "text-red-500" : badge.color)}>
            {isFailed 
              ? t("achievements.badges.failedPrefix")
              : t("achievements.badges.earnedPrefix", { date: badge.earnedAt })}
          </p>
        )}
        {!badge.locked && isPending && (
          <p className="text-xs font-medium text-primary animate-pulse">
            {t("achievements.badges.pendingPrefix")}
          </p>
        )}
        {!badge.locked && isAwaitingHolder && (
          <p className="text-xs font-medium text-warning">
            {t("achievements.oc.badge.awaitingHolder")}
          </p>
        )}
        {!badge.locked && isReconciling && (
          <p className="text-xs font-medium text-primary">
            {t("achievements.oc.badge.reconciling")}
          </p>
        )}
        {badge.locked && (
          <span className="inline-block rounded-full border border-border bg-surface-base px-2 py-0.5 text-xs text-foreground-muted">
            {t("achievements.badges.locked")}
          </span>
        )}
      </div>

      {!badge.locked && (
        <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-2 sm:justify-between">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
              isFailed ? "text-red-500 bg-red-500/10" : badge.color,
              isFailed ? "" : badge.bgColor,
            )}
          >
            {badge.credentialScope === "course"
              ? badge.achievementType === "Badge" || badge.achievementType === "Award"
                ? t("achievements.credentialType.badge", { defaultValue: "Badge" })
                : t("achievements.credentialType.oca", { defaultValue: "OCA" })
              : badge.credentialScope === "hackathon"
              ? badge.hackathonRole
                ? badge.hackathonRole
                : t("achievements.credentialType.badge", { defaultValue: "Badge" })
              : badge.credentialScope === "activity_milestone"
              ? t("achievements.credentialType.milestone", { defaultValue: "Milestone" })
              : t(`achievements.badgeCategory.${badge.category}` as never)}
          </span>
          {isFailed ? (
            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying}
              className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-[10px] sm:text-xs font-medium rounded transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {retrying && <Loader2 className="size-3 animate-spin" />}
              {t("achievements.badges.retry")}
            </button>
          ) : (
            <OcClaimBadge status={badge.ocClaimStatus} />
          )}
        </div>
      )}
    </div>
  );
}

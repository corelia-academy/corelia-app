import { BadgeCheck, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

import { BADGE_PLACEHOLDER } from "../constants";
import type { BadgeItem, ModalItem } from "../types";
import { OcClaimBadge } from "./OcClaimBadge";

export function BadgeCard({
  badge,
  onOpenModal,
}: {
  badge: BadgeItem;
  onOpenModal: (item: ModalItem) => void;
}) {
  const { t } = useTranslation("common");
  const imageUrl = badge.imageUrl ?? BADGE_PLACEHOLDER;
  return (
    <div
      className={cn(
        "group relative flex min-w-0 flex-col items-center gap-2 rounded-md border p-3 text-center transition-[transform,background-color,border-color,box-shadow] duration-200 sm:gap-3 sm:p-4",
        badge.locked
          ? "border-border bg-surface-raised opacity-60 grayscale"
          : cn(
              badge.bgColor,
              badge.borderColor,
              "cursor-pointer hover:-translate-y-0.5",
            ),
      )}
      onClick={() =>
        !badge.locked && onOpenModal({ kind: "badge", data: badge })
      }
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
          ) : (
            <span title={t("achievements.badges.ocDot.unclaimedTooltip")}>
              <img
                src="/open-campus-edu-logo.png"
                alt="OC"
                className="size-4 rounded-full opacity-50 sm:size-5"
              />
            </span>
          )}
        </div>
      )}

      <div
        className={cn(
          "relative size-14 overflow-hidden rounded-md border-2 sm:size-20",
          badge.locked
            ? "border-border bg-surface-raised"
            : cn("border-2", badge.borderColor, badge.bgColor),
        )}
      >
        <img
          src={imageUrl}
          alt=""
          className={cn(
            "size-full object-cover transition-opacity duration-200 group-hover:opacity-95",
            badge.locked && "opacity-60",
          )}
        />
        {badge.locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-raised/70">
            {badge.icon}
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
        {!badge.locked && badge.earnedAt && (
          <p className={cn("text-xs font-medium", badge.color)}>
            {t("achievements.badges.earnedPrefix", { date: badge.earnedAt })}
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
              badge.color,
              badge.bgColor,
            )}
          >
            {badge.credentialScope === "course"
              ? t("achievements.credentialType.oca", { defaultValue: "OCA" })
              : badge.credentialScope === "hackathon"
              ? badge.hackathonRole
                ? badge.hackathonRole
                : t("achievements.credentialType.badge", { defaultValue: "Badge" })
              : badge.credentialScope === "activity_milestone"
              ? t("achievements.credentialType.milestone", { defaultValue: "Milestone" })
              : t(`achievements.badgeCategory.${badge.category}` as never)}
          </span>
          <OcClaimBadge status={badge.ocClaimStatus} />
        </div>
      )}
    </div>
  );
}

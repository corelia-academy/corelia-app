import {
  AlertTriangle,
  BadgeCheck,
  Loader2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

import type { ClaimStatus } from "../types";

export function OcClaimBadge({ status }: { status: ClaimStatus }) {
  const { t } = useTranslation("common");
  const base =
    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold sm:text-sm";
  if (status === "claimed") {
    return (
      <span className={cn(base, "bg-success/15 text-success")}>
        <BadgeCheck className="size-3.5 shrink-0 sm:size-4" aria-hidden />
        {t("achievements.oc.badge.claimed")}
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className={cn(base, "bg-warning/15 text-warning")}>
        <Loader2
          className="size-3.5 shrink-0 animate-spin sm:size-4"
          aria-hidden
        />
        {t("achievements.oc.badge.pending")}
      </span>
    );
  }
  if (status === "awaiting_holder_id") {
    return (
      <span className={cn(base, "bg-warning/15 text-warning")}>
        <AlertTriangle className="size-3.5 shrink-0 sm:size-4" aria-hidden />
        {t("achievements.oc.badge.awaitingHolder")}
      </span>
    );
  }
  if (status === "needs_reconciliation") {
    return (
      <span className={cn(base, "bg-primary/10 text-primary")}>
        <AlertTriangle className="size-3.5 shrink-0 sm:size-4" aria-hidden />
        {t("achievements.oc.badge.reconciling")}
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className={cn(base, "bg-destructive/15 text-destructive")}>
        <AlertTriangle className="size-3.5 shrink-0 sm:size-4" aria-hidden />
        {t("achievements.oc.badge.failed")}
      </span>
    );
  }
  return (
    <span className={cn(base, "bg-surface-raised font-medium text-foreground-muted")}>
      <img
        src="/open-campus-edu-logo.png"
        alt="OC"
        className="size-3.5 shrink-0 rounded-full sm:size-4"
      />
      {t("achievements.oc.badge.unclaimed")}
    </span>
  );
}

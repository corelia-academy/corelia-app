import { Gauge, Sparkles, Zap } from "lucide-react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { CoraQuotaInfo } from "@/hooks/useCoraAI";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/authStore";

function normalizeTierLabel(tier: string) {
  if (tier === "student" || tier === "pro" || tier === "bootcamp") return tier;
  return "free";
}

export function CoraPlanSummary({
  quotaInfo,
  className,
}: {
  quotaInfo?: CoraQuotaInfo | null;
  className?: string;
}) {
  const { t } = useTranslation("common");
  const { aiSubscription, daysUntilExpiry } = useAuth();

  const planTier = normalizeTierLabel(
    aiSubscription?.tier ?? quotaInfo?.tier ?? "free",
  );
  const usageLimit = quotaInfo?.monthlyLimit ?? null;
  const usageUsed = quotaInfo?.monthlyUsed ?? 0;
  const isFree = planTier === "free";

  return (
    <div
      className={cn(
        "rounded-xl border border-border-subtle bg-surface-raised px-3 py-2.5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              <Sparkles className="size-3" aria-hidden />
              {t(`coraWidget.plan.tiers.${planTier}`)}
            </span>
            {quotaInfo?.throttled ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                <Zap className="size-3" aria-hidden />
                {t("coraWidget.plan.throttled")}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-foreground-muted">
            {usageLimit != null
              ? t("coraWidget.plan.usage", {
                  used: usageUsed,
                  limit: usageLimit,
                })
              : t("coraWidget.plan.usageFlexible")}
          </p>
          {aiSubscription?.expires_at ? (
            <p className="mt-1 text-[11px] leading-snug text-foreground-muted">
              {t("coraWidget.plan.expiry", {
                days: Math.max(daysUntilExpiry ?? 0, 0),
              })}
            </p>
          ) : null}
        </div>
        <div className="shrink-0">
          <Button
            render={<NavLink to="/cora" />}
            nativeButton={false}
            variant={isFree ? "default" : "outline"}
            size="xs"
          >
            {isFree ? t("coraWidget.plan.upgradeAction") : t("coraWidget.plan.manageAction")}
          </Button>
        </div>
      </div>
      {quotaInfo?.windowSoftCap != null ? (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-foreground-muted">
          <Gauge className="size-3 shrink-0" aria-hidden />
          <span>
            {t("coraWidget.plan.windowUsage", {
              used: quotaInfo.windowUsed,
              cap: quotaInfo.windowSoftCap,
              hours: quotaInfo.windowHours,
            })}
          </span>
        </div>
      ) : null}
    </div>
  );
}

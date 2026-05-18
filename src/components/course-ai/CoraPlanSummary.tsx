import { Gauge, Sparkles } from "lucide-react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { CORA_AI_TUTOR_LOGO_SRC } from "@/components/course-ai/constants";
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
    <div className={cn("py-2", className)}>
      {/* logo + name + plan badge */}
      <div className="flex items-center gap-2.5">
        <img
          src={CORA_AI_TUTOR_LOGO_SRC}
          alt="Cora AI"
          className="size-8 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold leading-none text-foreground">
              Cora AI
            </p>
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              <Sparkles className="size-3" aria-hidden />
              {t(`coraWidget.plan.tiers.${planTier}`)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-foreground-subtle">
            {usageLimit != null ? (
              <span>
                {usageUsed} / {usageLimit} messages
              </span>
            ) : null}
            {aiSubscription?.expires_at ? (
              <span>{Math.max(daysUntilExpiry ?? 0, 0)}d left</span>
            ) : null}
            {quotaInfo?.windowSoftCap != null ? (
              <span className="flex items-center gap-1">
                <Gauge className="size-3 shrink-0" aria-hidden />
                {quotaInfo.windowUsed}/{quotaInfo.windowSoftCap}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* upgrade / manage action */}
      <Button
        render={<NavLink to="/cora" />}
        nativeButton={false}
        size="xs"
        className="mt-2.5 w-full"
      >
        {isFree
          ? t("coraWidget.plan.upgradeAction")
          : t("coraWidget.plan.manageAction")}
      </Button>
    </div>
  );
}

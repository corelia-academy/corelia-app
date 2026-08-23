import { Sparkles } from "lucide-react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { CORA_AI_TUTOR_LOGO_SRC } from "@/components/course-ai/constants";
import type { CoraQuotaInfo } from "@/hooks/useCoraAI";
import { resolveEffectiveAiTier } from "@/lib/payments";
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
    resolveEffectiveAiTier(aiSubscription),
  );

  const usageLimit = quotaInfo?.successfulMessageLimit ?? null;
  const usageUsed = quotaInfo?.successfulMessagesUsed ?? 0;

  const msgPct = usageLimit ? usageUsed / usageLimit : 0;
  const usedPct = msgPct;

  const isExceeded = usedPct >= 1;
  const isNearing = usedPct >= 0.7 && !isExceeded;
  const isFree = planTier === "free";

  const resetDate = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    1,
  );
  const resetStr = resetDate.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
  });
  const daysLeft = Math.max(daysUntilExpiry ?? 0, 0);

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

          {/* Status line — 3 states */}
          <div className="mt-1 text-[11px] leading-snug text-foreground-subtle">
            {isExceeded ? (
              <span className="text-foreground-muted">
                {t("coraWidget.plan.quotaExceeded")} ·{" "}
                {t("coraWidget.plan.resetDate", { date: resetStr })}
              </span>
            ) : isNearing ? (
              <span className="text-warning">
                {t("coraWidget.plan.nearingLimit")} ·{" "}
                {t("coraWidget.plan.resetDate", { date: resetStr })}
              </span>
            ) : (
              <span>
                {usageLimit != null
                  ? t("coraWidget.plan.messagesThisMonth", { count: usageUsed })
                  : null}
                {aiSubscription?.expires_at
                  ? (usageLimit != null ? " · " : "") +
                    t("coraWidget.plan.daysLeft", { count: daysLeft })
                  : null}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* CTA button */}
      <Button
        render={<NavLink to="/cora" />}
        nativeButton={false}
        size="xs"
        className="mt-2.5 w-full"
        variant={isExceeded || isNearing ? "outline" : "default"}
      >
        {isFree || isExceeded || isNearing
          ? t("coraWidget.plan.upgradeAction")
          : t("coraWidget.plan.manageAction")}
      </Button>
    </div>
  );
}

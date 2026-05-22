import { Sparkles } from "lucide-react";
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

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
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

  const quotaUnit = quotaInfo?.quotaUnit ?? "message";
  const useTokenDisplay = quotaUnit === "token";

  // Token display
  const tokenUsed = quotaInfo?.monthlyTokensUsed ?? 0;
  const tokenLimit = quotaInfo?.monthlyTokensLimit ?? null;

  // Message display (fallback / migration period)
  const usageLimit = quotaInfo?.monthlyLimit ?? null;
  const usageUsed = quotaInfo?.monthlyUsed ?? 0;

  const msgPct = usageLimit ? usageUsed / usageLimit : 0;
  const tokenPct = tokenLimit ? tokenUsed / tokenLimit : 0;
  const usedPct = useTokenDisplay
    ? tokenPct
    : quotaUnit === "both"
      ? Math.max(msgPct, tokenPct)  // show worst-case during dual-enforce window
      : msgPct;

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
              <span className="text-amber-600 dark:text-amber-400">
                {t("coraWidget.plan.nearingLimit")} ·{" "}
                {t("coraWidget.plan.resetDate", { date: resetStr })}
              </span>
            ) : (
              <span>
                {useTokenDisplay && tokenLimit != null
                  ? t("coraWidget.plan.tokensThisMonth", {
                      count: `${formatTokenCount(tokenUsed)} / ${formatTokenCount(tokenLimit)}`,
                    })
                  : usageLimit != null
                    ? t("coraWidget.plan.messagesThisMonth", { count: usageUsed })
                    : null}
                {aiSubscription?.expires_at
                  ? ((useTokenDisplay ? tokenLimit : usageLimit) != null ? " · " : "") +
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

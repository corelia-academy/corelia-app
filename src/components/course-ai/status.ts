import type { TFunction } from "i18next";

import type { CoraQuotaInfo } from "@/hooks/useCoraAI";
import type { AiSubscription } from "@/lib/payments";

function normalizeTierLabel(tier: string) {
  if (tier === "student" || tier === "pro" || tier === "bootcamp") return tier;
  return "free";
}

export function getCoraStatusLabel(args: {
  t: TFunction;
  quotaInfo?: CoraQuotaInfo | null;
  aiSubscription?: AiSubscription | null;
  daysUntilExpiry?: number | null;
}) {
  const { t, quotaInfo, aiSubscription, daysUntilExpiry } = args;
  const tier = normalizeTierLabel(aiSubscription?.tier ?? quotaInfo?.tier ?? "free");

  if (typeof daysUntilExpiry === "number" && daysUntilExpiry >= 0 && daysUntilExpiry <= 7) {
    return String(
      t("coraWidget.statusByTier.expiringSoon", {
        tier: t(`coraWidget.plan.tiers.${tier}`),
        days: daysUntilExpiry,
      }),
    );
  }

  if (quotaInfo?.throttled) {
    return String(
      t("coraWidget.statusByTier.throttled", {
        tier: t(`coraWidget.plan.tiers.${tier}`),
      }),
    );
  }

  return String(
    t("coraWidget.statusByTier.default", {
      tier: t(`coraWidget.plan.tiers.${tier}`),
    }),
  );
}

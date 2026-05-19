import { BookOpen, RotateCcw } from "lucide-react";
import { NavLink } from "react-router";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AiSubscriptionTier } from "@/lib/payments";

const TIER_RANK: Record<AiSubscriptionTier, number> = { student: 1, pro: 2, bootcamp: 3 };
const TIER_PRICES: Record<AiSubscriptionTier, number> = { student: 79_000, pro: 149_000, bootcamp: 399_000 };
const TIER_MSGS: Record<AiSubscriptionTier, string> = { student: "700", pro: "1.000", bootcamp: "2.000" };

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
}

export function QuotaExceededPrompt({
  title,
  subtitle,
  currentTier,
  resetDate,
  onRetry,
  className,
}: {
  title: string;
  subtitle: string;
  currentTier?: string;
  resetDate?: Date;
  onRetry?: () => void;
  className?: string;
}) {
  const currentRank = currentTier ? (TIER_RANK[currentTier as AiSubscriptionTier] ?? 0) : 0;
  const upgradeTiers = (["student", "pro", "bootcamp"] as AiSubscriptionTier[]).filter(
    (tier) => (TIER_RANK[tier] ?? 0) > currentRank,
  );

  const resetStr = resetDate
    ? resetDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  return (
    <div
      className={cn(
        "rounded-lg border border-border-subtle bg-surface-raised px-3 py-3 text-sm",
        className,
      )}
    >
      <div className="flex gap-2">
        <BookOpen className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0">
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-1 text-[11px] leading-snug text-foreground-muted">
            {resetStr ? subtitle.replace("{{resetDate}}", resetStr) : subtitle}
          </p>
        </div>
      </div>

      {upgradeTiers.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {upgradeTiers.map((tier) => (
            <Button
              key={tier}
              render={<NavLink to={`/cora?tier=${tier}`} />}
              nativeButton={false}
              size="sm"
              variant={tier === upgradeTiers[0] ? "default" : "outline"}
            >
              {tier.charAt(0).toUpperCase() + tier.slice(1)} · {formatVnd(TIER_PRICES[tier])}/tháng · {TIER_MSGS[tier]} câu hỏi
            </Button>
          ))}
        </div>
      ) : null}

      {onRetry ? (
        <div className="mt-2 flex justify-end">
          <Button type="button" size="sm" variant="ghost" onClick={onRetry}>
            <RotateCcw className="size-3.5" />
            Thử lại
          </Button>
        </div>
      ) : null}
    </div>
  );
}

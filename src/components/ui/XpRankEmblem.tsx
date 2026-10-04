import type { XpRankCode } from "@/lib/xpRanks";

import xpNoRankBadgeOverlay from "@/assets/illustrations/xp-no-rank-badge-overlay.png";
import xpBronzeBadge from "@/assets/illustrations/xp-bronze-badge.png";
import xpSilverBadge from "@/assets/illustrations/xp-silver-badge.png";
import { cn } from "@/lib/utils";

const badgeByRank: Partial<Record<XpRankCode, string>> = {
  bronze: xpBronzeBadge,
  silver: xpSilverBadge,
};

const sizeClasses = {
  small: "size-20",
  medium: "size-40",
  large: "size-50",
} as const;

export type XpRankEmblemSize = keyof typeof sizeClasses;

export function XpRankEmblem({
  rank,
  size = "medium",
  className,
}: {
  rank: XpRankCode;
  size?: XpRankEmblemSize;
  className?: string;
}) {
  return (
    <img
      src={badgeByRank[rank] ?? xpNoRankBadgeOverlay}
      alt=""
      aria-hidden="true"
      className={cn(sizeClasses[size], "object-contain", className)}
    />
  );
}

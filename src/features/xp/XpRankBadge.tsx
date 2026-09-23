import { Award } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getXpRank, type XpRankCode } from "@/lib/xpRanks";
import { cn } from "@/lib/utils";

const rankClasses: Record<XpRankCode, string> = {
  starter: "bg-muted text-muted-foreground",
  bronze: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  silver: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  gold: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  platinum: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
  diamond: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
};

export function XpRankBadge({ total, className }: { total: number | null | undefined; className?: string }) {
  const { t } = useTranslation("account");
  if (total == null || !Number.isFinite(total)) return null;
  const { current } = getXpRank(total);
  return <span className={cn("inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", rankClasses[current.code], className)}>
    <Award className="size-3 shrink-0" aria-hidden />{t(`xp.rank.names.${current.code}`)}
  </span>;
}

import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

export function XpBadge({ total, className = "" }: { total: number | null | undefined; className?: string }) {
  const { i18n } = useTranslation();
  if (total == null) return null;
  return <span className={`inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary ${className}`} aria-label={`${new Intl.NumberFormat(i18n.language === "vi" ? "vi-VN" : "en-US").format(total)} XP`}>
    <Sparkles className="size-3" aria-hidden />{new Intl.NumberFormat(i18n.language === "vi" ? "vi-VN" : "en-US").format(total)} XP
  </span>;
}

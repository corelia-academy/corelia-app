import { useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getXpRank, XP_RANKS } from "@/lib/xpRanks";
import { XpRankBadge } from "./XpRankBadge";

export function XpRankProgress({ total }: { total: number }) {
  const { t, i18n } = useTranslation("account");
  const [open, setOpen] = useState(false);
  const rank = getXpRank(total);
  const format = (value: number) => new Intl.NumberFormat(i18n.language).format(value);
  return <section className="space-y-3 rounded-xl border border-border-subtle p-4" aria-label={t("xp.rank.title")}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{t("xp.rank.title")}</h3><XpRankBadge total={total} /></div>
    <div role="progressbar" aria-label={t("xp.rank.progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rank.progress)} className="h-2 overflow-hidden rounded-full bg-primary/10">
      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${rank.progress}%` }} />
    </div>
    <p className="text-sm text-foreground-muted">{rank.next ? t("xp.rank.remaining", { xp: format(rank.remaining), rank: t(`xp.rank.names.${rank.next.code}`) }) : t("xp.rank.highest")}</p>
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>{t("xp.rank.allRanks")}</Button>
      <NavLink to="/feed?tab=leaderboard" className="rounded text-sm text-primary underline underline-offset-4 focus-visible:outline-2">{t("xp.leaderboard.title")}</NavLink>
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t("xp.rank.allRanks")}</DialogTitle><DialogDescription>{t("xp.rank.description")}</DialogDescription></DialogHeader>
        <ul className="space-y-3">{XP_RANKS.map(item => <li key={item.code} className="flex items-center justify-between gap-3"><XpRankBadge total={item.minimum} /><span className="text-sm tabular-nums">{format(item.minimum)} XP</span></li>)}</ul>
      </DialogContent>
    </Dialog>
  </section>;
}

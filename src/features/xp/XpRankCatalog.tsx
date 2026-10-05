import { useTranslation } from "react-i18next";

import { XP_RANKS } from "@/lib/xpRanks";

import { XpRankBadge } from "./XpRankBadge";

export function XpRankCatalog() {
  const { i18n } = useTranslation("account");
  const format = (value: number) => new Intl.NumberFormat(i18n.language).format(value);

  return (
    <ul className="space-y-3">
      {XP_RANKS.map((item) => (
        <li
          key={item.code}
          className="flex items-center justify-between gap-3"
        >
          <XpRankBadge total={item.minimum} />
          <span className="text-sm tabular-nums">{format(item.minimum)} XP</span>
        </li>
      ))}
    </ul>
  );
}

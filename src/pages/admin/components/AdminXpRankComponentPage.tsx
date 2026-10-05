import { useTranslation } from "react-i18next";

import { XpRankEmblem, type XpRankEmblemSize } from "@/components/ui/XpRankEmblem";
import { XpRankBadge } from "@/features/xp/XpRankBadge";
import { XP_RANKS } from "@/lib/xpRanks";

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout";

const sizes = [
  { size: "small", key: "small" },
  { size: "medium", key: "medium" },
  { size: "large", key: "large" },
] as const satisfies ReadonlyArray<{
  size: XpRankEmblemSize;
  key: string;
}>;

export default function AdminXpRankComponentPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const { t, i18n } = useTranslation("common");
  const formatXp = (value: number) =>
    new Intl.NumberFormat(i18n.language).format(value);

  return (
    <ComponentShowcaseLayout
      title={t("componentShowcase.xpRank.title")}
      description={t("componentShowcase.xpRank.description")}
      embedded={embedded}
    >
      <ShowcaseSection
        title={t("componentShowcase.xpRank.combinationsTitle")}
        criterion={t("componentShowcase.xpRank.criterion")}
      >
        <div className="overflow-x-auto pb-2" data-testid="xp-rank-emblem-showcase">
          <table
            aria-label={t("componentShowcase.xpRank.tableLabel")}
            className="w-full min-w-[820px] border-separate border-spacing-y-3"
          >
            <thead>
              <tr className="text-left text-body-small text-foreground-muted">
                <th scope="col" className="px-4 py-2">
                  {t("componentShowcase.xpRank.rank")}
                </th>
                {sizes.map(({ size, key }) => (
                  <th key={size} scope="col" className="px-4 py-2 text-center">
                    {t(`componentShowcase.xpRank.sizes.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {XP_RANKS.map((rank) => (
                <tr key={rank.code}>
                  <th
                    scope="row"
                    className="rounded-l-lg bg-surface-base px-4 py-3 text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <XpRankBadge total={rank.minimum} />
                      <span className="text-body-small tabular-nums">
                        {formatXp(rank.minimum)} XP
                      </span>
                    </div>
                  </th>
                  {sizes.map(({ size }) => (
                    <td
                      key={size}
                      className="bg-surface-base px-4 py-3 text-center last:rounded-r-lg"
                    >
                      <div className="flex justify-center">
                        <XpRankEmblem rank={rank.code} size={size} />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ShowcaseSection>
    </ComponentShowcaseLayout>
  );
}

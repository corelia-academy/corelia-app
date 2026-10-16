import { XpRankEmblem, type XpRankEmblemSize } from "@/components/ui/XpRankEmblem";
import { XpRankBadge } from "@/features/xp/XpRankBadge";
import { XP_RANKS } from "@/lib/xpRanks";

import { ComponentShowcaseLayout, ShowcaseSection } from "./ComponentShowcaseLayout";

const sizes = [
  { size: "small", label: "Small · 80 px" },
  { size: "medium", label: "Medium · 160 px" },
  { size: "large", label: "Large · 200 px" },
] as const satisfies ReadonlyArray<{
  size: XpRankEmblemSize;
  label: string;
}>;

export default function AdminXpRankComponentPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const formatXp = (value: number) => new Intl.NumberFormat("en-US").format(value);

  return (
    <ComponentShowcaseLayout
      title="XP rank badges"
      description="Compare badge artwork by rank and size."
      embedded={embedded}
    >
      <ShowcaseSection
        title="All rank and size combinations"
        criterion="All six ranks at 80, 160, and 200 px; ranks without artwork use the question-mark badge."
      >
        <div className="overflow-x-auto pb-2" data-testid="xp-rank-emblem-showcase">
          <table
            aria-label="XP badges by rank and size"
            className="w-full min-w-[820px] border-separate border-spacing-y-3"
          >
            <thead>
              <tr className="text-left text-body-small text-foreground-muted">
                <th scope="col" className="px-4 py-2">
                  Rank
                </th>
                {sizes.map(({ size, label }) => (
                  <th key={size} scope="col" className="px-4 py-2 text-center">
                    {label}
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

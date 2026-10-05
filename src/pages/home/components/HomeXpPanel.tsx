import { useQuery } from "@tanstack/react-query";
import { MonitorPlay } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

import xpPanelBackground from "@/assets/illustrations/xp-panel-background.svg";
import { ProgressBar } from "@/components/ui/progress";
import { XpRankEmblem } from "@/components/ui/XpRankEmblem";

import { getXpTotals } from "@/lib/xp";
import { getXpRank, XP_RANKS } from "@/lib/xpRanks";

export function HomeXpPanel({ userId }: { userId: string | undefined }) {
  const { t: tCommon, i18n } = useTranslation("common");
  const { t: tAccount } = useTranslation("account");
  const query = useQuery({
    queryKey: ["xp", "total", userId],
    queryFn: () => getXpTotals(userId ? [userId] : []),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const hasData = query.data !== undefined;
  const rawTotal = Number(query.data?.[userId ?? ""] ?? 0);
  const total = Number.isFinite(rawTotal) ? Math.max(0, rawTotal) : 0;
  const rank = getXpRank(total);

  const hasRank = hasData && total >= XP_RANKS[1].minimum;
  const isUnavailable = query.isError && !hasData;
  const isLoading = query.isPending && !hasData;
  const nextRank = rank.next;
  const locale = i18n.language === "vi" ? "vi-VN" : "en-US";
  const formatNumber = (value: number) => new Intl.NumberFormat(locale).format(value);
  const rankName = nextRank
    ? tAccount(`xp.rank.names.${nextRank.code}`)
    : "";
  const currentRankName = tAccount(`xp.rank.names.${rank.current.code}`);
  const title = isUnavailable
    ? tCommon("home.xp.noData")
    : isLoading
      ? tCommon("home.xp.loading")
      : hasRank
        ? currentRankName
        : tCommon("home.xp.unranked");
  const description = isUnavailable
    ? tCommon("home.xp.loadFailed")
    : isLoading
      ? tCommon("home.xp.loadingDescription")
      : !hasRank
        ? tCommon("home.xp.joinRank", {
        xp: formatNumber(rank.remaining),
        rank: rankName,
      })
      : nextRank
        ? tCommon("home.xp.nextRank", {
          xp: formatNumber(rank.remaining),
          rank: rankName,
        })
        : tCommon("home.xp.highest");

  return (
    <section
      className="relative isolate flex min-h-[306px] flex-col gap-5 overflow-hidden rounded-2xl border border-border bg-home-xp-panel-surface px-4 py-3"
      aria-labelledby="home-xp-title"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[104px] left-1/2 h-[391px] w-[457px] -translate-x-1/2 max-sm:w-[150%] max-sm:aspect-[1.17]"
        style={{ opacity: "var(--home-xp-panel-art-opacity)" }}
      >
        <img src={xpPanelBackground} alt="" className="size-full" />
      </div>

      <header className="relative z-10 flex w-full flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <MonitorPlay
            aria-hidden="true"
            className="size-5 shrink-0 text-foreground-muted"
            weight="duotone"
          />
          <h2 id="home-xp-title" className="text-sm font-medium text-foreground">
            {tCommon("home.xp.title")}
          </h2>
        </div>
        <div className="h-px w-full bg-border" />
      </header>

      <div className="relative z-10 flex w-full flex-col items-center gap-2 text-center">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">
            {title}
          </p>
          <p className="text-xs leading-4 text-foreground-muted">{description}</p>
        </div>

        <div
          aria-hidden="true"
          className="relative flex size-40 items-center justify-center"
        >
          <XpRankEmblem rank={rank.current.code} size="medium" />
        </div>

        <ProgressBar
          aria-label={tAccount("xp.rank.progress")}
          aria-valuetext={!hasData ? description : undefined}
          className="h-2 w-full"
          label={false}
          progress={hasData ? rank.progress : 0}
          theme="Neutral"
        />
      </div>
    </section>
  );
}

import { queryOptions } from "@tanstack/react-query";
import { getXpLeaderboard, type XpPeriod } from "@/lib/xpLeaderboard";
import { xpWeekStart } from "@/lib/xpRanks";

export function xpLeaderboardQuery(userId: string, period: XpPeriod, week = xpWeekStart()) {
  return queryOptions({
    queryKey: ["xp", "leaderboard", userId, period, period === "week" ? week : null] as const,
    queryFn: ({ signal }) => getXpLeaderboard(period, signal),
    enabled: Boolean(userId),
    staleTime: 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    meta: { scope: "private", userId, showInGlobalLoading: false },
  });
}

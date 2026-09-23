/** Product thresholds, independent of leaderboard position and reward rules. */
export const XP_RANKS = [
  { code: "starter", minimum: 0 },
  { code: "bronze", minimum: 250 },
  { code: "silver", minimum: 1000 },
  { code: "gold", minimum: 2500 },
  { code: "platinum", minimum: 10000 },
  { code: "diamond", minimum: 25000 },
] as const;
export type XpRankCode = (typeof XP_RANKS)[number]["code"];

export function getXpRank(total: number) {
  const points = Number.isFinite(total) ? Math.max(0, total) : 0;
  const index = XP_RANKS.reduce((found, rank, i) => points >= rank.minimum ? i : found, 0);
  const current = XP_RANKS[index];
  const next = XP_RANKS[index + 1] ?? null;
  return {
    current,
    next,
    remaining: next ? next.minimum - points : 0,
    progress: next ? (points - current.minimum) / (next.minimum - current.minimum) * 100 : 100,
  };
}

export function xpWeekStart(now = new Date()): string {
  const date = new Date(now);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString();
}

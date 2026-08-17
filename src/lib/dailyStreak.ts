import { callCoreliaApi } from "@/lib/coreliaEdgeApi";

export const STREAK_MILESTONES = [3, 7, 14, 30] as const;

export type DailyStreakStatus = {
  claimed: boolean;
  currentStreak: number;
  longestStreak: number;
  lastClaimDate: string | null;
  timezone: string;
  canClaim: boolean;
  nextClaimAt: string | null;
  totalPoints: number;
  unlockedMilestones: number[];
  newMilestones: number[];
  ocidConnected: boolean;
  githubConnected: boolean;
};

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Ho_Chi_Minh";
  } catch {
    return "Asia/Ho_Chi_Minh";
  }
}

export async function getDailyStreakStatus(): Promise<DailyStreakStatus> {
  return await callCoreliaApi<DailyStreakStatus>("gamification.dailyStreakStatus", {});
}

export async function claimDailyStreak(): Promise<DailyStreakStatus> {
  return await callCoreliaApi<DailyStreakStatus>("gamification.claimDailyStreak", {
    timezone: browserTimezone(),
  });
}

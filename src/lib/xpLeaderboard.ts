import { supabase } from "@/lib/supabase";

export type XpPeriod = "week" | "all_time";
export type XpLeaderboardPerson = {
  id: string;
  username: string | null;
  ocid: string | null;
  full_name: string | null;
  avatar_url: string | null;
  avatar_seed: string | null;
  position: number;
  total_xp: number;
  period_xp: number;
};
export type XpLeaderboard = {
  period: XpPeriod;
  calculated_at: string;
  period_start: string | null;
  period_end: string | null;
  eligible_count: number;
  rows: XpLeaderboardPerson[];
  viewer: {
    position: number | null;
    total_xp: number | null;
    period_xp: number | null;
    reason: "ineligible_role" | "private_profile" | "no_xp" | "missing_profile" | null;
  };
};

export async function getXpLeaderboard(period: XpPeriod, signal?: AbortSignal): Promise<XpLeaderboard> {
  const request = supabase.rpc("xp_leaderboard_v1", { p_period: period });
  const { data, error } = await (signal ? request.abortSignal(signal) : request);
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Missing XP leaderboard response");
  return data as XpLeaderboard;
}

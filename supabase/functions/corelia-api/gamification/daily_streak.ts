import { isAuthFailure } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";
import { runActivityMilestoneCheck } from "../credentials/check_activity.ts";

type DailyStreakRow = {
  claimed?: boolean;
  current_streak?: number;
  longest_streak?: number;
  last_claim_date?: string | null;
  timezone?: string;
  can_claim?: boolean;
  next_claim_at?: string | null;
  total_points?: number;
  unlocked_milestones?: number[] | null;
  new_milestones?: number[] | null;
  ocid_connected?: boolean;
  github_connected?: boolean;
};

function normalizeStatus(row: DailyStreakRow, claimed: boolean) {
  return {
    claimed,
    currentStreak: Number(row.current_streak ?? 0),
    longestStreak: Number(row.longest_streak ?? 0),
    lastClaimDate: row.last_claim_date ?? null,
    timezone: String(row.timezone ?? "Asia/Ho_Chi_Minh"),
    canClaim: Boolean(row.can_claim),
    nextClaimAt: row.next_claim_at ?? null,
    totalPoints: Number(row.total_points ?? 0),
    unlockedMilestones: (row.unlocked_milestones ?? []).map(Number),
    newMilestones: (row.new_milestones ?? []).map(Number),
    ocidConnected: Boolean(row.ocid_connected),
    githubConnected: Boolean(row.github_connected),
  };
}

async function getStatusRow(db: SupabaseClient, userId: string): Promise<DailyStreakRow> {
  const { data, error } = await db.rpc("get_daily_streak_status", {
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") throw new Error("Missing streak status");
  return row as DailyStreakRow;
}

export async function handleGetDailyStreakStatus(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const row = await getStatusRow(db, user.id);
    return json({ ok: true, ...normalizeStatus(row, false) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ ok: false, message: "Chưa đăng nhập" }, 401);
    console.error("[corelia-api] gamification.dailyStreakStatus", e);
    return json({ ok: false, message: "Không thể tải streak lúc này." }, 500);
  }
}

export async function handleClaimDailyStreak(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const timezone = typeof body.timezone === "string" ? body.timezone.trim() : "";
    const { data, error } = await db.rpc("claim_daily_streak", {
      p_user_id: user.id,
      p_timezone: timezone || null,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== "object") throw new Error("Missing claim result");

    const status = normalizeStatus(row as DailyStreakRow, Boolean((row as DailyStreakRow).claimed));

    // An OCB template can opt into event=daily_streak. Its delivery must never
    // roll back the already-committed claim, points, or permanent UI unlock.
    if (status.claimed) {
      try {
        await runActivityMilestoneCheck(db, user.id, "daily_streak", {
          days: status.currentStreak,
        });
      } catch (milestoneError) {
        console.error("[corelia-api] daily streak → activity milestone failed", milestoneError);
      }
    }

    return json({ ok: true, ...status });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ ok: false, message: "Chưa đăng nhập" }, 401);
    console.error("[corelia-api] gamification.claimDailyStreak", e);
    return json({ ok: false, message: "Không thể claim streak lúc này." }, 500);
  }
}

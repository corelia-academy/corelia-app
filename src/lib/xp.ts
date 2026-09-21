import { supabase } from "@/lib/supabase";

export type XpDay = { date: string; xp: number };
export type XpSummary = { total: number; days: XpDay[]; trackingSince: string };
export type XpEntry = {
  id: string;
  source: string;
  points: number;
  entity_type: string | null;
  entity_id: string | null;
  occurred_at: string | null;
  created_at: string;
  reason: string | null;
};

export async function getXpSummary(userId: string, from: string, to: string, own = false): Promise<XpSummary | null> {
  if (own) {
    const { error } = await supabase.rpc("xp_sync_connections");
    if (error) throw new Error(error.message);
  }
  const { data, error } = await supabase.rpc("xp_summary", { p_user_id: userId, p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  if (!data) return null;
  const result = data as { total?: number; days?: Array<{ date: string; xp: number }>; tracking_since?: string };
  return {
    total: Number(result.total ?? 0),
    days: (result.days ?? []).map((day) => ({ date: day.date, xp: Number(day.xp) })),
    trackingSince: result.tracking_since ?? to,
  };
}

export async function getMyXpHistory(userId: string, offset: number, limit = 20): Promise<XpEntry[]> {
  const { data, error } = await supabase.from("user_point_ledger")
    .select("id,source,points,entity_type,entity_id,occurred_at,created_at,reason")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return (data ?? []) as XpEntry[];
}

export async function getMyXpDayBreakdown(day: string): Promise<Array<{ source: string; xp: number }>> {
  const { data, error } = await supabase.rpc("xp_day_breakdown", { p_day: day });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ source: string; xp: number }>).map((row) => ({ source: row.source, xp: Number(row.xp) }));
}

export async function getXpTotals(userIds: string[]): Promise<Record<string, number>> {
  const ids = [...new Set(userIds)].slice(0, 100);
  if (ids.length === 0) return {};
  const { data, error } = await supabase.rpc("xp_totals", { p_user_ids: ids });
  if (error) throw new Error(error.message);
  return Object.fromEntries(((data ?? []) as Array<{ user_id: string; total_xp: number }>).map((row) => [row.user_id, Number(row.total_xp)]));
}

export async function getLessonXpState(userId: string, courseId: string, lessonId: string): Promise<{ lesson: boolean; quiz: boolean; course: boolean }> {
  const lessonKey = `lesson_completed:${courseId}:${lessonId}`;
  const quizKey = `quiz_passed:${courseId}:${lessonId}`;
  const courseKey = `course_completed:${courseId}`;
  const { data, error } = await supabase.from("user_point_ledger")
    .select("source_key").eq("user_id", userId).in("source_key", [lessonKey, quizKey, courseKey]);
  if (error) throw new Error(error.message);
  const keys = new Set((data ?? []).map((row) => row.source_key));
  return { lesson: keys.has(lessonKey), quiz: keys.has(quizKey), course: keys.has(courseKey) };
}

export async function hasMyXpAward(sourceKey: string): Promise<boolean> {
  const { data, error } = await supabase.from("user_point_ledger")
    .select("id").eq("source_key", sourceKey).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function withFirstHackathonXp<T>(action: () => Promise<T>): Promise<{ value: T; awarded: boolean }> {
  const before = hasMyXpAward("first_hackathon_submission").catch(() => null);
  const value = await action();
  const hadAward = await before;
  const awarded = hadAward === false && await hasMyXpAward("first_hackathon_submission").catch(() => false);
  return { value, awarded };
}

export async function getTodayLikeXpRemaining(userId: string): Promise<number> {
  const start = `${utcDate(new Date())}T00:00:00.000Z`;
  const { count, error } = await supabase.from("user_point_ledger")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("source", "project_liked").gte("occurred_at", start);
  if (error) throw new Error(error.message);
  return Math.max(0, 5 - (count ?? 0));
}

export function utcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function xpIntensity(points: number): 0 | 1 | 2 | 3 | 4 {
  if (points <= 0) return 0;
  if (points <= 10) return 1;
  if (points <= 30) return 2;
  if (points <= 100) return 3;
  return 4;
}

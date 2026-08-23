import type { SupabaseClient } from "./lib/supabase.ts";
import type { BackendContextType, SourceRef } from "./behaviorTypes.ts";
import type { QuotaResult } from "./types.ts";
import {
  applySuccessfulUsageToSnapshot,
  evaluateQuotaSemantics,
  type SuccessfulQuotaSnapshot,
} from "./quotaSemantics.ts";

type Tier = "free" | "student" | "pro" | "bootcamp";

type ProfileRow = {
  full_name: string | null;
  tier: Tier | null;
  user_level: string | null;
  user_goal: string | null;
  streak_days: number | null;
  track_interest: string | null;
  category_interests: string[] | null;
};

type ActiveSubscriptionRow = {
  tier: Exclude<Tier, "free">;
  expires_at: string;
  status: "active" | "expired" | "cancelled";
};

type FallbackTierLimit = {
  monthlyMessages: number;
  rolling3hSoftCap: number;
  haikuOnly: boolean;
};

function monthKey(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function threeHourWindowStart(now: Date): string {
  return new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
}

export async function getProfile(
  db: SupabaseClient,
  userId: string,
): Promise<ProfileRow | null> {
  const nowIso = new Date().toISOString();
  const [
    { data: profile, error: profileErr },
    { data: streakRow, error: streakErr },
    { data: subRow, error: subErr },
  ] = await Promise.all([
    db
      .from("profiles")
      .select("full_name,tier,user_level,user_goal,streak_days,track_interest,category_interests")
      .eq("id", userId)
      .maybeSingle<ProfileRow>(),
    db
      .from("user_daily_streaks")
      .select("current_streak")
      .eq("user_id", userId)
      .maybeSingle<{ current_streak: number | null }>(),
    db
      .from("ai_subscriptions")
      .select("tier,expires_at,status")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("expires_at", nowIso)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle<ActiveSubscriptionRow>(),
  ]);
  if (profileErr) throw new Error(profileErr.message);
  if (streakErr) {
    console.warn("[ai-tutor] failed to fetch canonical user_daily_streaks", streakErr);
  }
  if (subErr) {
    console.warn("[ai-tutor] failed to fetch canonical ai_subscriptions", subErr);
  }
  if (!profile) return null;
  return {
    ...profile,
    tier: subRow?.tier ?? "free",
    streak_days: Number(streakRow?.current_streak ?? 0),
  };
}

export async function resolveEffectiveTier(
  db: SupabaseClient,
  userId: string,
  _profileTier?: Tier | null,
): Promise<Tier> {
  const nowIso = new Date().toISOString();
  const { data, error } = await db
    .from("ai_subscriptions")
    .select("tier,expires_at,status")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("expires_at", nowIso)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle<ActiveSubscriptionRow>();
  if (error) throw new Error(error.message);

  // G2-B: ai_subscriptions is the canonical source for AI paid entitlement.
  // profiles.tier must NOT independently grant paid AI entitlement.
  if (data?.tier) return data.tier;
  return "free";
}

export async function ensureSession(
  db: SupabaseClient,
  userId: string,
  contextType: BackendContextType,
  sessionId: string | null,
  courseId?: string | null,
  lessonId?: string | null,
): Promise<string | null> {
  if (contextType === "lesson") return null;

  // If client supplies a sessionId, verify ownership and use it.
  // This lets the client manage multiple sessions per (user × course) — needed
  // for the chat history popover UI.
  if (sessionId) {
    const { data, error } = await db
      .from("ai_chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .eq("context_type", contextType)
      .maybeSingle<{ id: string }>();
    if (error) throw new Error(error.message);
    if (!data?.id) throw new Error("Invalid AI session");
    return data.id;
  }

  // No sessionId from client — fall back to "most recent" lookup for the
  // current context (preserves single-session UX when popover not used).
  if (contextType === "course" && courseId) {
    const { data: existing, error: lookupError } = await db
      .from("ai_chat_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("context_type", "course")
      .eq("course_id", courseId)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (lookupError) throw new Error(lookupError.message);
    if (existing?.id) return existing.id;
    const { data, error } = await db
      .from("ai_chat_sessions")
      .insert({
        user_id: userId,
        context_type: "course",
        course_id: courseId,
        ...(lessonId ? { lesson_id: lessonId } : {}),
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !data?.id) throw new Error(error?.message ?? "Could not create course session");
    return data.id;
  }

  const { data, error } = await db
    .from("ai_chat_sessions")
    .insert({ user_id: userId, context_type: contextType, title: null })
    .select("id")
    .single<{ id: string }>();
  if (error || !data?.id) throw new Error(error?.message ?? "Could not create AI session");
  return data.id;
}

export async function checkQuota(
  db: SupabaseClient,
  userId: string,
  tier: Tier,
  fallbackTierLimits: Record<Tier, FallbackTierLimit>,
): Promise<QuotaResult> {
  const now = new Date();
  const month = monthKey(now);
  const windowStart = threeHourWindowStart(now);

  const [
    { count: windowCount, error: windowError },
    { data: monthly },
    { data: limits, error: limitsError },
  ] = await Promise.all([
    db
      .from("ai_conversations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "user")
      .gte("created_at", windowStart),
    db
      .from("ai_usage_monthly")
      .select("message_count,tokens_used")
      .eq("user_id", userId)
      .eq("month", month)
      .maybeSingle<{ message_count: number; tokens_used: number }>(),
    db
      .from("tier_limits")
      .select("monthly_messages,rolling_3h_soft_cap,haiku_only")
      .eq("tier", tier)
      .maybeSingle<{
        monthly_messages: number | null;
        rolling_3h_soft_cap: number | null;
        haiku_only: boolean | null;
      }>(),
  ]);

  if (windowError) throw new Error(windowError.message);
  if (limitsError) throw new Error(limitsError.message);
  const fallbackLimits = fallbackTierLimits[tier];
  const tierLimitSource = limits ? "tier_limits" : "fallback";
  if (!limits) {
    console.warn("[ai-tutor] tier limit fallback activated", { tier, userId });
  }

  const snapshot: SuccessfulQuotaSnapshot = {
    successfulMessagesUsed: Number(monthly?.message_count ?? 0),
    successfulMessageLimit: limits?.monthly_messages ?? fallbackLimits.monthlyMessages,
    rollingAttemptCount: Number(windowCount ?? 0),
    rollingAttemptSoftCap: limits?.rolling_3h_soft_cap ?? fallbackLimits.rolling3hSoftCap,
    rollingAttemptWindowHours: 3,
    monthlyTokensUsed: Number(monthly?.tokens_used ?? 0),
  };

  return {
    ...snapshot,
    ...evaluateQuotaSemantics(snapshot),
    haikuOnly: limits?.haiku_only ?? fallbackLimits.haikuOnly,
    tier,
    tierLimitSource,
  };
}

export async function enforceAbuseChecks(
  db: SupabaseClient,
  userId: string,
  message: string,
  contextType: BackendContextType,
  lessonId: string | null,
  sessionId: string | null,
): Promise<{ cachedResponse?: { content: string; sessionId: string | null; sources: SourceRef[] } }> {
  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: burstCount, error: burstError } = await db
    .from("ai_conversations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "user")
    .gte("created_at", minuteAgo);
  if (burstError) throw new Error(burstError.message);
  if ((burstCount ?? 0) >= 10) throw new Error("Rate limit exceeded");

  const { count: pendingCount, error: pendingError } = await db
    .from("ai_conversations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "assistant")
    .eq("status", "pending");
  if (pendingError) throw new Error(pendingError.message);
  if ((pendingCount ?? 0) >= 2) throw new Error("Too many concurrent AI requests");

  const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
  let query = db
    .from("ai_conversations")
    .select("id,content,created_at")
    .eq("user_id", userId)
    .eq("role", "user")
    .eq("context_type", contextType)
    .eq("content", message)
    .gte("created_at", tenSecondsAgo)
    .order("created_at", { ascending: false })
    .limit(1);
  query = lessonId ? query.eq("lesson_id", lessonId) : query.eq("session_id", sessionId ?? "");
  const { data: recentMessage, error: dedupeError } = await query.maybeSingle<{
    id: string;
    content: string;
    created_at: string;
  }>();
  if (dedupeError) throw new Error(dedupeError.message);

  if (!recentMessage) return {};

  let replyQuery = db
    .from("ai_conversations")
    .select("content,session_id,sources")
    .eq("user_id", userId)
    .eq("role", "assistant")
    .eq("context_type", contextType)
    .gt("created_at", recentMessage.created_at)
    .order("created_at", { ascending: true })
    .limit(1);
  replyQuery = lessonId ? replyQuery.eq("lesson_id", lessonId) : replyQuery.eq("session_id", sessionId ?? "");
  const { data: cachedReply, error: cachedReplyError } = await replyQuery.maybeSingle<{
    content: string;
    session_id: string | null;
    sources: SourceRef[] | null;
  }>();
  if (cachedReplyError) throw new Error(cachedReplyError.message);
  if (!cachedReply?.content) return {};

  return {
    cachedResponse: {
      content: cachedReply.content,
      sessionId: cachedReply.session_id ?? sessionId,
      sources: Array.isArray(cachedReply.sources) ? cachedReply.sources : [],
    },
  };
}

export function incrementSuccessfulQuotaSnapshot(quota: QuotaResult, tokensUsed = 0): QuotaResult {
  return {
    ...quota,
    ...applySuccessfulUsageToSnapshot(quota, tokensUsed),
  };
}

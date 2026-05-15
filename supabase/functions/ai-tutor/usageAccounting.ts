import type { SupabaseClient } from "./lib/supabase.ts";

function monthKey(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const lower = model.toLowerCase();
  if (lower.includes("sonnet")) {
    return Number((((inputTokens * 0.000003) + (outputTokens * 0.000015))).toFixed(6));
  }
  if (lower.includes("gpt-5")) {
    return Number((((inputTokens * 0.000001) + (outputTokens * 0.000004))).toFixed(6));
  }
  return Number((((inputTokens + outputTokens) * 0.0000008)).toFixed(6));
}

export { estimateTokens };

export async function upsertUsage(
  db: SupabaseClient,
  userId: string,
  args: { inputText: string; outputText: string; modelUsed: string },
): Promise<void> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const month = monthKey(now);
  const inputTokens = estimateTokens(args.inputText);
  const outputTokens = estimateTokens(args.outputText);
  const totalTokens = inputTokens + outputTokens;
  const costUsd = estimateCostUsd(args.modelUsed, inputTokens, outputTokens);

  const { data: dailyRow } = await db
    .from("ai_usage_daily")
    .select("id,message_count,tokens_used,cost_usd")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle<{ id: string; message_count: number; tokens_used: number; cost_usd: number }>();
  if (dailyRow?.id) {
    const { error } = await db
      .from("ai_usage_daily")
      .update({
        message_count: Number(dailyRow.message_count ?? 0) + 1,
        tokens_used: Number(dailyRow.tokens_used ?? 0) + totalTokens,
        cost_usd: Number(dailyRow.cost_usd ?? 0) + costUsd,
        updated_at: now.toISOString(),
      })
      .eq("id", dailyRow.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db
      .from("ai_usage_daily")
      .insert({
        user_id: userId,
        date: today,
        message_count: 1,
        tokens_used: totalTokens,
        cost_usd: costUsd,
      });
    if (error) throw new Error(error.message);
  }

  const { data: monthlyRow } = await db
    .from("ai_usage_monthly")
    .select("id,message_count,tokens_used,cost_usd")
    .eq("user_id", userId)
    .eq("month", month)
    .maybeSingle<{ id: string; message_count: number; tokens_used: number; cost_usd: number }>();
  if (monthlyRow?.id) {
    const { error } = await db
      .from("ai_usage_monthly")
      .update({
        message_count: Number(monthlyRow.message_count ?? 0) + 1,
        tokens_used: Number(monthlyRow.tokens_used ?? 0) + totalTokens,
        cost_usd: Number(monthlyRow.cost_usd ?? 0) + costUsd,
        updated_at: now.toISOString(),
      })
      .eq("id", monthlyRow.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db
      .from("ai_usage_monthly")
      .insert({
        user_id: userId,
        month,
        message_count: 1,
        tokens_used: totalTokens,
        cost_usd: costUsd,
      });
    if (error) throw new Error(error.message);
  }
}

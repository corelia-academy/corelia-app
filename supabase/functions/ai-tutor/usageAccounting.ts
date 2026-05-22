import type { SupabaseClient } from "./lib/supabase.ts";

function monthKey(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const lower = model.toLowerCase();
  // GPT-5.4 mini: $0.75/1M input, $4.50/1M output
  if (lower.includes("gpt-5.4-mini") || lower.includes("gpt-5-mini")) {
    return Number(((inputTokens * 0.00000075) + (outputTokens * 0.0000045)).toFixed(6));
  }
  // GPT-5.4 full: $2.50/1M input, $15.00/1M output
  if (lower.includes("gpt-5")) {
    return Number(((inputTokens * 0.0000025) + (outputTokens * 0.000015)).toFixed(6));
  }
  // Fallback: $0.80/1M tokens flat
  return Number(((inputTokens + outputTokens) * 0.0000008).toFixed(6));
}

export async function upsertUsage(
  db: SupabaseClient,
  userId: string,
  args: {
    inputText: string;
    outputText: string;
    modelUsed: string;
    feature: string;
    conversationId?: string;
    actualUsage?: { inputTokens: number; outputTokens: number };
  },
): Promise<void> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const month = monthKey(now);

  const estimated = !args.actualUsage;
  const inputTokens = args.actualUsage?.inputTokens ?? estimateTokens(args.inputText);
  const outputTokens = args.actualUsage?.outputTokens ?? estimateTokens(args.outputText);
  const totalTokens = inputTokens + outputTokens;
  const costUsd = estimateCostUsd(args.modelUsed, inputTokens, outputTokens);

  // Log per-request usage (actual or estimated)
  const { error: logError } = await db.from("ai_usage_log").insert({
    user_id: userId,
    feature: args.feature,
    conversation_id: args.conversationId ?? null,
    model: args.modelUsed,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd,
    estimated,
  });
  if (logError) console.error("[ai-tutor] usage log insert failed", logError.message);

  // Upsert daily aggregate
  const { data: dailyRow } = await db
    .from("ai_usage_daily")
    .select("id,message_count,tokens_used,input_tokens,output_tokens,cost_usd")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle<{
      id: string;
      message_count: number;
      tokens_used: number;
      input_tokens: number;
      output_tokens: number;
      cost_usd: number;
    }>();
  if (dailyRow?.id) {
    const { error } = await db
      .from("ai_usage_daily")
      .update({
        message_count: Number(dailyRow.message_count ?? 0) + 1,
        tokens_used: Number(dailyRow.tokens_used ?? 0) + totalTokens,
        input_tokens: Number(dailyRow.input_tokens ?? 0) + inputTokens,
        output_tokens: Number(dailyRow.output_tokens ?? 0) + outputTokens,
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
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd,
      });
    if (error) throw new Error(error.message);
  }

  // Upsert monthly aggregate
  const { data: monthlyRow } = await db
    .from("ai_usage_monthly")
    .select("id,message_count,tokens_used,input_tokens,output_tokens,cost_usd")
    .eq("user_id", userId)
    .eq("month", month)
    .maybeSingle<{
      id: string;
      message_count: number;
      tokens_used: number;
      input_tokens: number;
      output_tokens: number;
      cost_usd: number;
    }>();
  if (monthlyRow?.id) {
    const { error } = await db
      .from("ai_usage_monthly")
      .update({
        message_count: Number(monthlyRow.message_count ?? 0) + 1,
        tokens_used: Number(monthlyRow.tokens_used ?? 0) + totalTokens,
        input_tokens: Number(monthlyRow.input_tokens ?? 0) + inputTokens,
        output_tokens: Number(monthlyRow.output_tokens ?? 0) + outputTokens,
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
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd,
      });
    if (error) throw new Error(error.message);
  }
}

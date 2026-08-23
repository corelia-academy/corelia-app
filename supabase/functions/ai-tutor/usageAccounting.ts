import type { SupabaseClient } from "./lib/supabase.ts";

export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

/**
 * G2-F: Runtime Model Pricing Source of Truth.
 *
 * Pricing is computed in-memory via this canonical function to guarantee
 * deterministic, ultra-low-latency accounting during AI tutor response handling.
 * The `public.ai_model_pricing` database table is classified as
 * DEPRECATION_CANDIDATE_PENDING_REVIEW (no active runtime readers/writers).
 */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
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
): Promise<boolean> {
  const estimated = !args.actualUsage;
  const inputTokens = args.actualUsage?.inputTokens ?? estimateTokens(args.inputText);
  const outputTokens = args.actualUsage?.outputTokens ?? estimateTokens(args.outputText);
  const costUsd = estimateCostUsd(args.modelUsed, inputTokens, outputTokens);

  const { data, error } = await db.rpc("record_ai_successful_usage", {
    p_user_id: userId,
    p_feature: args.feature,
    p_conversation_id: args.conversationId ?? null,
    p_model: args.modelUsed,
    p_input_tokens: inputTokens,
    p_output_tokens: outputTokens,
    p_cost_usd: costUsd,
    p_estimated: estimated,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

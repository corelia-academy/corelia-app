// Helpers on studio_generations shared by the course run (handlers.ts) and the catalog job (catalog_run.ts).
import type { SupabaseClient } from "../lib/supabase.ts";
import type { AgentRole } from "./prompts.ts";
import { failureKind, type AttemptRow, type FailureKind } from "./retry.ts";
import { cancelResponse, pollResponse, type PollResult } from "./openai.ts";
import { agentKeyEnv, RESPONSE_STALE_MS } from "./steps.ts";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function agentKey(role: AgentRole): string {
  return Deno.env.get(agentKeyEnv(role))?.trim() ?? "";
}

export async function loadFailureKind(db: SupabaseClient, generationId: string): Promise<FailureKind | null> {
  const { data, error } = await db
    .from("studio_generations")
    .select("status,provider_request_id,failure_kind")
    .eq("id", generationId)
    .single();
  if (error) throw new Error(error.message);
  return data.status === "failed" ? failureKind(data as AttemptRow) : null;
}

/** Returns false when the row had already left `from` (handled by another tick). */
export async function failGeneration(
  db: SupabaseClient,
  id: string,
  from: "submitting" | "submitted",
  kind: FailureKind,
  reason: string,
  billed: { model_id?: string; usage?: Record<string, unknown> | null } = {},
): Promise<boolean> {
  const { data, error } = await db
    .from("studio_generations")
    .update({ ...billed, status: "failed", failure_kind: kind, error: reason.slice(0, 2000), completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", from)
    .select("id");
  if (error) throw new Error(error.message);
  return Boolean(data?.length);
}

/**
 * Polls a background response. One that is still waiting after RESPONSE_STALE_MS (flex requests can sit
 * in the provider queue for hours) is cancelled, which fails the generation as a provider error: the
 * retry budget then decides between a new attempt and ending the run, instead of waiting for the 24h cap.
 */
export async function pollOrExpire(apiKey: string, requestId: string, createdAt: string, pausedDurationMs = 0): Promise<PollResult | null> {
  const result = await pollResponse(apiKey, requestId);
  if (result?.state !== "running" || Date.now() - Date.parse(createdAt) - pausedDurationMs <= RESPONSE_STALE_MS) return result;
  const minutes = Math.round(RESPONSE_STALE_MS / 60000);
  return cancelResponse(apiKey, requestId, `Chưa có kết quả sau ${minutes} phút, đã hủy yêu cầu.`);
}

export type TierFallback =
  | { outcome: "not_flex" }
  | { outcome: "taken_by_other_tick" }
  | { outcome: "resubmitted" }
  | { outcome: "submit_failed"; error: string };

/**
 * A flex request the provider failed (no capacity, queue timeout) is sent again on the default tier as the
 * same attempt: it says nothing about the model, so it is neither a failed attempt nor a warning. The row
 * is claimed first (submitted -> submitting, clock restarted) so a concurrent tick cannot submit it twice.
 * A generation that already runs on the default tier is left to the normal failure path.
 */
export async function fallBackToDefaultTier(
  db: SupabaseClient,
  generationId: string,
  requestId: string,
  submit: (row: { input: Record<string, unknown>; params: Record<string, unknown> }) => Promise<string>,
): Promise<TierFallback> {
  const { data: row, error } = await db
    .from("studio_generations")
    .select("input,params")
    .eq("id", generationId)
    .single();
  if (error) throw new Error(error.message);
  const params = (row.params ?? {}) as Record<string, unknown>;
  if (params.service_tier !== "flex") return { outcome: "not_flex" };

  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await db
    .from("studio_generations")
    .update({ status: "submitting", created_at: now, params: { ...params, service_tier: "default" } })
    .eq("id", generationId)
    .eq("status", "submitted")
    .eq("provider_request_id", requestId)
    .select("id");
  if (claimError) throw new Error(claimError.message);
  if (!claimed?.length) return { outcome: "taken_by_other_tick" };

  let newRequestId: string;
  try {
    newRequestId = await submit({ input: row.input as Record<string, unknown>, params });
  } catch (e) {
    const error = `Không gửi lại được yêu cầu bằng tier mặc định: ${errorMessage(e)}`;
    await failGeneration(db, generationId, "submitting", "transport", error);
    return { outcome: "submit_failed", error };
  }
  const { error: saveError } = await db
    .from("studio_generations")
    .update({ status: "submitted", provider_request_id: newRequestId, submitted_at: new Date().toISOString() })
    .eq("id", generationId)
    .eq("status", "submitting");
  if (saveError) throw new Error(saveError.message);
  return { outcome: "resubmitted" };
}

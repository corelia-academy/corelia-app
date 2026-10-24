// Helpers on studio_generations shared by the course run (handlers.ts) and the catalog job (catalog_run.ts).
import type { SupabaseClient } from "../lib/supabase.ts";
import type { AgentRole } from "./prompts.ts";
import { failureKind, type AttemptRow, type FailureKind } from "./retry.ts";
import { agentKeyEnv } from "./steps.ts";

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

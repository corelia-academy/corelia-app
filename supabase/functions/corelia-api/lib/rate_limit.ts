import type { SupabaseClient } from "./supabase.ts";

// Atomic per-subject sliding window backed by public.consume_rate_limit.
// Throws `rate_limited:<bucket>` when the subject has used its window.
export async function consumeRateLimit(
  db: SupabaseClient,
  bucket: string,
  subject: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const { error } = await db.rpc("consume_rate_limit", {
    p_bucket: bucket,
    p_subject: subject,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error(error.message);
}

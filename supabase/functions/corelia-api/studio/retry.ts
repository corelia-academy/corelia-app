// Retry budget of one round (the attempts after the last accepted one). A leaf module, shared by
// planRun (steps.ts) and planLessons (lesson_flow.ts).

/**
 * An attempt that never reached the provider (no provider_request_id: network error, interrupted
 * submit) says nothing about the model's output, so it does not use the model's attempts. It has its
 * own limit so that a lasting provider outage still ends the run instead of retrying until the 24h cap.
 */
export const MAX_TRANSPORT_FAILURES = 5;

export interface RoundFailures {
  /** Attempts the provider answered and that were rejected (provider error or failed acceptance). */
  model: number;
  /** Attempts that never reached the provider. */
  transport: number;
}

export function roundFailures(
  rows: { attempt: number; status: string; provider_request_id: string | null }[],
  firstAttempt: number,
): RoundFailures {
  const failed = rows.filter((r) => r.attempt >= firstAttempt && r.status === "failed");
  const model = failed.filter((r) => r.provider_request_id !== null).length;
  return { model, transport: failed.length - model };
}

export function canRetry(f: RoundFailures, maxAttempts: number): boolean {
  return f.model < maxAttempts && f.transport < MAX_TRANSPORT_FAILURES;
}

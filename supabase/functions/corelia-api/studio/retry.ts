// Retry budget of one round (the attempts after the last accepted one). A leaf module, shared by
// planRun (steps.ts) and planLessons (lesson_flow.ts).

/**
 * An attempt that never reached the provider (network error, interrupted submit) or that the provider
 * failed after accepting it (server error, no flex capacity) says nothing about the model's output, so
 * it does not use the model's attempts. It has its own limit so that a lasting provider outage still
 * ends the run instead of retrying until the 24h cap.
 */
export const MAX_TRANSPORT_FAILURES = 5;

export type FailureKind = "transport" | "provider" | "rejected";

export interface RoundFailures {
  /** Attempts the model answered and that were refused (acceptance check, output budget). */
  model: number;
  /** Attempts that never reached the provider, or that the provider failed after accepting them. */
  transport: number;
}

export interface AttemptRow {
  attempt: number;
  status: string;
  provider_request_id: string | null;
  /** NULL on rows failed before failure_kind existed. */
  failure_kind?: FailureKind | null;
}

/** Rows failed before failure_kind existed are classified by whether the provider had the request. */
export function failureKind(r: Pick<AttemptRow, "provider_request_id" | "failure_kind">): FailureKind {
  return r.failure_kind ?? (r.provider_request_id !== null ? "rejected" : "transport");
}

export function roundFailures(rows: AttemptRow[], firstAttempt: number): RoundFailures {
  const failed = rows.filter((r) => r.attempt >= firstAttempt && r.status === "failed");
  const model = failed.filter((r) => failureKind(r) === "rejected").length;
  return { model, transport: failed.length - model };
}

export function canRetry(f: RoundFailures, maxAttempts: number): boolean {
  return f.model < maxAttempts && f.transport < MAX_TRANSPORT_FAILURES;
}

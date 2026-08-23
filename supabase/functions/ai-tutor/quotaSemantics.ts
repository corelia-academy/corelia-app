export type SuccessfulQuotaSnapshot = {
  successfulMessagesUsed: number;
  successfulMessageLimit: number | null;
  rollingAttemptCount: number;
  rollingAttemptSoftCap: number | null;
  rollingAttemptWindowHours: number;
  monthlyTokensUsed: number;
};

export function evaluateQuotaSemantics(snapshot: SuccessfulQuotaSnapshot): {
  allowed: boolean;
  attemptRateLimited: boolean;
} {
  return {
    allowed:
      snapshot.successfulMessageLimit == null ||
      snapshot.successfulMessagesUsed < snapshot.successfulMessageLimit,
    attemptRateLimited:
      snapshot.rollingAttemptSoftCap != null &&
      snapshot.rollingAttemptCount >= snapshot.rollingAttemptSoftCap,
  };
}

/**
 * Applies one completed provider response to the response-side snapshot.
 * The caller must invoke this only when the durable successful-usage record
 * was inserted; a duplicate record must not advance the UI snapshot.
 */
export function applySuccessfulUsageToSnapshot(
  snapshot: SuccessfulQuotaSnapshot,
  tokensUsed: number,
): SuccessfulQuotaSnapshot & { allowed: boolean; attemptRateLimited: boolean } {
  const next = {
    ...snapshot,
    successfulMessagesUsed: snapshot.successfulMessagesUsed + 1,
    rollingAttemptCount: snapshot.rollingAttemptCount + 1,
    monthlyTokensUsed: snapshot.monthlyTokensUsed + Math.max(0, tokensUsed),
  };
  return { ...next, ...evaluateQuotaSemantics(next) };
}

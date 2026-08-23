export type QuotaResult = {
  allowed: boolean;
  /** Soft anti-abuse result based on request attempts, never successful quota. */
  attemptRateLimited: boolean;
  haikuOnly: boolean;
  /** Successful provider responses recorded for the UTC month. */
  successfulMessagesUsed: number;
  successfulMessageLimit: number | null;
  /** Requests persisted in the rolling attempt window, including provider failures. */
  rollingAttemptCount: number;
  rollingAttemptSoftCap: number | null;
  rollingAttemptWindowHours: number;
  tier: "free" | "student" | "pro" | "bootcamp";
  tierLimitSource: "tier_limits" | "fallback";
  /** Telemetry only. It is not a quota limit or enforcement input. */
  monthlyTokensUsed: number;
};

export type MessageComplexity = "simple" | "medium" | "complex";

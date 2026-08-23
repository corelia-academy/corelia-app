import { describe, expect, it } from "vitest";

import {
  applySuccessfulUsageToSnapshot,
  evaluateQuotaSemantics,
} from "./quotaSemantics.ts";

const base = {
  successfulMessagesUsed: 2,
  successfulMessageLimit: 3,
  rollingAttemptCount: 4,
  rollingAttemptSoftCap: 5,
  rollingAttemptWindowHours: 3,
  monthlyTokensUsed: 120,
};

describe("AI quota semantics", () => {
  it("uses successful messages, not token telemetry, for the monthly quota", () => {
    expect(evaluateQuotaSemantics({ ...base, monthlyTokensUsed: 999_999 })).toMatchObject({
      allowed: true,
      attemptRateLimited: false,
    });
  });

  it("keeps request attempts separate from successful monthly quota", () => {
    expect(evaluateQuotaSemantics({ ...base, rollingAttemptCount: 5 })).toMatchObject({
      allowed: true,
      attemptRateLimited: true,
    });
  });

  it("counts exactly one successful provider response in the returned snapshot", () => {
    expect(applySuccessfulUsageToSnapshot(base, 80)).toMatchObject({
      successfulMessagesUsed: 3,
      rollingAttemptCount: 5,
      monthlyTokensUsed: 200,
      allowed: false,
      attemptRateLimited: true,
    });
  });
});

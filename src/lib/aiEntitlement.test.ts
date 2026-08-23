import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/lib/coreliaEdgeApi", () => ({
  coreliaEdgeUrl: (name: string) => name,
  supabaseFunctionHeaders: () => ({}),
}));

import {
  isAiSubscriptionActive,
  resolveEffectiveAiTier,
  type AiSubscription,
} from "./payments";

describe("FV-G2-01: AI Entitlement Expiration Consistency", () => {
  const referenceDate = new Date("2026-08-23T12:00:00.000Z");

  const createSub = (overrides: Partial<AiSubscription> = {}): AiSubscription => ({
    id: "sub-1",
    user_id: "user-1",
    tier: "pro",
    status: "active",
    price_vnd: 199000,
    started_at: "2026-08-01T00:00:00.000Z",
    expires_at: "2026-09-01T00:00:00.000Z",
    duration_months: 1,
    payment_transaction_id: "tx-1",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  });

  describe("isAiSubscriptionActive", () => {
    it("returns true for status=active with future expires_at", () => {
      const sub = createSub({
        status: "active",
        expires_at: "2026-08-24T00:00:00.000Z",
      });
      expect(isAiSubscriptionActive(sub, referenceDate)).toBe(true);
    });

    it("returns false for status=active with past expires_at (stale active-expired row)", () => {
      const sub = createSub({
        status: "active",
        expires_at: "2026-08-22T00:00:00.000Z",
      });
      expect(isAiSubscriptionActive(sub, referenceDate)).toBe(false);
    });

    it("returns false for status=active with expires_at exactly at reference date", () => {
      const sub = createSub({
        status: "active",
        expires_at: "2026-08-23T12:00:00.000Z",
      });
      expect(isAiSubscriptionActive(sub, referenceDate)).toBe(false);
    });

    it("returns false for status=expired even if expires_at is in the future", () => {
      const sub = createSub({
        status: "expired",
        expires_at: "2026-09-01T00:00:00.000Z",
      });
      expect(isAiSubscriptionActive(sub, referenceDate)).toBe(false);
    });

    it("returns false for status=cancelled or superseded", () => {
      const cancelledSub = createSub({ status: "cancelled" });
      const supersededSub = createSub({ status: "superseded" });
      expect(isAiSubscriptionActive(cancelledSub, referenceDate)).toBe(false);
      expect(isAiSubscriptionActive(supersededSub, referenceDate)).toBe(false);
    });

    it("returns false for null, undefined, or missing expires_at", () => {
      expect(isAiSubscriptionActive(null, referenceDate)).toBe(false);
      expect(isAiSubscriptionActive(undefined, referenceDate)).toBe(false);
      expect(isAiSubscriptionActive(createSub({ expires_at: "" }), referenceDate)).toBe(false);
    });
  });

  describe("resolveEffectiveAiTier", () => {
    it("returns the paid tier when subscription is active and unexpired", () => {
      const sub = createSub({
        tier: "bootcamp",
        status: "active",
        expires_at: "2026-09-01T00:00:00.000Z",
      });
      expect(resolveEffectiveAiTier(sub, referenceDate)).toBe("bootcamp");
    });

    it("returns 'free' when subscription is active but expired in the past", () => {
      const sub = createSub({
        tier: "pro",
        status: "active",
        expires_at: "2026-08-20T00:00:00.000Z",
      });
      expect(resolveEffectiveAiTier(sub, referenceDate)).toBe("free");
    });

    it("returns 'free' when subscription is null or undefined", () => {
      expect(resolveEffectiveAiTier(null, referenceDate)).toBe("free");
      expect(resolveEffectiveAiTier(undefined, referenceDate)).toBe("free");
    });

    it("returns 'free' for non-active statuses regardless of tier property", () => {
      const sub = createSub({
        tier: "student",
        status: "expired",
        expires_at: "2026-09-01T00:00:00.000Z",
      });
      expect(resolveEffectiveAiTier(sub, referenceDate)).toBe("free");
    });
  });
});

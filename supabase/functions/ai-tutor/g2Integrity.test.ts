import { describe, expect, it, vi } from "vitest";
import { getProfile, resolveEffectiveTier } from "./accessGuards.ts";
import { estimateCostUsd, estimateTokens } from "./usageAccounting.ts";
import type { SupabaseClient } from "./lib/supabase.ts";

describe("G2-A: Streak Canonical State", () => {
  it("resolves streak from user_daily_streaks instead of profiles.streak_days", async () => {
    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                full_name: "Test Learner",
                tier: "free",
                user_level: "intermediate",
                user_goal: "Fullstack",
                streak_days: 0, // Stale/dead column in profiles
                track_interest: "frontend",
                category_interests: ["web"],
              },
              error: null,
            }),
          };
        }
        if (table === "user_daily_streaks") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { current_streak: 14 }, // Canonical streak in user_daily_streaks
              error: null,
            }),
          };
        }
        if (table === "ai_subscriptions") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as unknown as SupabaseClient;

    const profile = await getProfile(mockDb, "user-123");
    expect(profile).not.toBeNull();
    expect(profile?.streak_days).toBe(14);
  });

  it("handles missing user_daily_streaks row safely by defaulting to 0", async () => {
    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                full_name: "New User",
                tier: "free",
                user_level: "beginner",
                user_goal: "Learn",
                streak_days: 0,
                track_interest: null,
                category_interests: null,
              },
              error: null,
            }),
          };
        }
        if (table === "user_daily_streaks") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: null, // No row yet
              error: null,
            }),
          };
        }
        if (table === "ai_subscriptions") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as unknown as SupabaseClient;

    const profile = await getProfile(mockDb, "user-456");
    expect(profile).not.toBeNull();
    expect(profile?.streak_days).toBe(0);
  });
});

describe("G2-B: AI Entitlement Canonicalization", () => {
  it("grants paid tier when an active unexpired subscription row exists in ai_subscriptions", async () => {
    const mockDb = {
      from: vi.fn((table: string) => {
        expect(table).toBe("ai_subscriptions");
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              tier: "pro",
              expires_at: new Date(Date.now() + 86400000).toISOString(),
              status: "active",
            },
            error: null,
          }),
        };
      }),
    } as unknown as SupabaseClient;

    const tier = await resolveEffectiveTier(mockDb, "user-paid", "student");
    expect(tier).toBe("pro");
  });

  it("strictly returns free tier when no active subscription exists, even if profiles.tier was pro", async () => {
    const mockDb = {
      from: vi.fn((table: string) => {
        expect(table).toBe("ai_subscriptions");
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null, // Expired or cancelled subscription
            error: null,
          }),
        };
      }),
    } as unknown as SupabaseClient;

    // Even if caller passes a stale profileTier of "pro" or "bootcamp", it MUST NOT grant paid access!
    const tier = await resolveEffectiveTier(mockDb, "user-expired", "pro");
    expect(tier).toBe("free");
  });

  it("getProfile overrides stale profiles.tier with active ai_subscriptions tier or free", async () => {
    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                full_name: "Stale User",
                tier: "bootcamp", // Stale paid tier in profiles table
                user_level: "advanced",
                user_goal: "Master AI",
                streak_days: 0,
                track_interest: "ai",
                category_interests: ["ai"],
              },
              error: null,
            }),
          };
        }
        if (table === "user_daily_streaks") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { current_streak: 5 },
              error: null,
            }),
          };
        }
        if (table === "ai_subscriptions") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: null, // No active unexpired subscription
              error: null,
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as unknown as SupabaseClient;

    const profile = await getProfile(mockDb, "user-stale");
    expect(profile).not.toBeNull();
    // tier MUST be overwritten to "free" despite profiles.tier = "bootcamp"
    expect(profile?.tier).toBe("free");
    expect(profile?.streak_days).toBe(5);
  });
});

describe("G2-F: AI Model Pricing Source of Truth", () => {
  it("computes accurate cost for GPT-5.4 mini", () => {
    const cost = estimateCostUsd("gpt-5.4-mini", 1000, 500);
    // (1000 * 0.00000075) + (500 * 0.0000045) = 0.00075 + 0.00225 = 0.003
    expect(cost).toBe(0.003);
  });

  it("computes accurate cost for GPT-5 full", () => {
    const cost = estimateCostUsd("gpt-5", 1000, 500);
    // (1000 * 0.0000025) + (500 * 0.000015) = 0.0025 + 0.0075 = 0.01
    expect(cost).toBe(0.01);
  });

  it("estimates token lengths properly", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("Hello world")).toBe(3);
  });
});

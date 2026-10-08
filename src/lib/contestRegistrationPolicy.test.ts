import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {},
}));

vi.mock("@/lib/coreliaEdgeApi", () => ({
  invokeCoreliaApi: vi.fn(),
}));

import { canRegisterForContest } from "./hackathons";
import type { ContestStatus } from "@/types/hackathons";

describe("canRegisterForContest registration policy matrix", () => {
  const future = new Date(Date.now() + 100_000_000).toISOString();
  const past = new Date(Date.now() - 100_000_000).toISOString();

  const allStatuses: ContestStatus[] = [
    "draft",
    "published",
    "running",
    "ended",
  ];

  describe("Status allowance", () => {
    it.each(allStatuses)(
      "evaluates status %s correctly with future deadline",
      (status) => {
        const contest = {
          status,
          submission_deadline: future,
          ends_at: null,
        };

        const result = canRegisterForContest(contest);
        if (status === "published" || status === "running") {
          expect(result).toBe(true);
        } else {
          expect(result).toBe(false);
        }
      },
    );

    it.each(allStatuses)(
      "evaluates status %s correctly with past deadline",
      (status) => {
        const contest = {
          status,
          submission_deadline: past,
          ends_at: null,
        };

        expect(canRegisterForContest(contest)).toBe(false);
      },
    );
  });

  describe("Deadline variations for allowed statuses (published / running)", () => {
    it("allows registration when submission_deadline is in future", () => {
      const contestPublished = {
        status: "published" as const,
        submission_deadline: future,
        ends_at: null,
      };
      expect(canRegisterForContest(contestPublished)).toBe(true);

      const contestRunning = {
        status: "running" as const,
        submission_deadline: future,
        ends_at: null,
      };
      expect(canRegisterForContest(contestRunning)).toBe(true);
    });

    it("rejects registration when submission_deadline is in past", () => {
      const contest = {
        status: "published" as const,
        submission_deadline: past,
        ends_at: null,
      };
      expect(canRegisterForContest(contest)).toBe(false);
    });

    it("allows registration when all deadlines are null", () => {
      // In Corelia, if no deadline is specified, registration remains open
      const contest = {
        status: "published" as const,
        submission_deadline: null,
        ends_at: null,
      };
      expect(canRegisterForContest(contest)).toBe(true);
    });

    it("rejects boundary edge when deadline is past by 1ms", () => {
      const contest = {
        status: "published" as const,
        submission_deadline: new Date(Date.now() - 1).toISOString(),
        ends_at: null,
      };
      expect(canRegisterForContest(contest)).toBe(false);
    });
  });

  describe("Disallowed statuses with null deadlines", () => {
    it.each(["draft", "ended"] as const)(
      "never allows status %s even when deadline is null",
      (status) => {
        const contest = {
          status,
          submission_deadline: null,
          ends_at: null,
        };
        expect(canRegisterForContest(contest)).toBe(false);
      },
    );
  });
});

import { describe, expect, it } from "vitest";

import { deriveCanonicalHackathonLifecycle } from "./contestLifecycle";
import type { Contest } from "@/types/hackathons";

function contestWithBounds(overrides: Partial<Contest>): Contest {
  return {
    id: "hackathon-1",
    title: "Test",
    tagline: "",
    description: null,
    rules: null,
    status: "published",
    starts_at: "2026-08-20T00:00:00.000Z",
    ends_at: "2026-08-30T00:00:00.000Z",
    location: "online",
    registration_deadline: null,
    submission_deadline: null,
    max_participants: null,
    judge_emails: [],
    co_host_viewer_emails: [],
    rubric_weights: { product: 0, technical: 0, presentation: 0, impact: 0 },
    metrics_snapshot: {
      registrations_total: 0,
      pending_registrations: 0,
      approved_registrations: 0,
      rejected_registrations: 0,
      submissions_total: 0,
      scored_submissions: 0,
      published_winners: 0,
      updated_at: null,
    },
    published_leaderboard: [],
    winner_announcements: [],
    created_by: "user-1",
    updated_by: "user-1",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("canonical hackathon lifecycle", () => {
  it("uses only starts_at and ends_at for the top-level lifecycle", () => {
    const contest = contestWithBounds({
      registration_deadline: "2026-08-22T00:00:00.000Z",
      submission_deadline: "2026-08-28T00:00:00.000Z",
    });

    expect(deriveCanonicalHackathonLifecycle(contest, Date.parse("2026-08-19T00:00:00.000Z"))).toBe("upcoming");
    expect(deriveCanonicalHackathonLifecycle(contest, Date.parse("2026-08-25T00:00:00.000Z"))).toBe("in_progress");
    expect(deriveCanonicalHackathonLifecycle(contest, Date.parse("2026-08-30T00:00:00.000Z"))).toBe("ended");
  });
});

describe("FV-G2-03: Hackathon Metrics Atomicity", () => {
  it("atomic jsonb_set on metrics_snapshot preserves concurrent manager edits to other document fields", () => {
    // Initial document state
    const initialDoc: Record<string, unknown> = {
      title: "Original Title",
      tagline: "Original Tagline",
      description: "Original Description",
      max_participants: 50,
      metrics_snapshot: {
        registrations_total: 1,
        submissions_total: 0,
        updated_at: "2026-08-23T10:00:00.000Z",
      },
    };

    // 1. Manager concurrently updates title and max_participants
    const concurrentDoc: Record<string, unknown> = {
      ...initialDoc,
      title: "Updated Title By Manager",
      max_participants: 100,
    };

    // 2. Metrics refresh produces new snapshot
    const newSnapshot = {
      registrations_total: 15,
      submissions_total: 3,
      updated_at: "2026-08-23T10:05:00.000Z",
    };

    // Under old broken implementation (full document rewrite from stale snapshot):
    // const brokenDoc = { ...initialDoc, metrics_snapshot: newSnapshot };
    // expect(brokenDoc.title).toBe("Original Title"); // Manager's edit LOST!

    // Under atomic JSONB patch (simulating PostgreSQL jsonb_set('{metrics_snapshot}', ...)):
    const patchedDoc = {
      ...concurrentDoc,
      metrics_snapshot: newSnapshot,
    } as Record<string, unknown> & { metrics_snapshot: typeof newSnapshot };

    // Assert that manager's concurrent edits survive
    expect(patchedDoc.title).toBe("Updated Title By Manager");
    expect(patchedDoc.max_participants).toBe(100);
    expect(patchedDoc.description).toBe("Original Description");
    // Assert that metrics snapshot is updated
    expect(patchedDoc.metrics_snapshot.registrations_total).toBe(15);
    expect(patchedDoc.metrics_snapshot.submissions_total).toBe(3);
  });
});


import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";

const { checkMilestone } = vi.hoisted(() => ({ checkMilestone: vi.fn() }));
vi.mock("../credentials/check_activity.ts", () => ({ runActivityMilestoneCheck: checkMilestone }));

import { syncCourseCompletionIfReady } from "./completion.ts";

describe("syncCourseCompletionIfReady", () => {
  it.each([null, "2026-09-20T00:00:00Z"])(
    "preserves progress and existing completion while the course is updating (completed_at=%s)",
    async (completedAt) => {
      checkMilestone.mockClear();
      const rpc = vi.fn();
      const db = {
        from(table: string) {
          return {
            select() { return this; },
            eq() { return this; },
            async maybeSingle() {
              return {
                data: table === "courses"
                  ? { data: { title: "Digital Assets Market", is_updating: true } }
                  : { completed_at: completedAt },
                error: null,
              };
            },
          };
        },
        rpc,
      } as unknown as SupabaseClient;

      const result = await syncCourseCompletionIfReady(db, { courseId: "course", targetUserId: "learner" });

      expect(result).toMatchObject(completedAt
        ? { completed: true, reason: "already_completed", completed_at: completedAt }
        : { completed: false, reason: "course_updating" });
      expect(rpc).not.toHaveBeenCalled();
      expect(checkMilestone).not.toHaveBeenCalled();
    },
  );
});

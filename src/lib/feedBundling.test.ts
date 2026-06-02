import { describe, expect, it } from "vitest";

import type { ActivityEvent } from "@/types/feed";
import { bundleFeedEvents } from "./feedBundling";

function event(overrides: Partial<ActivityEvent>): ActivityEvent {
  return {
    id: overrides.id ?? 1,
    actor_id: overrides.actor_id ?? "actor-1",
    verb: overrides.verb ?? "user.completed_section",
    object_type: overrides.object_type ?? "course",
    object_id: overrides.object_id ?? "course-1",
    target_type: overrides.target_type ?? "lesson",
    target_id: overrides.target_id ?? `lesson-${overrides.id ?? 1}`,
    payload: overrides.payload ?? {},
    visibility: overrides.visibility ?? "public",
    created_at: overrides.created_at ?? "2026-05-28T08:00:00.000Z",
  };
}

describe("bundleFeedEvents", () => {
  it("bundles completed lessons by actor, course, and day", () => {
    const bundles = bundleFeedEvents([
      event({ id: 1, target_id: "lesson-1" }),
      event({ id: 2, target_id: "lesson-2" }),
      event({ id: 3, object_id: "course-2", target_id: "lesson-3" }),
    ]);

    expect(bundles).toHaveLength(2);
    expect(bundles[0]).toMatchObject({ kind: "bundle" });
    expect(bundles[0]?.events.map((item) => item.id)).toEqual([1, 2]);
    expect(bundles[1]).toMatchObject({ kind: "single" });
  });

  it("keeps completed lessons on different days separate", () => {
    const bundles = bundleFeedEvents([
      event({ id: 1, created_at: "2026-05-28T08:00:00.000Z" }),
      event({ id: 2, created_at: "2026-05-29T08:00:00.000Z" }),
    ]);

    expect(bundles.map((bundle) => bundle.kind)).toEqual(["single", "single"]);
  });

  it("bundles followed users by actor and day", () => {
    const bundles = bundleFeedEvents([
      event({
        id: 1,
        verb: "user.followed_user",
        object_type: "user",
        object_id: "actor-1",
        target_type: "user",
        target_id: "user-2",
      }),
      event({
        id: 2,
        verb: "user.followed_user",
        object_type: "user",
        object_id: "actor-1",
        target_type: "user",
        target_id: "user-3",
      }),
    ]);

    expect(bundles).toHaveLength(1);
    expect(bundles[0]).toMatchObject({ kind: "bundle" });
    expect(bundles[0]?.events.map((item) => item.target_id)).toEqual(["user-2", "user-3"]);
  });

  it("does not bundle project heart milestones", () => {
    const bundles = bundleFeedEvents([
      event({
        id: 1,
        verb: "project.received_hearts_milestone",
        object_type: "project",
        object_id: "project-1",
        target_type: null,
        target_id: null,
        payload: { milestone: 10 },
      }),
      event({
        id: 2,
        verb: "project.received_hearts_milestone",
        object_type: "project",
        object_id: "project-1",
        target_type: null,
        target_id: null,
        payload: { milestone: 50 },
      }),
    ]);

    expect(bundles.map((bundle) => bundle.kind)).toEqual(["single", "single"]);
  });
});

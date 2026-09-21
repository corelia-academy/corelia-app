// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
import { advanceXpNotifications, readXpNotificationCursor, saveXpNotificationCursor } from "./xpNotifications";
import type { XpEntry } from "./xp";
const row = (id: string, points = 10, at = "2026-09-22T00:00:00+00:00"): XpEntry => ({
  id, points, created_at: at, occurred_at: at, source: "lesson_completed", entity_type: null, entity_id: null, reason: null,
});
describe("XP notification ledger cursor", () => {
  it("announces all awards sharing a transaction timestamp once", () => {
    const baseline = { createdAt: "2026-09-21T00:00:00+00:00", ids: ["old"] };
    const rows = [row("lesson"), row("quiz", 20), row("course", 100)];
    const next = advanceXpNotifications(baseline, rows);
    expect(next.awards.reduce((sum, entry) => sum + entry.points, 0)).toBe(130);
    expect(advanceXpNotifications(next.cursor, rows).awards).toEqual([]);
    expect(advanceXpNotifications(next.cursor, [...rows, row("late", 2)]).awards.map(entry => entry.id)).toEqual(["late"]);
  });
  it("ignores old history, reversals, and backfill while advancing the cursor", () => {
    const next = advanceXpNotifications({ createdAt: "2026-09-21T00:00:00+00:00", ids: [] }, [
      row("old", 50, "2026-09-20T00:00:00+00:00"), row("reverse", -10), { ...row("backfill", 50), occurred_at: null },
    ]);
    expect(next.awards).toEqual([]);
    expect(next.fresh).toHaveLength(2);
    expect(next.cursor.ids).toEqual(["reverse", "backfill"]);
  });
  it("persists per-user progress across redirects without replaying observed awards", () => {
    const next = advanceXpNotifications({ createdAt: null, ids: [] }, [row("github", 50)]);
    saveXpNotificationCursor("oauth-user", next.cursor);
    expect(readXpNotificationCursor("other-user")).toBeNull();
    expect(advanceXpNotifications(readXpNotificationCursor("oauth-user")!, [row("github", 50)]).awards).toEqual([]);
  });
});

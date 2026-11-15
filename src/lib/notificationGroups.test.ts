import { describe, expect, it } from "vitest";
import type { UserNotificationRow } from "@/lib/notifications";
import { groupNotificationsByDay } from "./notificationGroups";

const row = (id: string, at: Date) => ({ id, user_id: "u", type: "t", payload: {}, read_at: null, resolved_at: null, created_at: at.toISOString(), activity_at: at.toISOString() }) as UserNotificationRow;

describe("groupNotificationsByDay", () => {
  it("groups rows by local day with Today, Yesterday and date labels", () => {
    const now = new Date(2026, 5, 4, 12, 0).getTime();
    const groups = groupNotificationsByDay(
      [row("a", new Date(2026, 5, 4, 9, 0)), row("b", new Date(2026, 5, 4, 8, 0)), row("c", new Date(2026, 5, 3, 23, 0)), row("d", new Date(2026, 5, 2, 10, 0))],
      now, "vi", { today: "Hôm nay", yesterday: "Hôm qua" },
    );
    expect(groups.map(g => [g.label, g.items.map(i => i.id)])).toEqual([["Hôm nay", ["a", "b"]], ["Hôm qua", ["c"]], ["2 thg 6, 2026", ["d"]]]);
  });
});

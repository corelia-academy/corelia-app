import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  collaboratorIds: [] as string[],
  collaboratorSelect: "",
  rows: [
    { project_id: "project-a", user_id: "user-2", added_at: "2026-01-02T00:00:00Z" },
    { project_id: "project-a", user_id: "user-1", added_at: "2026-01-01T00:00:00Z" },
  ],
  profiles: [
    { id: "user-1", username: "one", full_name: "One", avatar_url: null },
    { id: "user-2", username: "two", full_name: "Two", avatar_url: "https://example.com/two.png" },
  ],
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "project_collaborators") {
        const chain = {
          select: (columns: string) => {
            state.collaboratorSelect = columns;
            return chain;
          },
          in: (_column: string, ids: string[]) => {
            state.collaboratorIds = ids;
            return chain;
          },
          order: async () => ({ data: state.rows, error: null }),
        };
        return chain;
      }
      if (table === "public_profiles") {
        return {
          select: () => ({
            in: async () => ({ data: state.profiles, error: null }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  },
}));

import { listPublicProjectTeam, listPublicProjectTeams } from "./projectCollaboration";

beforeEach(() => {
  state.collaboratorIds = [];
  state.collaboratorSelect = "";
});

it("normalizes project IDs and batch-loads accepted members without a portfolio filter", async () => {
  const result = await listPublicProjectTeams([" project-a ", "project-a", "project-b", ""]);

  expect(state.collaboratorIds).toEqual(["project-a", "project-b"]);
  expect(state.collaboratorSelect).toBe("project_id,user_id,added_at");
  expect(result["project-a"].map((member) => member.user_id)).toEqual(["user-2", "user-1"]);
  expect(result["project-b"]).toEqual([]);
});

it("uses the batch loader for a single project", async () => {
  const result = await listPublicProjectTeam(" project-a ");
  expect(state.collaboratorIds).toEqual(["project-a"]);
  expect(result).toHaveLength(2);
});

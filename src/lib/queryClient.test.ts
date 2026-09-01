import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/profile", () => ({
  getProfileForUser: vi.fn(),
}));

import { currentProfileQueryOptions, profileKeys } from "@/features/auth/profileQueries";
import { clearPrivateQueryCache, queryClient } from "@/lib/queryClient";
import type { User } from "@supabase/supabase-js";

afterEach(() => {
  queryClient.clear();
});

describe("query client privacy boundaries", () => {
  it("removes only private queries for the signed-out user", async () => {
    await queryClient.fetchQuery({
      queryKey: ["public", "catalog"],
      queryFn: async () => "public-data",
      meta: { scope: "public" },
    });
    await queryClient.fetchQuery({
      queryKey: ["private", "u-1"],
      queryFn: async () => "user-one",
      meta: { scope: "private", userId: "u-1" },
    });
    await queryClient.fetchQuery({
      queryKey: ["private", "u-2"],
      queryFn: async () => "user-two",
      meta: { scope: "private", userId: "u-2" },
    });

    await clearPrivateQueryCache("u-1");

    expect(queryClient.getQueryData(["public", "catalog"])).toBe("public-data");
    expect(queryClient.getQueryData(["private", "u-1"])).toBeUndefined();
    expect(queryClient.getQueryData(["private", "u-2"])).toBe("user-two");
  });

  it("scopes current-profile keys and metadata by identity", () => {
    const firstUser = { id: "u-1" } as User;
    const secondUser = { id: "u-2" } as User;
    const first = currentProfileQueryOptions(firstUser);
    const second = currentProfileQueryOptions(secondUser);

    expect(first.queryKey).toEqual(profileKeys.current("u-1"));
    expect(second.queryKey).toEqual(profileKeys.current("u-2"));
    expect(first.queryKey).not.toEqual(second.queryKey);
    expect(first.meta).toMatchObject({ scope: "private", userId: "u-1" });
  });
});

import { describe, expect, it } from "vitest";
import { keepPreviousDataForUser } from "./queryClient";

describe("keepPreviousDataForUser", () => {
  it("keeps the previous result for the same user", () => {
    const keep = keepPreviousDataForUser("user-a");
    expect(keep(["row"], { meta: { scope: "private", userId: "user-a" } })).toEqual(["row"]);
  });

  it("never carries data across users", () => {
    const keep = keepPreviousDataForUser("user-b");
    expect(keep(["row"], { meta: { scope: "private", userId: "user-a" } })).toBeUndefined();
  });

  it("treats public queries (no userId) as the anonymous scope", () => {
    expect(keepPreviousDataForUser(undefined)(["row"], { meta: { scope: "public" } })).toEqual(["row"]);
    expect(keepPreviousDataForUser("user-a")(["row"], { meta: { scope: "public" } })).toBeUndefined();
  });
});

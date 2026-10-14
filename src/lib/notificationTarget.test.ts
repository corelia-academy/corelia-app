import { describe, expect, it } from "vitest";
import { notificationTarget } from "./notificationTarget";
describe("notification destinations", () => {
  it("keeps milestone and instructor deep links", () => {
    expect(notificationTarget({ target_path: "/feed?milestone=987" })).toBe("/feed?milestone=987");
    expect(notificationTarget({ target_path: "/instructor/courses/course/edit#assignments" })).toContain("#assignments");
  });
  it("rejects URLs which can leave the application", () => {
    for (const target_path of ["https://bad.test", "//bad.test", "/\\bad.test", "/\nbad.test", null]) expect(notificationTarget({ target_path })).toBe("/notifications");
  });
});

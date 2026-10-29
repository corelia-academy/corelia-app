import { describe, expect, it } from "vitest";
import { routeSkeletonVariantForPath } from "./routeSkeletonVariant";

describe("routeSkeletonVariantForPath", () => {
  it.each([
    ["/", "home"],
    ["/courses", "list"],
    ["/courses/react-basics", "detail"],
    ["/study/course-1/lesson/2", "learn"],
    ["/admin/instructors", "table"],
    ["/instructor/courses", "table"],
    ["/account/profile", "form"],
    ["/projects/new", "form"],
    ["/projects/my-app/edit", "form"],
    ["/projects/my-app", "detail"],
    ["/jobs/saved", "list"],
    ["/admin/branding", "form"],
    ["/admin/instructors/abc", "detail"],
    ["/instructor/courses/abc/edit", "form"],
  ])("maps %s to %s", (path, variant) => {
    expect(routeSkeletonVariantForPath(path)).toBe(variant);
  });
});

describe("placeholder path helpers", () => {
  it("detects workspace routes", async () => {
    const { isWorkspacePath } = await import("./routeSkeletonVariant");
    expect(isWorkspacePath("/admin")).toBe(true);
    expect(isWorkspacePath("/instructor/courses")).toBe(true);
    expect(isWorkspacePath("/instructors/abc")).toBe(false);
  });
});

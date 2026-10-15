import { describe, expect, it } from "vitest";
import { routeSkeletonVariantForPath } from "./routeSkeletonVariant";

describe("routeSkeletonVariantForPath", () => {
  it.each([
    ["/", "home"],
    ["/courses", "list"],
    ["/courses/react-basics", "detail"],
    ["/learn/course-1/lesson/2", "learn"],
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

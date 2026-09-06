import { describe, expect, it } from "vitest";
import { isPublicPresentation } from "./publicPresentation";

describe("public presentation boundary", () => {
  it.each(["/learn/course/lesson/lesson", "/feed", "/account/settings", "/achievements", "/jobs/saved", "/jobs/applied", "/jobs/hidden", "/projects/new", "/projects/demo/edit", "/admin/hackathons", "/instructor/courses"])('preserves private content layout for %s', path => {
    expect(isPublicPresentation(path, true)).toBe(false);
  });
  it.each(["/courses", "/courses/demo", "/career/demo", "/hackathons/demo/prizes", "/jobs/market", "/jobs/skills/typescript", "/projects/demo", "/search", "/@corelia"])('styles public route %s', path => {
    expect(isPublicPresentation(path, true)).toBe(true);
  });
  it("keeps the personal home unchanged", () => {
    expect(isPublicPresentation("/", true)).toBe(false);
    expect(isPublicPresentation("/", false)).toBe(true);
  });
});

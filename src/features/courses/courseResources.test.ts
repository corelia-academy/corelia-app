import { describe, expect, it } from "vitest";
import { courseResourceDraft, isValidCourseResources, visibleCourseResources } from "./courseResources";

const valid = { title: "Course repository", url: "https://github.com/example/course" };

describe("course resources", () => {
  it("accepts empty lists and public HTTP/HTTPS links", () => {
    expect(isValidCourseResources([])).toBe(true);
    expect(isValidCourseResources([{ ...valid, icon: "github" }, { title: "Docs", url: "http://example.com/docs", icon: "document" }])).toBe(true);
    expect(visibleCourseResources(undefined)).toEqual([]);
  });

  it("rejects unknown icon names and keeps resources without an icon backward compatible", () => {
    expect(isValidCourseResources([valid])).toBe(true);
    expect(isValidCourseResources([{ ...valid, icon: "unknown" }])).toBe(false);
    expect(visibleCourseResources([{ ...valid, icon: "unknown" }, valid])).toEqual([valid]);
  });

  it.each([null, {}, "link", { ...valid, title: " " }, { ...valid, url: "javascript:alert(1)" },
    { ...valid, url: "https://user:password@example.com" }, { ...valid, url: "https://example.com/a b" },
    { ...valid, url: "/relative" }, { ...valid, url: "ftp://example.com" }])("rejects unsafe or malformed resource %j without hiding valid siblings", invalid => {
    expect(isValidCourseResources([invalid])).toBe(false);
    expect(visibleCourseResources([invalid, valid])).toEqual([valid]);
  });

  it("preserves invalid strings for author repair without crashing on malformed legacy entries", () => {
    expect(courseResourceDraft([null, { title: 42, url: "broken" }, valid])).toEqual([
      { title: "", url: "", icon: "link" },
      { title: "", url: "broken", icon: "link" },
      { ...valid, icon: "link" },
    ]);
  });
});

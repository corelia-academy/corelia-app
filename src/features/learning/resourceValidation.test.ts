import { expect, it } from "vitest";
import { validateLessonResources } from "./validation";

it("allows incomplete resource text in drafts but requires both fields for publishing", () => {
  const resources = [{ title: "", url: "" }];
  expect(validateLessonResources(resources, "lesson", "vi", false)).toEqual([]);
  expect(validateLessonResources(resources, "lesson", "en", true)).toEqual([
    { lessonId: "lesson", locale: "en", field: "resource-0-title", code: "resource_title_required" },
    { lessonId: "lesson", locale: "en", field: "resource-0-url", code: "resource_url_invalid" },
  ]);
});
it.each(["javascript:alert(1)", "https://", "https://example.com/a b", "https://user:password@example.com", "data:text/html,hello"])("rejects unsafe or malformed draft URL %s", url => {
  expect(validateLessonResources([{ title: "Resource", url }], "lesson", "vi", false)[0].code).toBe("resource_url_invalid");
});
it("accepts existing HTTP and HTTPS resource links", () => {
  expect(validateLessonResources([{ title: "One", url: "http://example.com" }, { title: "Two", url: "https://example.com/path?q=value#heading" }], "lesson", "en", true)).toEqual([]);
});

it.each([{}, "legacy", [null], [{ title: 1, url: "https://example.com" }], [{ title: "Title", url: false }]])("reports malformed legacy resources without throwing: %j", resources => {
  expect(validateLessonResources(resources, "lesson", "en", false)).toEqual([
    { lessonId: "lesson", locale: "en", field: "resources", code: "invalid_resources" },
  ]);
});

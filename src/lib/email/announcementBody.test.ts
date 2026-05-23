import { describe, expect, it } from "vitest";
import { plainTextToAnnouncementHtml } from "./announcementBody";

describe("plainTextToAnnouncementHtml", () => {
  it("wraps paragraphs and escapes HTML", () => {
    expect(plainTextToAnnouncementHtml("Hello\n\nWorld")).toBe("<p>Hello</p><p>World</p>");
    expect(plainTextToAnnouncementHtml("<script>alert(1)</script>")).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
    );
  });

  it("preserves single line breaks within a paragraph", () => {
    expect(plainTextToAnnouncementHtml("Line one\nLine two")).toBe("<p>Line one<br />Line two</p>");
  });
});

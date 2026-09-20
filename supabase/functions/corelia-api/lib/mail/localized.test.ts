import { describe, expect, it } from "vitest";
import { localizedContentIssues, localizedVariables, readLocalizedEmailContent, selectLocalizedEmailContent } from "./localized.ts";

const complete = {
  vi: { subject: "Chào {{name}}", preheader: "", body_text: "Nội dung", cta_label: "Mở", cta_url: "https://example.com/{{id}}", image_url: null },
  en: { subject: "Hello {{name}}", preheader: "", body_text: "Body", cta_label: "Open", cta_url: "https://example.com/{{id}}", image_url: null },
};

describe("localized email content", () => {
  it("validates both locales and collects their variables", () => {
    const content = readLocalizedEmailContent(complete);
    expect(localizedContentIssues(content)).toEqual([]);
    expect(localizedVariables(content).sort()).toEqual(["id", "name"]);
  });

  it("reports incomplete translations and unsafe URLs", () => {
    expect(localizedContentIssues(readLocalizedEmailContent({ vi: complete.vi }))).toContain("en.subject");
    expect(localizedContentIssues(readLocalizedEmailContent({ ...complete, en: { ...complete.en, cta_url: "javascript:alert(1)" } }))).toContain("en.cta_url");
  });

  it("selects regional locales and defaults unknown values to English", () => {
    expect(selectLocalizedEmailContent(complete, "vi-VN")?.subject).toContain("Chào");
    expect(selectLocalizedEmailContent(complete, "fr")?.subject).toContain("Hello");
  });
});

import { describe, expect, it } from "vitest";
import { isSafeEmailUrl, missingTemplateVariables, renderEmailDocument, templateVariables } from "./template.ts";

describe("Email Center template rendering", () => {
  it("discovers and validates variables", () => {
    expect(templateVariables("Hi {{name}}", "{{ course_name }} / {{name}}")).toEqual(["name", "course_name"]);
    expect(missingTemplateVariables(["name", "url"], { name: "An" })).toEqual(["url"]);
  });

  it("escapes personalized values and rejects unsafe CTA URLs", () => {
    const rendered = renderEmailDocument({ subject: "Hi {{name}}", bodyText: "Welcome {{name}}", purpose: "learning", values: { name: "<b>An</b>" } });
    expect(rendered.subject).toBe("Hi &lt;b&gt;An&lt;/b&gt;");
    expect(rendered.html).not.toContain("<b>An</b>");
    expect(isSafeEmailUrl("javascript:alert(1)")).toBe(false);
  });

  it("renders the current Corelia brand shell", () => {
    const rendered = renderEmailDocument({
      subject: "Course update",
      bodyText: "Keep building.",
      ctaLabel: "Continue learning",
      ctaUrl: "https://app.corelia.academy/learn",
      purpose: "learning",
      values: {},
    });

    expect(rendered.html).toContain("background:#f4f7ff");
    expect(rendered.html).toContain("background: #0a0913");
    expect(rendered.html).toContain("background:#1759f1");
    expect(rendered.html).toContain("color:#ffffff");
    expect(rendered.html).not.toContain("Lora");
    expect(rendered.html).not.toContain("#2ab89e");
  });
});

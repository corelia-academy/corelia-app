import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildLearningReminderEmail } from "./learning_reminder_body.ts";

describe("buildLearningReminderEmail", () => {
  beforeEach(() => {
    vi.stubGlobal("Deno", { env: { get: () => "https://app.corelia.academy" } });
  });

  it("renders a responsive dark digest and escapes course data", () => {
    const result = buildLearningReminderEmail({
      courses: [
        { slug: "safe/course", title: '<script>alert("x")</script>' },
        { slug: "second", title: "Second course" },
      ],
      displayName: "<Admin>",
      locale: "en",
      stage: 7,
      appUrl: "https://app.corelia.academy",
    });

    expect(result.subject).toContain("It's been a week");
    expect(result.html).toContain("background-color:#0a0913");
    expect(result.html).toContain("@media only screen and (max-width:620px)");
    expect(result.html).toContain("safe%2Fcourse");
    expect(result.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(result.html).not.toContain('<script>alert("x")</script>');
    expect(result.html).toContain("&lt;Admin&gt;");
  });

  it("rejects an empty course digest", () => {
    expect(() => buildLearningReminderEmail({
      courses: [], displayName: "An", locale: "vi", stage: 3,
      appUrl: "https://app.corelia.academy",
    })).toThrow("learning_reminder_requires_course");
  });
});

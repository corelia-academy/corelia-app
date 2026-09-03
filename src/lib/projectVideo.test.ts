import { describe, expect, it } from "vitest";
import { projectVideoEmbed } from "./projectVideo";

describe("projectVideoEmbed", () => {
  it("normalizes supported providers", () => {
    expect(projectVideoEmbed("https://youtu.be/abc_123")?.src).toBe("https://www.youtube-nocookie.com/embed/abc_123");
    expect(projectVideoEmbed("https://vimeo.com/123456")?.src).toBe("https://player.vimeo.com/video/123456");
    expect(projectVideoEmbed("https://www.loom.com/share/abc-123")?.provider).toBe("loom");
  });

  it("does not embed unknown or unsafe URLs", () => {
    expect(projectVideoEmbed("https://example.com/video")).toBeNull();
    expect(projectVideoEmbed("javascript:alert(1)")).toBeNull();
  });
});

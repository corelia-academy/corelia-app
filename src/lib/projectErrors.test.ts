import { describe, expect, it } from "vitest";
import { formatProjectError } from "./projectErrors";

describe("formatProjectError", () => {
  const t = ((key: string) => key) as unknown as Parameters<typeof formatProjectError>[1];

  it("maps invalid url codes to translation keys", () => {
    expect(formatProjectError(new Error("invalid_url:demo_url"), t)).toBe("projects.form.errors.invalidDemoUrl");
    expect(formatProjectError(new Error("invalid_url:repo_url"), t)).toBe("projects.form.errors.invalidRepoUrl");
    expect(formatProjectError(new Error("invalid_url:slide_url"), t)).toBe("projects.form.errors.invalidSlideUrl");
  });

  it("maps unverifiable links to translation keys", () => {
    expect(formatProjectError(new Error("link_unverifiable:slide_url"), t)).toBe("projects.form.errors.unverifiableSlideUrl");
    expect(formatProjectError(new Error("link_unverifiable:repo_url"), t)).toBe("projects.form.errors.unverifiableRepoUrl");
  });

  it("maps moderation errors", () => {
    expect(formatProjectError(new Error("moderation_blocked:title"), t)).toBe("projects.form.errors.moderationTitle");
    expect(formatProjectError(new Error("moderation_blocked:screenshot"), t)).toBe("projects.form.errors.moderationImage");
  });

  it("maps AI service unavailability", () => {
    expect(formatProjectError(new Error("ai_unavailable:timeout"), t)).toBe("projects.form.errors.aiUnavailable");
  });

  it("falls back to generic error or message for unknown errors", () => {
    expect(formatProjectError(new Error("some_other_error"), t)).toBe("some_other_error");
    expect(formatProjectError(null, t)).toBe("projects.form.saveFailed");
  });
});

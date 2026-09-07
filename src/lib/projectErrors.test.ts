import { describe, expect, it } from "vitest";
import {
  formatProjectError,
  projectErrorMessage,
  resolveSemanticProjectError,
} from "./projectErrors";

describe("resolveSemanticProjectError", () => {
  it.each([
    ["already_registered", "already_registered"],
    ["conflict:already_registered", "already_registered"],
    ["submission_deadline_passed", "submission_deadline_passed"],
    ["forbidden:submission_deadline_passed", "submission_deadline_passed"],
    ["registration_deadline_passed", "registration_deadline_passed"],
    ["forbidden:registration_deadline_passed", "registration_deadline_passed"],
    ["project_already_exists", "project_already_exists"],
    ["conflict:project_already_exists", "project_already_exists"],
    ["conflict:hackathon_project_exists", "project_already_exists"],
    ["submission_unauthorized", "submission_unauthorized"],
    ["forbidden:submission_unauthorized", "submission_unauthorized"],
    ["moderation_flagged", "moderation_flagged"],
    ["moderation_flagged:summary", "moderation_flagged"],
    ["user_blocked", "user_blocked"],
    ["forbidden:user_blocked", "user_blocked"],
    ["rate_limit_exceeded", "rate_limit_exceeded"],
  ])("resolves 8 standardized codes: %s -> %s", (input, expectedCode) => {
    expect(resolveSemanticProjectError(new Error(input)).code).toBe(expectedCode);
    expect(resolveSemanticProjectError(input).code).toBe(expectedCode);
  });

  it.each([
    ["invalid_url:demo_url", "invalid_url", "demo_url"],
    ["link_unverifiable:repo_url", "link_unverifiable", "repo_url"],
    ["link_blocked:demo_url", "link_blocked", "demo_url"],
    ["moderation_blocked:title", "moderation_blocked", "title"],
    ["ai_unavailable:timeout", "ai_unavailable", undefined],
    ["required_content:resource", "resource_required", undefined],
    ["required_content:description", "content_required", "description"],
    ["media_upload_failed", "media_expired", undefined],
    ["invalid_input:project_screenshot_limit", "screenshot_limit", undefined],
    ["invalid_input:logo_size", "logo_size", undefined],
    ["invalid_input:screenshot_size", "screenshot_size", undefined],
    ["invalid_input:project_slug", "invalid_slug", undefined],
    ["conflict:taxonomy_in_use", "taxonomy", undefined],
    ["unauthenticated", "unauthenticated", undefined],
    ["forbidden:cannot_edit", "forbidden", undefined],
  ])("preserves legacy error categories: %s -> %s (field: %s)", (input, expectedCode, expectedField) => {
    const result = resolveSemanticProjectError(new Error(input));
    expect(result.code).toBe(expectedCode);
    expect(result.field).toBe(expectedField);
  });

  it("returns unknown for unmapped errors and empty inputs", () => {
    expect(resolveSemanticProjectError(new Error("unexpected_internal_crash")).code).toBe("unknown");
    expect(resolveSemanticProjectError("").code).toBe("unknown");
    expect(resolveSemanticProjectError(null).code).toBe("unknown");
    expect(resolveSemanticProjectError(undefined).code).toBe("unknown");
  });
});

describe("formatProjectError & projectErrorMessage", () => {
  const t = ((key: string, options?: Record<string, unknown>) => {
    if (options?.field) return `${key}:${String(options.field)}`;
    return key;
  }) as unknown as Parameters<typeof formatProjectError>[1];

  it.each([
    ["already_registered", "projects.errors.alreadyRegistered"],
    ["submission_deadline_passed", "projects.errors.deadline"],
    ["registration_deadline_passed", "projects.errors.registrationDeadlinePassed"],
    ["project_already_exists", "projects.errors.existing"],
    ["submission_unauthorized", "projects.errors.submissionUnauthorized"],
    ["moderation_flagged", "projects.errors.moderationFlagged"],
    ["user_blocked", "projects.errors.userBlocked"],
    ["rate_limit_exceeded", "projects.errors.rateLimitExceeded"],
  ])("maps 8 standardized codes to localized keys in formatProjectError: %s", (code, expectedKey) => {
    expect(formatProjectError(new Error(code), t)).toBe(expectedKey);
    expect(projectErrorMessage(new Error(code), t)).toBe(expectedKey);
  });

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

  it("never exposes raw backend code to the user and falls back safely to saveFailed", () => {
    expect(formatProjectError(new Error("some_other_unmapped_server_error"), t)).toBe("projects.form.saveFailed");
    expect(projectErrorMessage(new Error("internal_pg_error: 500"), t)).toBe("projects.form.saveFailed");
    expect(formatProjectError(null, t)).toBe("projects.form.saveFailed");
    expect(projectErrorMessage(null, t)).toBe("projects.form.saveFailed");
  });
});

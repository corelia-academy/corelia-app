import type { TFunction } from "i18next";

export type SemanticErrorCode =
  | "already_registered"
  | "submission_deadline_passed"
  | "registration_deadline_passed"
  | "project_already_exists"
  | "submission_unauthorized"
  | "moderation_flagged"
  | "user_blocked"
  | "rate_limit_exceeded"
  | "invalid_url"
  | "link_unverifiable"
  | "link_blocked"
  | "moderation_blocked"
  | "ai_unavailable"
  | "moderation_unavailable"
  | "media_expired"
  | "resource_required"
  | "content_required"
  | "screenshot_limit"
  | "logo_size"
  | "screenshot_size"
  | "invalid_slug"
  | "slug_conflict"
  | "image_type"
  | "taxonomy"
  | "unauthenticated"
  | "forbidden"
  | "operation_failed"
  | "unknown";

export interface SemanticProjectError {
  code: SemanticErrorCode;
  field?: string;
}

/**
 * Canonical internal parser that maps any raw backend error string, error instance,
 * or RPC exception into a structured semantic error.
 */
export function resolveSemanticProjectError(error: unknown): SemanticProjectError {
  const raw = (error instanceof Error ? error.message : typeof error === "string" ? error : "").trim();
  if (!raw) return { code: "unknown" };

  const clean = raw.replace(/^Error:\s*/, "");

  // 1. Exact or prefixed matching for the 8 standardized codes
  if (clean === "already_registered" || clean === "conflict:already_registered") {
    return { code: "already_registered" };
  }
  if (clean === "submission_deadline_passed" || clean === "forbidden:submission_deadline_passed") {
    return { code: "submission_deadline_passed" };
  }
  if (clean === "registration_deadline_passed" || clean === "forbidden:registration_deadline_passed") {
    return { code: "registration_deadline_passed" };
  }
  if (
    clean === "project_already_exists" ||
    clean === "conflict:project_already_exists" ||
    clean === "conflict:hackathon_project_exists"
  ) {
    return { code: "project_already_exists" };
  }
  if (clean === "submission_unauthorized" || clean === "forbidden:submission_unauthorized") {
    return { code: "submission_unauthorized" };
  }
  if (clean === "moderation_flagged" || clean.startsWith("moderation_flagged:")) {
    const field = clean.includes(":") ? clean.split(":")[1] : undefined;
    return { code: "moderation_flagged", field };
  }
  if (clean === "user_blocked" || clean === "forbidden:user_blocked") {
    return { code: "user_blocked" };
  }
  if (clean === "rate_limit_exceeded") {
    return { code: "rate_limit_exceeded" };
  }

  // 2. URLs and Link verification
  if (clean.startsWith("invalid_url:")) {
    const field = clean.slice("invalid_url:".length).trim();
    return { code: "invalid_url", field };
  }
  if (clean === "invalid_url") {
    return { code: "invalid_url" };
  }

  if (clean.startsWith("link_unverifiable:")) {
    const field = clean.slice("link_unverifiable:".length).trim();
    return { code: "link_unverifiable", field };
  }
  if (clean === "link_unverifiable" || clean.startsWith("link_rejected")) {
    return { code: "link_unverifiable" };
  }

  if (clean.startsWith("link_blocked:")) {
    const field = clean.slice("link_blocked:".length).trim();
    return { code: "link_blocked", field };
  }
  if (clean === "link_blocked") {
    return { code: "link_blocked" };
  }

  // 3. Moderation & AI
  if (clean.startsWith("moderation_blocked:")) {
    const field = clean.slice("moderation_blocked:".length).trim();
    return { code: "moderation_blocked", field };
  }
  if (clean === "moderation_blocked") {
    return { code: "moderation_blocked" };
  }
  if (clean === "moderation_unavailable") {
    return { code: "moderation_unavailable" };
  }
  if (clean === "ai_unavailable" || clean.startsWith("ai_unavailable:")) {
    return { code: "ai_unavailable" };
  }

  // 4. Content requirements
  if (clean === "required_content:resource") {
    return { code: "resource_required" };
  }
  if (clean.startsWith("required_content:")) {
    const field = clean.slice("required_content:".length).trim();
    return { code: "content_required", field };
  }

  // 5. Media & uploads
  if (clean.includes("_upload") || clean === "media_expired") {
    return { code: "media_expired" };
  }

  // 6. Validation / Input limits
  if (clean === "invalid_input:project_screenshot_limit") {
    return { code: "screenshot_limit" };
  }
  if (clean === "invalid_input:logo_size") {
    return { code: "logo_size" };
  }
  if (clean === "invalid_input:screenshot_size") {
    return { code: "screenshot_size" };
  }
  if (clean === "invalid_input:project_slug" || clean === "conflict:project_slug") {
    return { code: "invalid_slug" };
  }
  if (clean === "invalid_input:image_type") {
    return { code: "image_type" };
  }

  // 7. Taxonomy & Slugs
  if (clean.includes("taxonomy")) {
    return { code: "taxonomy" };
  }
  if (clean.includes("slug") || clean.includes("unique")) {
    return { code: "slug_conflict" };
  }
  if (clean.includes("deadline")) {
    return { code: "submission_deadline_passed" };
  }

  // 8. Auth & Operation
  if (clean === "unauthenticated") {
    return { code: "unauthenticated" };
  }
  if (clean === "forbidden" || clean.startsWith("forbidden:")) {
    return { code: "forbidden" };
  }
  if (clean === "project_operation_failed") {
    return { code: "operation_failed" };
  }

  return { code: "unknown" };
}

function resolveFieldLabel(field: string | undefined, t: TFunction): string {
  switch (field) {
    case "description":
      return t("projects.editor.description");
    case "progress":
      return t("projects.editor.progress");
    case "pitch_video_url":
      return t("projects.editor.pitchVideo");
    case "demo_url":
      return t("projects.form.demoUrl");
    case "repo_url":
      return t("projects.form.repoUrl");
    case "slide_url":
      return t("projects.form.slideUrl");
    case "video_url":
      return t("projects.form.videoUrl");
    case "title":
      return t("projects.form.title");
    case "summary":
      return t("projects.form.summary");
    case "logo":
      return t("projects.form.logo");
    case "screenshot":
    case "image":
      return t("projects.form.screenshots");
    default:
      return t("projects.editor.content");
  }
}

/** Keep server details out of product copy while identifying the field to fix. */
export function projectErrorMessage(error: unknown, t: TFunction<"common">): string {
  if (error instanceof Error && error.message.startsWith("rate_limited:project_translation")) return t("projects.translation.rateLimited");
  const semantic = resolveSemanticProjectError(error);
  const label = resolveFieldLabel(semantic.field, t);

  switch (semantic.code) {
    case "already_registered":
      return t("projects.errors.alreadyRegistered");
    case "submission_deadline_passed":
      return t("projects.errors.deadline");
    case "registration_deadline_passed":
      return t("projects.errors.registrationDeadlinePassed");
    case "project_already_exists":
      return t("projects.errors.existing");
    case "submission_unauthorized":
      return t("projects.errors.submissionUnauthorized");
    case "moderation_flagged":
      return t("projects.errors.moderationFlagged");
    case "user_blocked":
      return t("projects.errors.userBlocked");
    case "rate_limit_exceeded":
      return t("projects.errors.rateLimitExceeded");

    case "resource_required":
      return t("projects.errors.resourceRequired");
    case "content_required":
      return t("projects.errors.contentRequired", { field: label });
    case "media_expired":
      return t("projects.errors.mediaExpired");

    case "invalid_url":
    case "link_unverifiable":
    case "link_blocked":
      return t("projects.errors.link", { field: label });

    case "moderation_blocked":
      return t("projects.errors.moderation", { field: label });

    case "slug_conflict":
    case "invalid_slug":
      return t("projects.errors.slug");

    case "unauthenticated":
      return t("projects.errors.session");
    case "forbidden":
      return t("projects.errors.forbidden");

    case "taxonomy":
      return t("projects.errors.taxonomy");

    case "moderation_unavailable":
    case "ai_unavailable":
      return t("projects.errors.unavailable");

    case "screenshot_limit":
      return t("projects.form.screenshotLimit");
    case "logo_size":
      return t("projects.form.errors.logoSize");
    case "screenshot_size":
    case "image_type":
      return t("projects.form.screenshotInvalid");

    case "operation_failed":
    case "unknown":
    default:
      return t("projects.form.saveFailed");
  }
}

/** Form error formatter keeping server details internal and returning localized copy. */
export function formatProjectError(error: unknown, t: TFunction): string {
  const semantic = resolveSemanticProjectError(error);
  const label = resolveFieldLabel(semantic.field, t);

  switch (semantic.code) {
    case "already_registered":
      return t("projects.errors.alreadyRegistered");
    case "submission_deadline_passed":
      return t("projects.errors.deadline");
    case "registration_deadline_passed":
      return t("projects.errors.registrationDeadlinePassed");
    case "project_already_exists":
      return t("projects.errors.existing");
    case "submission_unauthorized":
      return t("projects.errors.submissionUnauthorized");
    case "moderation_flagged":
      return t("projects.errors.moderationFlagged");
    case "user_blocked":
      return t("projects.errors.userBlocked");
    case "rate_limit_exceeded":
      return t("projects.errors.rateLimitExceeded");

    case "invalid_url":
      if (semantic.field === "demo_url") return t("projects.form.errors.invalidDemoUrl");
      if (semantic.field === "repo_url") return t("projects.form.errors.invalidRepoUrl");
      if (semantic.field === "slide_url") return t("projects.form.errors.invalidSlideUrl");
      if (semantic.field === "video_url") return t("projects.form.errors.invalidVideoUrl");
      return t("projects.form.errors.invalidUrl");

    case "link_unverifiable":
      if (semantic.field === "demo_url") return t("projects.form.errors.unverifiableDemoUrl");
      if (semantic.field === "repo_url") return t("projects.form.errors.unverifiableRepoUrl");
      if (semantic.field === "slide_url") return t("projects.form.errors.unverifiableSlideUrl");
      return t("projects.form.errors.unverifiableLink");

    case "link_blocked":
      return t("projects.form.errors.linkBlocked");

    case "moderation_blocked":
      if (semantic.field === "title") return t("projects.form.errors.moderationTitle");
      if (semantic.field === "summary") return t("projects.form.errors.moderationSummary");
      if (semantic.field === "logo") return t("projects.form.errors.moderationLogo");
      if (semantic.field === "screenshot" || semantic.field === "image") {
        return t("projects.form.errors.moderationImage");
      }
      return t("projects.errors.moderation", { field: label });

    case "ai_unavailable":
    case "moderation_unavailable":
      return t("projects.form.errors.aiUnavailable");

    case "screenshot_limit":
      return t("projects.form.screenshotLimit");
    case "logo_size":
      return t("projects.form.errors.logoSize");
    case "screenshot_size":
    case "image_type":
      return t("projects.form.screenshotInvalid");
    case "invalid_slug":
      return t("projects.form.errors.invalidSlug");
    case "slug_conflict":
      return t("projects.errors.slug");

    case "taxonomy":
      return t("projects.errors.taxonomy");
    case "resource_required":
      return t("projects.errors.resourceRequired");
    case "content_required":
      return t("projects.errors.contentRequired", { field: label });
    case "media_expired":
      return t("projects.errors.mediaExpired");

    case "unauthenticated":
    case "forbidden":
      return t("projects.form.cannotEdit");

    case "operation_failed":
    case "unknown":
    default:
      return t("projects.form.saveFailed");
  }
}

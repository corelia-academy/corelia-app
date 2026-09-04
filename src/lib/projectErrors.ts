import type { TFunction } from "i18next";

export function formatProjectError(error: unknown, t: TFunction): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const code = raw.trim();

  if (code.startsWith("invalid_url:demo_url")) return t("projects.form.errors.invalidDemoUrl");
  if (code.startsWith("invalid_url:repo_url")) return t("projects.form.errors.invalidRepoUrl");
  if (code.startsWith("invalid_url:slide_url")) return t("projects.form.errors.invalidSlideUrl");
  if (code.startsWith("invalid_url:video_url")) return t("projects.form.errors.invalidVideoUrl");
  if (code.startsWith("invalid_url:")) return t("projects.form.errors.invalidUrl");

  if (code.startsWith("link_unverifiable:repo_url")) return t("projects.form.errors.unverifiableRepoUrl");
  if (code.startsWith("link_unverifiable:demo_url")) return t("projects.form.errors.unverifiableDemoUrl");
  if (code.startsWith("link_unverifiable:slide_url")) return t("projects.form.errors.unverifiableSlideUrl");
  if (code.startsWith("link_unverifiable:")) return t("projects.form.errors.unverifiableLink");

  if (code.startsWith("link_blocked:")) return t("projects.form.errors.linkBlocked");

  if (code.startsWith("moderation_blocked:title")) return t("projects.form.errors.moderationTitle");
  if (code.startsWith("moderation_blocked:summary")) return t("projects.form.errors.moderationSummary");
  if (code.startsWith("moderation_blocked:logo")) return t("projects.form.errors.moderationLogo");
  if (code.startsWith("moderation_blocked:screenshot") || code.startsWith("moderation_blocked:image")) {
    return t("projects.form.errors.moderationImage");
  }

  if (code.startsWith("ai_unavailable:")) return t("projects.form.errors.aiUnavailable");

  if (code.startsWith("invalid_input:project_screenshot_limit")) return t("projects.form.screenshotLimit");
  if (code.startsWith("invalid_input:logo_size")) return t("projects.form.errors.logoSize");
  if (code.startsWith("invalid_input:screenshot_size")) return t("projects.form.screenshotInvalid");
  if (code.startsWith("invalid_input:project_slug")) return t("projects.form.errors.invalidSlug");
  if (code.startsWith("invalid_input:image_type")) return t("projects.form.screenshotInvalid");

  if (code === "unauthenticated" || code.startsWith("forbidden:")) return t("projects.form.cannotEdit");
  if (code === "project_operation_failed") return t("projects.form.saveFailed");

  return raw || t("projects.form.saveFailed");
}

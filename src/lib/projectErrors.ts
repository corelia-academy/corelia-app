import type { TFunction } from "i18next";

/** Keep server details out of product copy while identifying the field to fix. */
export function projectErrorMessage(error: unknown, t: TFunction<"common">): string {
  const message = error instanceof Error ? error.message : "";
  const [code, field] = message.split(":");
  const fields: Record<string, "demoUrl" | "repoUrl" | "slideUrl" | "videoUrl" | "title" | "summary" | "logo" | "screenshots"> = {
    demo_url: "demoUrl",
    repo_url: "repoUrl",
    slide_url: "slideUrl",
    video_url: "videoUrl",
    title: "title",
    summary: "summary",
    logo: "logo",
    screenshot: "screenshots",
  };
  const label =
    field === "description"
      ? t("projects.editor.description")
      : field === "progress"
        ? t("projects.editor.progress")
        : field === "pitch_video_url"
          ? t("projects.editor.pitchVideo")
          : fields[field ?? ""]
            ? t(`projects.form.${fields[field!]}`)
            : t("projects.editor.content");
  if (code === "required_content") {
    return field === "resource" ? t("projects.errors.resourceRequired") : t("projects.errors.contentRequired", { field: label });
  }
  if (message.includes("_upload")) return t("projects.errors.mediaExpired");
  if (["invalid_url", "link_unverifiable", "link_rejected"].includes(code ?? "")) {
    return t("projects.errors.link", { field: label });
  }
  if (code === "moderation_blocked") return t("projects.errors.moderation", { field: label });
  if (["conflict:project_already_exists", "conflict:hackathon_project_exists"].includes(message)) {
    return t("projects.errors.existing");
  }
  if (message.includes("slug") || message.includes("unique")) return t("projects.errors.slug");
  if (message.includes("deadline")) return t("projects.errors.deadline");
  if (code === "unauthenticated") return t("projects.errors.session");
  if (code === "forbidden") return t("projects.errors.forbidden");
  if (message.includes("taxonomy")) return t("projects.errors.taxonomy");
  if (code === "moderation_unavailable" || code === "ai_unavailable") return t("projects.errors.unavailable");
  return t("projects.form.saveFailed");
}

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

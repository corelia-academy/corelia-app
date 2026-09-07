import type { TFunction } from "i18next";

/** Keep server details out of product copy while identifying the field to fix. */
export function projectErrorMessage(error: unknown, t: TFunction<"common">): string {
  const message = error instanceof Error ? error.message : "";
  const [code, field] = message.split(":");
  const fields: Record<string, "demoUrl" | "repoUrl" | "slideUrl" | "videoUrl" | "title" | "summary" | "logo" | "screenshots"> = {
    demo_url: "demoUrl", repo_url: "repoUrl", slide_url: "slideUrl", video_url: "videoUrl",
    title: "title", summary: "summary", logo: "logo", screenshot: "screenshots",
  };
  const label = field === "description" ? t("projects.editor.description") : field === "progress" ? t("projects.editor.progress") : field === "pitch_video_url" ? t("projects.editor.pitchVideo") : fields[field ?? ""] ? t(`projects.form.${fields[field!]}`) : t("projects.editor.content");
  if (message.includes("_upload")) return t("projects.errors.mediaExpired");
  if (["invalid_url", "link_unverifiable", "link_rejected"].includes(code ?? "")) {
    return t("projects.errors.link", { field: label });
  }
  if (code === "moderation_blocked") return t("projects.errors.moderation", { field: label });
  if (["conflict:project_already_exists", "conflict:hackathon_project_exists"].includes(message)) return t("projects.errors.existing");
  if (message.includes("slug") || message.includes("unique")) return t("projects.errors.slug");
  if (message.includes("deadline")) return t("projects.errors.deadline");
  if (code === "unauthenticated") return t("projects.errors.session");
  if (code === "forbidden") return t("projects.errors.forbidden");
  if (message.includes("taxonomy")) return t("projects.errors.taxonomy");
  if (code === "moderation_unavailable" || code === "ai_unavailable") return t("projects.errors.unavailable");
  return t("projects.form.saveFailed");
}

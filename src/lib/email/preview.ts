import { renderEmailDocument, templateVariables, type EmailDocumentParams } from "../../../supabase/functions/corelia-api/lib/mail/document.ts";

export type EmailPreviewDraft = Omit<EmailDocumentParams, "values" | "unsubscribeUrl">;
export type EmailPreviewError = "invalidCtaUrl" | "invalidImageUrl" | "previewFailed";

export function emailPreviewVariables(draft: EmailPreviewDraft): string[] {
  return templateVariables(draft.subject, draft.preheader, draft.bodyText, draft.ctaLabel, draft.ctaUrl, draft.imageUrl);
}

export function emailPreviewValues(draft: EmailPreviewDraft, appUrl: string, overrides: Record<string, string>): Record<string, string> {
  const vi = draft.locale !== "en";
  const defaults: Record<string, string> = {
    name: "Nguyễn Minh An", full_name: "Nguyễn Minh An", first_name: "An", last_name: "Nguyễn",
    email: "learner@example.com", locale: draft.locale ?? "vi",
    course_name: vi ? "Xây dựng sản phẩm với AI" : "Building products with AI",
    event_name: "Corelia Builder Day", event_url: `${appUrl}/hackathons/example`,
    course_url: `${appUrl}/learn/example`, image_url: `${appUrl}/Corelia_Banner_Square.png`,
  };
  return Object.fromEntries(emailPreviewVariables(draft).map((key) => [
    key, overrides[key] ?? defaults[key] ?? (/url$/i.test(key) ? `${appUrl}/example` : `[${key}]`),
  ]));
}

/** Uses exactly the same pure renderer as the server; no transport or secrets. */
export function buildEmailPreview(draft: EmailPreviewDraft, appUrl: string, values: Record<string, string>): { html: string; error: EmailPreviewError | null } {
  try {
    return { html: renderEmailDocument({ ...draft, values }, { appUrl }, "preview").html, error: null };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return { html: "", error: code === "unsafe_cta_url" ? "invalidCtaUrl" : code === "unsafe_image_url" ? "invalidImageUrl" : "previewFailed" };
  }
}

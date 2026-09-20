import { resolveAppUrl } from "../lib/mail/layout.ts";
import { renderEmailDocument as render, type EmailDocumentParams } from "../lib/mail/document.ts";
export { templateVariables, renderTextTemplate, missingTemplateVariables, isSafeEmailUrl } from "../lib/mail/document.ts";

export function renderEmailDocument(params: EmailDocumentParams): { subject: string; html: string } {
  return render(params, { appUrl: resolveAppUrl() }, `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
}

import { escapeHtml } from "../lib/html.ts";
import { emailCtaButton, wrapTransactionalEmail } from "../lib/mail/layout.ts";

const TOKEN = /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g;

export function templateVariables(...parts: Array<string | null | undefined>): string[] {
  return [...new Set(parts.flatMap((part) => [...(part ?? "").matchAll(TOKEN)].map((m) => m[1]!)))];
}

export function renderTextTemplate(input: string, values: Record<string, unknown>): string {
  return input.replace(TOKEN, (_match, key: string) => escapeHtml(String(values[key] ?? "")));
}

export function missingTemplateVariables(required: string[], values: Record<string, unknown>): string[] {
  return required.filter((key) => values[key] === undefined || values[key] === null || String(values[key]).trim() === "");
}

export function isSafeEmailUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  } catch {
    return false;
  }
}

export function renderEmailDocument(params: {
  subject: string;
  preheader?: string;
  bodyText: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  imageUrl?: string | null;
  locale?: string;
  purpose: string;
  values: Record<string, unknown>;
  unsubscribeUrl?: string;
}): { subject: string; html: string } {
  const subject = renderTextTemplate(params.subject, params.values);
  const body = renderTextTemplate(params.bodyText, params.values)
    .split(/\n\n+/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");
  const renderedUrl = params.ctaUrl ? renderTextTemplate(params.ctaUrl, params.values) : "";
  if (renderedUrl && !isSafeEmailUrl(renderedUrl)) throw new Error("unsafe_cta_url");
  const renderedImageUrl = params.imageUrl ? renderTextTemplate(params.imageUrl, params.values) : "";
  if (renderedImageUrl && !isSafeEmailUrl(renderedImageUrl)) throw new Error("unsafe_image_url");
  const purposeCopy: Record<string, { vi: string; en: string }> = {
    system: { vi: "Thông báo hệ thống", en: "System notification" },
    learning: { vi: "Hành trình học tập", en: "Learning journey" },
    event: { vi: "Chương trình và sự kiện", en: "Programs and events" },
    marketing: { vi: "Tin mới từ Corelia", en: "News from Corelia" },
  };
  const locale = params.locale === "en" ? "en" : "vi";
  const footer = locale === "vi" ? "Email được gửi bởi Corelia." : "This email was sent by Corelia.";
  const unsubscribe = params.unsubscribeUrl
    ? `<p><a href="${escapeHtml(params.unsubscribeUrl)}">${locale === "vi" ? "Hủy đăng ký nhận email" : "Unsubscribe"}</a></p>`
    : "";
  return {
    subject,
    html: wrapTransactionalEmail({
      locale,
      heroTag: purposeCopy[params.purpose]?.[locale] ?? purposeCopy.system[locale],
      heroTitle: subject,
      preheader: renderTextTemplate(params.preheader ?? "", params.values),
      bodyHtml: `${renderedImageUrl ? `<p><img src="${escapeHtml(renderedImageUrl)}" alt="" style="display:block;width:100%;height:auto;border-radius:12px" /></p>` : ""}${body}`,
      ctaHtml: renderedUrl && params.ctaLabel ? emailCtaButton(renderedUrl, renderTextTemplate(params.ctaLabel, params.values)) : undefined,
      footerReason: footer,
      footerExtraHtml: unsubscribe,
    }),
  };
}

import { escapeHtml } from "../html.ts";
import { emailCtaButton, renderTransactionalEmail, type EmailRenderContext } from "./render.ts";
import { normalizeEmailLocale, type EmailLocale } from "./locale.ts";

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

export type EmailDocumentParams = {
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
};

export function renderEmailDocument(params: EmailDocumentParams, context: EmailRenderContext, fingerprint = ""): { subject: string; html: string } {
  const interpolate = (input: string) => input.replace(TOKEN, (_match, key: string) => String(params.values[key] ?? ""));
  const subject = renderTextTemplate(params.subject, params.values);
  const body = escapeHtml(interpolate(params.bodyText))
    .split(/\n\n+/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");
  const renderedUrl = params.ctaUrl ? interpolate(params.ctaUrl) : "";
  if (renderedUrl && !isSafeEmailUrl(renderedUrl)) throw new Error("unsafe_cta_url");
  const renderedImageUrl = params.imageUrl ? interpolate(params.imageUrl) : "";
  if (renderedImageUrl && !isSafeEmailUrl(renderedImageUrl)) throw new Error("unsafe_image_url");
  const purposeCopy: Record<string, Record<EmailLocale, string>> = {
    system: { vi: "Thông báo hệ thống", en: "System notification", "zh-CN": "系统通知", ko: "시스템 알림", es: "Notificación del sistema", "zh-TW": "系統通知", ja: "システム通知" },
    learning: { vi: "Hành trình học tập", en: "Learning journey", "zh-CN": "学习之旅", ko: "학습 여정", es: "Trayectoria de aprendizaje", "zh-TW": "學習之旅", ja: "学習の旅" },
    event: { vi: "Chương trình và sự kiện", en: "Programs and events", "zh-CN": "项目与活动", ko: "프로그램 및 이벤트", es: "Programas y eventos", "zh-TW": "專案與活動", ja: "プログラムとイベント" },
    marketing: { vi: "Tin mới từ Corelia", en: "News from Corelia", "zh-CN": "Corelia 最新动态", ko: "Corelia 소식", es: "Novedades de Corelia", "zh-TW": "Corelia 最新動態", ja: "Corelia からのお知らせ" },
  };
  const UNSUBSCRIBE_LABEL: Record<EmailLocale, string> = {
    vi: "Hủy đăng ký nhận email", en: "Unsubscribe", "zh-CN": "退订邮件", ko: "수신 거부", es: "Cancelar suscripción", "zh-TW": "取消訂閱郵件", ja: "配信停止",
  };
  const locale = normalizeEmailLocale(params.locale);
  const unsubscribe = params.unsubscribeUrl
    ? `<p><a href="${escapeHtml(params.unsubscribeUrl)}">${UNSUBSCRIBE_LABEL[locale]}</a></p>`
    : "";
  return {
    subject,
    html: renderTransactionalEmail({
      fingerprint,
      locale,
      heroTag: purposeCopy[params.purpose]?.[locale] ?? purposeCopy.system[locale],
      heroTitle: interpolate(params.subject),
      preheader: interpolate(params.preheader ?? ""),
      bodyHtml: `${renderedImageUrl ? `<p><img src="${escapeHtml(renderedImageUrl)}" alt="" style="display:block;width:100%;height:auto;border-radius:12px" /></p>` : ""}${body}`,
      ctaHtml: renderedUrl && params.ctaLabel ? emailCtaButton(renderedUrl, interpolate(params.ctaLabel)) : undefined,
      footerExtraHtml: unsubscribe,
    }, context),
  };
}

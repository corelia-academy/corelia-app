import { escapeHtml } from "../html.ts";
import { normalizeEmailLocale, renderTransactionalEmail, type EmailLocale, type TransactionalWrapParams } from "./render.ts";
export { emailCtaButton, normalizeEmailLocale, type EmailLocale } from "./render.ts";

export function resolveAppUrl(): string {
  const getEnv = (name: string): string =>
    typeof Deno !== "undefined"
      ? Deno.env.get(name)?.trim() ?? ""
      : typeof process !== "undefined"
        ? process.env[name]?.trim() ?? ""
        : "";
  const raw =
    getEnv("APP_URL") ||
    getEnv("CORELIA_APP_ORIGIN") ||
    "https://app.corelia.dev";
  return raw.replace(/\/+$/, "");
}

export function resolveEmailAssetBaseUrl(): string {
  const supabaseUrl = typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_URL")?.trim() ?? "" : "";
  return supabaseUrl
    ? `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/public_files/email-assets/v1`
    : `${resolveAppUrl()}/email-assets`;
}

/** Environment and per-send identity stay on the server; the renderer is pure. */
export function wrapTransactionalEmail(params: TransactionalWrapParams): string {
  const fingerprint = params.fingerprint?.trim()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return renderTransactionalEmail({ ...params, fingerprint }, { appUrl: resolveAppUrl(), assetBaseUrl: resolveEmailAssetBaseUrl() });
}

export type BlastEmailKind = "course" | "hackathon";

const BLAST_COPY: Record<
  BlastEmailKind,
  Record<EmailLocale, { tag: string; title: string; reason: string }>
> = {
  course: {
    "zh-CN": {
      tag: "课程公告",
      title: "来自讲师的消息",
      reason: "您收到此邮件是因为您已在 Corelia 报名了课程。",
    },
    ko: {
      tag: "강의 공지",
      title: "강사님의 메시지",
      reason: "Corelia에서 강의에 등록하셨기 때문에 이 이메일을 받으셨습니다.",
    },
    es: {
      tag: "Anuncio del curso",
      title: "Mensaje de tu instructor",
      reason: "Recibes este correo porque te inscribiste en un curso en Corelia.",
    },
    "zh-TW": {
      tag: "課程公告",
      title: "來自講師的訊息",
      reason: "您收到此郵件是因為您已在 Corelia 報名了課程。",
    },
    ja: {
      tag: "コースのお知らせ",
      title: "講師からのメッセージ",
      reason: "Corelia でコースに登録されたため、このメールをお送りしています。",
    },
    vi: {
      tag: "Thông báo khóa học",
      title: "Tin từ giảng viên",
      reason: "Bạn nhận email này vì đã đăng ký khóa học trên Corelia.",
    },
    en: {
      tag: "Course announcement",
      title: "Message from your instructor",
      reason: "You received this because you enrolled in a course on Corelia.",
    },
  },
  hackathon: {
    "zh-CN": {
      tag: "黑客松公告",
      title: "来自组织方的消息",
      reason: "您收到此邮件是因为您已在 Corelia 报名了黑客松。",
    },
    ko: {
      tag: "해커톤 공지",
      title: "주최 측의 메시지",
      reason: "Corelia에서 해커톤에 등록하셨기 때문에 이 이메일을 받으셨습니다.",
    },
    es: {
      tag: "Anuncio del hackathon",
      title: "Mensaje de los organizadores",
      reason: "Recibes este correo porque te registraste en un hackathon en Corelia.",
    },
    "zh-TW": {
      tag: "黑客松公告",
      title: "來自主辦單位的訊息",
      reason: "您收到此郵件是因為您已在 Corelia 報名了黑客松。",
    },
    ja: {
      tag: "ハッカソンのお知らせ",
      title: "主催者からのメッセージ",
      reason: "Corelia でハッカソンに登録されたため、このメールをお送りしています。",
    },
    vi: {
      tag: "Thông báo hackathon",
      title: "Tin từ ban tổ chức",
      reason: "Bạn nhận email này vì đã đăng ký hackathon trên Corelia.",
    },
    en: {
      tag: "Hackathon announcement",
      title: "Message from organizers",
      reason: "You received this because you registered for a hackathon on Corelia.",
    },
  },
};

const MANAGE_LABEL: Record<EmailLocale, string> = {
  en: "Manage notification preferences",
  "zh-CN": "管理通知偏好",
  ko: "알림 설정 관리",
  es: "Gestionar preferencias de notificaciones",
  "zh-TW": "管理通知偏好",
  vi: "Quản lý tuỳ chọn thông báo",
  ja: "通知設定を管理",
};

type BlastWrapParams = {
  bodyHtml: string;
  locale?: string | null;
  kind: BlastEmailKind;
  unsubUrl?: string;
};

/** Branded shell for instructor/organizer blast emails; body is user-authored HTML. */
export function wrapBlastEmail(params: BlastWrapParams): string {
  const locale = normalizeEmailLocale(params.locale);
  const copy = BLAST_COPY[params.kind][locale];
  const unsubUrl = (params.unsubUrl ?? `${resolveAppUrl()}/account/settings`).trim();
  const manageLabel = MANAGE_LABEL[locale];

  return wrapTransactionalEmail({
    locale,
    heroTag: copy.tag,
    heroTitle: copy.title,
    bodyHtml: params.bodyHtml,
    footerReason: copy.reason,
    footerExtraHtml:
      `<p style="margin-top:8px"><a href="${escapeHtml(unsubUrl)}">${escapeHtml(manageLabel)}</a></p>`,
  });
}

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

/** Environment and per-send identity stay on the server; the renderer is pure. */
export function wrapTransactionalEmail(params: TransactionalWrapParams): string {
  const fingerprint = params.fingerprint?.trim()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return renderTransactionalEmail({ ...params, fingerprint }, { appUrl: resolveAppUrl() });
}

export type BlastEmailKind = "course" | "career_track" | "hackathon";

const BLAST_COPY: Record<
  BlastEmailKind,
  Record<EmailLocale, { tag: string; title: string; reason: string }>
> = {
  course: {
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
  career_track: {
    vi: {
      tag: "Thông báo lộ trình",
      title: "Tin từ lộ trình học",
      reason: "Bạn nhận email này vì đã đăng ký khóa học trong lộ trình học trên Corelia.",
    },
    en: {
      tag: "Learning path update",
      title: "Message from your learning path",
      reason: "You received this because you enrolled in courses on a Corelia learning path.",
    },
  },
  hackathon: {
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
  const manageLabel = locale === "vi" ? "Quản lý tuỳ chọn thông báo" : "Manage notification preferences";

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

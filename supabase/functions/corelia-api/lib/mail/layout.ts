import { escapeHtml } from "../html.ts";

const LOGO_URL =
  "https://lawhkvyyoznwygzsycan.supabase.co/storage/v1/object/public/public_files/Corelia_Logo_White.png";

export type EmailLocale = "vi" | "en";

export function normalizeEmailLocale(locale?: string | null): EmailLocale {
  const v = (locale ?? "").trim().toLowerCase();
  if (v === "vi" || v === "vn") return "vi";
  return "en";
}

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

const EMAIL_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  .e-container {
    max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px;
    overflow: hidden; border: 1px solid #d8dfed;
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
  }
  .e-brand-line { height: 4px; background: #1759f1; font-size: 0; line-height: 0; }
  .e-header { background: #0a0913; padding: 22px 32px; }
  .e-hero {
    background: #ffffff; padding: 36px 32px 18px;
  }
  .e-hero-tag {
    display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: #1749de; background: #eef5ff;
    padding: 6px 10px; border-radius: 999px; margin-bottom: 16px;
  }
  .e-hero h2 {
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-size: 30px;
    font-weight: 700; letter-spacing: -0.03em; line-height: 1.18; color: #171923;
    margin-bottom: 10px;
  }
  .e-hero p { font-size: 15px; line-height: 1.55; color: #526079; }
  .e-body { padding: 14px 32px 24px; }
  .e-body p {
    font-size: 16px; line-height: 1.55; color: #526079; margin-bottom: 16px;
  }
  .e-body p:last-child { margin-bottom: 0; }
  .e-body a { color: #1759f1; }
  .e-body strong { color: #171923; }
  .e-cta-wrap { padding: 0 32px 36px; }
  .e-btn {
    display: inline-block; background: #1759f1; color: #ffffff;
    font-size: 15px; font-weight: 700; line-height: 1.2; padding: 14px 22px;
    border-radius: 8px; text-decoration: none;
  }
  .e-btn-primary { background: #1759f1; color: #ffffff; }
  .e-footer {
    background: #f4f7ff; padding: 22px 32px; text-align: left;
    border-top: 1px solid #d8dfed;
  }
  .e-footer p {
    font-size: 12px; color: #596587; line-height: 1.6; margin-bottom: 4px;
  }
  .e-footer a { color: #1759f1; }
  @media only screen and (max-width: 620px) {
    .e-header { padding: 20px 24px !important; }
    .e-hero { padding: 30px 24px 16px !important; }
    .e-hero h2 { font-size: 26px !important; }
    .e-body { padding: 12px 24px 22px !important; }
    .e-cta-wrap { padding: 0 24px 30px !important; }
    .e-footer { padding: 20px 24px !important; }
  }
`;

type TransactionalWrapParams = {
  locale?: string | null;
  heroTag: string;
  heroTitle: string;
  heroSubtitle?: string;
  bodyHtml: string;
  ctaHtml?: string;
  footerReason: string;
  footerExtraHtml?: string;
  /** Hidden inbox-preview text. Defaults to heroSubtitle or heroTitle. */
  preheader?: string;
  /** Stable fingerprint for deterministic retry idempotency. If omitted, generates random timestamp. */
  fingerprint?: string;
};

/** Full branded HTML document for fixed transactional emails (Resend). */
export function wrapTransactionalEmail(params: TransactionalWrapParams): string {
  const locale = normalizeEmailLocale(params.locale);
  const heroSubtitle = params.heroSubtitle?.trim()
    ? `<p>${params.heroSubtitle}</p>`
    : "";
  // No divider between CTA and footer — the .e-footer border-top is enough
  // visually, and a standalone <div> divider triggers Gmail's "show trimmed
  // content" heuristic that hides everything below it.
  const ctaBlock = params.ctaHtml?.trim()
    ? `<div class="e-cta-wrap">${params.ctaHtml}</div>`
    : "";

  // Unique per-send fingerprint so Gmail doesn't dedupe boilerplate footer
  // across multiple emails to the same recipient.
  // Use caller-provided stable fingerprint if supplied to keep retried request bodies byte-identical.
  const messageFingerprint = params.fingerprint?.trim()
    ? params.fingerprint.trim()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const preheaderText = (params.preheader ?? params.heroSubtitle ?? params.heroTitle).trim();
  const preheaderBlock = preheaderText
    ? `<div style="display:none!important;visibility:hidden;opacity:0;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f4f7ff;">${escapeHtml(preheaderText)}</div>`
    : "";

  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(params.heroTitle)}</title>
    <style>${EMAIL_STYLES}</style>
  </head>
  <body style="margin:0;padding:32px 14px;background:#f4f7ff;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
    ${preheaderBlock}
    <div class="e-container">
      <div class="e-brand-line">&nbsp;</div>
      <div class="e-header">
        <img src="${LOGO_URL}" alt="Corelia Academy" height="34" style="display:block;height:34px;width:auto" />
      </div>
      <div class="e-hero">
        <span class="e-hero-tag">${escapeHtml(params.heroTag)}</span>
        <h2>${escapeHtml(params.heroTitle)}</h2>
        ${heroSubtitle}
      </div>
      <div class="e-body">${params.bodyHtml}</div>
      ${ctaBlock}
      <div class="e-footer">
        <p>${escapeHtml(params.footerReason)}</p>
        ${params.footerExtraHtml ?? ""}
        <p><a href="${escapeHtml(resolveAppUrl())}">app.corelia.academy</a></p>
      </div>
    </div>
    <span style="display:none!important;font-size:0;color:transparent;line-height:0;mso-hide:all">${messageFingerprint}</span>
  </body>
</html>`;
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

/** Primary CTA button for transactional emails. */
export function emailCtaButton(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" class="e-btn e-btn-primary" style="display:inline-block;background:#1759f1;color:#ffffff;font-size:15px;font-weight:700;line-height:1.2;padding:14px 22px;border-radius:8px;text-decoration:none;">${escapeHtml(label)}</a>`;
}

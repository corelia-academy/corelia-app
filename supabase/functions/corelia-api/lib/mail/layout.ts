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
  const raw =
    Deno.env.get("APP_URL")?.trim() ||
    Deno.env.get("CORELIA_APP_ORIGIN")?.trim() ||
    "https://app.corelia.dev";
  return raw.replace(/\/+$/, "");
}

const EMAIL_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  .e-container {
    max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px;
    overflow: hidden; border: 1px solid #ddd7cf;
    font-family: "Google Sans", "Google Sans Text", Roboto, Arial, sans-serif;
  }
  .e-header { background: #1e2440; padding: 20px 30px; }
  .e-hero {
    background: #f5f0eb; padding: 30px 30px 22px; border-bottom: 1px solid #ddd7cf;
  }
  .e-hero-tag {
    display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
    text-transform: uppercase; color: #2ab89e; background: rgba(62, 207, 180, 0.1);
    padding: 3px 11px; border-radius: 100px; margin-bottom: 13px;
  }
  .e-hero h2 {
    font-family: "Lora", Georgia, serif; font-size: 25px; font-weight: 400;
    font-style: italic; line-height: 1.25; color: #1e2440; margin-bottom: 9px;
  }
  .e-hero p { font-size: 13px; line-height: 1.75; color: #3d4566; }
  .e-body { padding: 22px 30px; }
  .e-body p {
    font-size: 13px; line-height: 1.8; color: #3d4566; margin-bottom: 12px;
  }
  .e-body p:last-child { margin-bottom: 0; }
  .e-body a { color: #2ab89e; }
  .e-body strong { color: #1e2440; }
  .e-cta-wrap { padding: 4px 30px 22px; }
  .e-btn {
    display: inline-block; background: #1e2440; color: #ffffff;
    font-size: 13px; font-weight: 600; padding: 12px 28px; border-radius: 8px;
    text-decoration: none;
  }
  .e-btn-teal {
    background: linear-gradient(135deg, #3ecfb4, #2ab89e); color: #1e2440;
  }
  .e-divider { height: 1px; background: #ddd7cf; margin: 0 30px 20px; }
  .e-footer {
    background: #ede7df; padding: 16px 30px; text-align: center;
    border-top: 1px solid #ddd7cf;
  }
  .e-footer p {
    font-size: 11px; color: #8a8fa8; line-height: 1.7; margin-bottom: 3px;
  }
  .e-footer a { color: #8a8fa8; }
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
};

/** Full branded HTML document for fixed transactional emails (Resend). */
export function wrapTransactionalEmail(params: TransactionalWrapParams): string {
  const locale = normalizeEmailLocale(params.locale);
  const heroSubtitle = params.heroSubtitle?.trim()
    ? `<p>${params.heroSubtitle}</p>`
    : "";
  const ctaBlock = params.ctaHtml?.trim()
    ? `<div class="e-cta-wrap">${params.ctaHtml}</div><div class="e-divider"></div>`
    : "";

  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400;1,600&display=swap" rel="stylesheet" />
    <style>${EMAIL_STYLES}</style>
  </head>
  <body style="margin:0;padding:28px 14px;background:#f5f0eb;font-family:Roboto,Arial,sans-serif;">
    <div class="e-container">
      <div class="e-header">
        <img src="${LOGO_URL}" alt="Corelia Academy" height="36" style="display:block;height:36px;width:auto" />
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
  return `<a href="${escapeHtml(href)}" class="e-btn e-btn-teal">${escapeHtml(label)}</a>`;
}

import { escapeHtml } from "../html.ts";
import { EMAIL_BRAND as b, EMAIL_CLASS_STYLES, EMAIL_STYLES } from "./brand.ts";
import { normalizeEmailLocale } from "./locale.ts";
export { normalizeEmailLocale, parseEmailLocale, resolveRecipientEmailLocale, type EmailLocale, type EmailLocaleSource } from "./locale.ts";

export type EmailRenderContext = { appUrl: string; assetBaseUrl?: string; logoUrl?: string; backgroundUrl?: string };
export type TransactionalWrapParams = {
  locale?: string | null;
  heroTag: string;
  heroTitle: string;
  /** Trusted HTML fragment; callers must escape user-controlled text. */
  heroSubtitle?: string;
  bodyHtml: string;
  ctaHtml?: string;
  footerReason?: string;
  footerExtraHtml?: string;
  preheader?: string;
  fingerprint?: string;
};

const TAG_STYLES: Record<string, string> = {
  p: `margin:0 0 16px;line-height:1.6;color:${b.muted};`,
  h2: `margin:0 0 14px;font-family:${b.headingFont};font-size:30px;line-height:1.15;letter-spacing:-0.02em;font-weight:500;color:${b.text};`,
  a: `color:${b.link};text-decoration:underline;overflow-wrap:anywhere;word-break:break-word;`,
  strong: `color:${b.text};`,
  ul: "margin:0 0 16px;padding-left:20px;",
  ol: "margin:0 0 16px;padding-left:20px;",
  li: "margin-bottom:6px;line-height:1.6;",
  img: "border:0;max-width:100%;height:auto;",
};

/** Style only our generated, escaped fragments. This is not an HTML sanitizer. */
export function inlineEmailHtml(html: string): string {
  return html.replace(/<([a-z][a-z0-9]*)\b([^>]*?)>/gi, (tag, name: string, attrs: string) => {
    const classes = attrs.match(/\bclass="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];
    const tagDefaults = classes.some((className) => className.startsWith("e-footer-item"))
      ? ""
      : TAG_STYLES[name.toLowerCase()] ?? "";
    const defaults = tagDefaults + classes.map((c) => EMAIL_CLASS_STYLES[c] ?? "").join("");
    if (!defaults) return tag;
    const existing = attrs.match(/\bstyle="([^"]*)"/)?.[1] ?? "";
    const rest = attrs.replace(/\s*style="[^"]*"/, "").replace(/\s*\/$/, "");
    return `<${name}${rest} style="${defaults}${existing}">`;
  });
}

export function emailSection(className: string, html: string): string {
  return `<tr><td class="${className}" style="${EMAIL_CLASS_STYLES[className] ?? ""}">${html}</td></tr>`;
}

/** Pure document frame, also used by the local Auth template generator. */
export function renderEmailFrame(params: {
  locale: string;
  title: string;
  sectionsHtml: string;
  preheader?: string;
  fingerprint?: string;
}, context: EmailRenderContext): string {
  const appUrl = context.appUrl.replace(/\/+$/, "");
  const assetBaseUrl = (context.assetBaseUrl ?? `${appUrl}/email-assets`).replace(/\/+$/, "");
  const backgroundUrl = context.backgroundUrl ?? `${assetBaseUrl}/corelia-background-v1.jpg`;
  const fonts = `
    @font-face { font-family:Akt;src:url('${assetBaseUrl}/akt-medium.ttf') format('truetype');font-weight:500;font-style:normal;font-display:swap; }
    @font-face { font-family:'TT Norms Pro Trial';src:url('${assetBaseUrl}/tt-norms-pro-normal.ttf') format('truetype');font-weight:400;font-style:normal;font-display:swap; }
    @font-face { font-family:'TT Norms Pro Trial';src:url('${assetBaseUrl}/tt-norms-pro-medium.ttf') format('truetype');font-weight:500;font-style:normal;font-display:swap; }
    @font-face { font-family:'PP Supply Sans';src:url('${assetBaseUrl}/pp-supply-sans-regular.otf') format('opentype');font-weight:400;font-style:normal;font-display:swap; }
  `.trim();
  const preheader = params.preheader ? `<div style="display:none!important;visibility:hidden;opacity:0;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${b.background};">${escapeHtml(params.preheader)}</div>` : "";
  // The background is isolated from content styles so stripping it cannot erase typography.
  return `<!doctype html>
<html lang="${escapeHtml(params.locale)}">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="dark" /><meta name="supported-color-schemes" content="dark" />
<title>${escapeHtml(params.title)}</title><style>${fonts}${EMAIL_STYLES}</style></head>
<body bgcolor="${b.background}" style="margin:0;padding:0;background-color:${b.background};color:${b.text};font-family:${b.font};">
${preheader}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${b.background}" style="width:100%;background-color:${b.background};border-collapse:collapse;">
<tr><td background="${escapeHtml(backgroundUrl)}" style="background-image:url('${escapeHtml(backgroundUrl)}');background-position:center;background-size:cover;background-repeat:no-repeat;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;"><tr><td class="e-outer" align="center" style="padding:32px 14px;">
<!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="e-container" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${b.background}" style="width:100%;max-width:600px;table-layout:fixed;margin:0 auto;border:1px solid ${b.border};border-collapse:separate;border-spacing:0;background-color:${b.background};color:${b.text};font-family:${b.font};font-size:16px;line-height:1.6;overflow-wrap:anywhere;word-break:break-word;text-align:left;">
${emailSection("e-header", `<img src="${escapeHtml(context.logoUrl ?? b.logoUrl)}" alt="Corelia Academy" width="125" height="50" style="display:block;width:125px;max-width:100%;height:50px;object-fit:contain;border:0;color:${b.text};font-size:16px;" />`)}
${params.sectionsHtml}
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></td></tr></table>
<span style="display:none!important;font-size:0;color:transparent;line-height:0;mso-hide:all">${escapeHtml(params.fingerprint ?? "")}</span>
</body></html>`;
}

export function renderTransactionalEmail(params: TransactionalWrapParams, context: EmailRenderContext): string {
  const hero = `<span class="e-hero-tag">${escapeHtml(params.heroTag)}</span><h2>${escapeHtml(params.heroTitle)}</h2>${params.heroSubtitle?.trim() ? `<p>${params.heroSubtitle}</p>` : ""}`;
  const appUrl = context.appUrl.replace(/\/+$/, "");
  let websiteLabel = appUrl;
  try {
    websiteLabel = new URL(appUrl).hostname;
  } catch {
    // Keep the environment origin visible if a preview passes a non-standard URL.
  }
  const reason = params.footerReason?.trim()
    ? `<p class="e-footer-item">${escapeHtml(params.footerReason.trim())}</p>`
    : "";
  const extra = (params.footerExtraHtml ?? "").trim()
    .replace(/<p\s*>/gi, '<p class="e-footer-item">');
  const website = `<p class="e-footer-item-last"><a href="${escapeHtml(appUrl)}">${escapeHtml(websiteLabel)}</a></p>`;
  const footer = `${reason}${extra}${website}`;
  const sectionsHtml = emailSection("e-hero", inlineEmailHtml(hero))
    + emailSection("e-body", inlineEmailHtml(params.bodyHtml))
    + (params.ctaHtml?.trim() ? emailSection("e-cta-wrap", inlineEmailHtml(params.ctaHtml)) : "")
    + (footer.trim() ? emailSection("e-footer", inlineEmailHtml(footer)) : "");
  return renderEmailFrame({
    locale: normalizeEmailLocale(params.locale), title: params.heroTitle, sectionsHtml,
    preheader: (params.preheader ?? params.heroSubtitle ?? params.heroTitle).trim(), fingerprint: params.fingerprint,
  }, context);
}

export function emailCtaButton(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" class="e-btn e-btn-primary">${escapeHtml(label)}</a>`;
}

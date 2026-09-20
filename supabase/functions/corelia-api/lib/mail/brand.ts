/** Shared by Edge rendering, browser preview and generated Auth templates. */
export const EMAIL_BRAND = {
  background: "#0a0913",
  surface: "#12121e",
  text: "#eae6e3",
  muted: "#b6b8c8",
  border: "#2b2b3b",
  primary: "#1759f1",
  link: "#9bbcff",
  white: "#ffffff",
  font: "'TT Norms Pro Trial', Arial, 'Helvetica Neue', Helvetica, sans-serif",
  headingFont: "Akt, Arial, 'Helvetica Neue', Helvetica, sans-serif",
  labelFont: "'PP Supply Sans', 'Courier New', monospace",
  backgroundPath: "/email-assets/corelia-background-v1.jpg",
  logoUrl: "https://lawhkvyyoznwygzsycan.supabase.co/storage/v1/object/public/public_files/Corelia_Logo_White.png",
} as const;

const b = EMAIL_BRAND;
// Gmail on iOS may invert solid dark backgrounds. A same-color gradient keeps
// these surfaces dark while background-color remains the fallback elsewhere.
const darkSurface = `background-color:${b.background};background-image:linear-gradient(${b.background},${b.background});`;
const raisedSurface = `background-color:${b.surface};background-image:linear-gradient(${b.surface},${b.surface});`;
export const EMAIL_CLASS_STYLES: Record<string, string> = {
  "e-header": `padding:12px 24px;${darkSurface}border-bottom:1px solid ${b.border};`,
  "e-hero": "padding:30px 24px 10px;",
  "e-hero-tag": `display:block;font-family:${b.labelFont};font-size:10px;font-weight:400;letter-spacing:0.05em;text-transform:uppercase;color:#cbd1e2;margin-bottom:14px;`,
  "e-body": "padding:16px 24px 24px;",
  "e-cta-wrap": `padding:0 24px 28px;border-bottom:1px solid ${b.border};`,
  "e-btn": `display:inline-block;box-sizing:border-box;max-width:100%;background-color:${b.primary};color:#f4f7ff;font-size:16px;font-weight:400;line-height:1.4;padding:11px 16px;border:1px solid #5ba3ff;border-radius:8px;text-decoration:none;text-align:center;overflow-wrap:anywhere;word-break:break-word;`,
  "e-footer": `padding:16px 24px;${darkSurface}font-size:12px;color:${b.muted};line-height:18px;text-align:left;`,
  "e-footer-item": `margin:0 0 4px;line-height:18px;color:${b.muted};`,
  "e-footer-item-last": `margin:0;line-height:18px;color:${b.muted};`,
  "e-info-card": `padding:20px 24px;${raisedSurface}border-top:1px solid ${b.border};border-bottom:1px solid ${b.border};`,
  "e-info-card-label": `font-family:${b.labelFont};font-size:10px;font-weight:400;letter-spacing:0.05em;text-transform:uppercase;color:#cbd1e2;margin-bottom:12px;`,
  "e-info-row": "font-size:14px;line-height:1.6;",
  "e-info-key": `display:inline-block;margin-right:16px;color:${b.muted};`,
  "e-info-val": `display:inline-block;color:${b.text};font-weight:700;`,
  "e-otp": `padding:24px;${raisedSurface}border-top:1px solid ${b.border};border-bottom:1px solid ${b.border};text-align:center;`,
  "e-otp-code": `font-family:monospace;font-size:32px;font-weight:700;letter-spacing:0.16em;line-height:1.5;color:${b.text};overflow-wrap:anywhere;`,
  "e-otp-hint": `font-size:12px;line-height:1.6;color:${b.muted};margin-top:8px;`,
  "e-alert": `padding:24px;${darkSurface}border-bottom:1px solid ${b.border};`,
  "e-alert-icon": "display:inline-block;margin-bottom:8px;",
  "e-alert-text": `font-size:14px;line-height:1.6;color:${b.text};`,
};

// Essential appearance is inline. These rules only enhance small-screen layout.
export const EMAIL_STYLES = `
  @media only screen and (max-width:620px) {
    .e-outer { padding:24px 12px !important; }
    .e-container { font-size:15px !important; }
    .e-hero h2 { font-size:24px !important; }
  }
`;

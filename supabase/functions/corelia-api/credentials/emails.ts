import { escapeHtml } from "../lib/html.ts";

export type CredentialMintEmailKind = "course" | "hackathon" | "milestone";

export function buildCredentialMintEmail(params: {
  kind: CredentialMintEmailKind;
  badgeName: string;
  profileUrl: string;
  credentialId?: string | null;
  imageUrl?: string | null;
}): { subject: string; html: string } {
  const title =
    params.kind === "hackathon"
      ? "Bạn vừa nhận giải thưởng hackathon"
      : params.kind === "milestone"
      ? "Bạn vừa đạt một thành tích"
      : "Bạn vừa nhận huy hiệu hoàn thành khóa học";

  const subject =
    params.kind === "hackathon"
      ? `Giải thưởng: ${params.badgeName}`
      : params.kind === "milestone"
      ? `Thành tích: ${params.badgeName}`
      : `Huy hiệu: ${params.badgeName}`;

  const img =
    params.imageUrl?.trim()
      ? `<p><img src="${escapeHtml(params.imageUrl.trim())}" alt="" width="200" style="max-width:100%;border-radius:8px"/></p>`
      : "";

  const cred = params.credentialId?.trim()
    ? `<p style="font-family:monospace;font-size:13px">Credential ID: ${escapeHtml(params.credentialId.trim())}</p>`
    : "";

  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.6;color:#111">
      <h2 style="font-weight:600">${escapeHtml(title)}</h2>
      <p><strong>${escapeHtml(params.badgeName)}</strong></p>
      ${img}
      <p>Chứng nhận Open Campus (OCB) của bạn đã được ghi nhận.</p>
      ${cred}
      <p><a href="${escapeHtml(params.profileUrl)}">Xem trên hồ sơ Corelia</a></p>
    </div>
  `;

  return { subject, html };
}

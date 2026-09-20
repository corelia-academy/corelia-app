import { mkdirSync, writeFileSync } from "node:fs";
import { authNames, buildAuthTemplate, renderAuthFixture } from "./auth.mjs";
import { renderEmailDocument } from "../../supabase/functions/corelia-api/lib/mail/document.ts";
import { wrapBlastEmail } from "../../supabase/functions/corelia-api/lib/mail/layout.ts";
import { buildCertificateIssuedEmail } from "../../supabase/functions/corelia-api/certificates/certificate_emails.ts";
import { buildCredentialMintEmail } from "../../supabase/functions/corelia-api/credentials/emails.ts";
import { buildHackathonRegistrationReviewEmail } from "../../supabase/functions/corelia-api/hackathons/emails.ts";
import { buildCoInstructorInviteEmail } from "../../supabase/functions/corelia-api/lib/mail/co_instructor_invite_body.ts";
import { buildHackathonWinnerAwardEmail } from "../../supabase/functions/corelia-api/lib/mail/hackathon_winner_award_body.ts";
import { buildLearningReminderEmail } from "../../supabase/functions/corelia-api/lib/mail/learning_reminder_body.ts";
import { buildProjectCollaborationInviteEmail } from "../../supabase/functions/corelia-api/lib/mail/project_collaboration_invite_body.ts";

const rootUrl = new URL("../../", import.meta.url);
const outputDir = new URL("../../public/email-preview/", import.meta.url);
mkdirSync(outputDir, { recursive: true });
const appUrl = "http://127.0.0.1:4174";
process.env.APP_URL = appUrl;
const fixture = { locale: "vi", token: "123456", appUrl, confirmationUrl: `${appUrl}/reset-password?token=sample`, redirectTo: `${appUrl}/dashboard` };

const entries = [];
function add(slug, group, title, result) {
  const html = typeof result === "string" ? result : result.html;
  const file = `${slug}.html`;
  writeFileSync(new URL(file, outputDir), html.replaceAll("https://app.corelia.dev/email-assets/", `${appUrl}/email-assets/`).replaceAll("https://app.corelia.academy/email-assets/", `${appUrl}/email-assets/`));
  entries.push({ file, group, title });
}

for (const name of authNames) {
  for (const locale of ["vi", "en"]) {
    add(`auth-${name}-${locale}`, "Supabase Auth", `${name} · ${locale.toUpperCase()}`,
      renderAuthFixture(buildAuthTemplate(name), { ...fixture, locale }));
  }
}

for (const locale of ["vi", "en"]) {
  add(`email-center-${locale}`, "Email Center", `Campaign · ${locale.toUpperCase()}`, renderEmailDocument({
    subject: locale === "vi" ? "Cùng xây dựng sản phẩm thực tế" : "Build real-world products with Corelia",
    preheader: "Corelia Academy", bodyText: `${"Một nội dung dài để kiểm tra xuống dòng và khả năng đọc trên thiết bị nhỏ. ".repeat(4)}\n\nCorelia giúp bạn học qua dự án thực tế.`,
    ctaLabel: locale === "vi" ? "Bắt đầu học" : "Start learning", ctaUrl: `${appUrl}/learn`,
    imageUrl: `${appUrl}/Corelia_Banner_Square.png`, locale, purpose: "marketing", values: {}, unsubscribeUrl: `${appUrl}/unsubscribe`,
  }, { appUrl }, "preview"));
  add(`co-instructor-${locale}`, "Transactional", `Co-instructor · ${locale.toUpperCase()}`, buildCoInstructorInviteEmail({
    courseTitle: "AI Product Engineering", inviterName: "Corelia Mentor", permissions: ["content", "students"],
    inviteUrl: `${appUrl}/invite`, expiresAt: new Date("2026-10-01T08:00:00Z"), locale,
  }));
  add(`project-invite-${locale}`, "Transactional", `Project invitation · ${locale.toUpperCase()}`, buildProjectCollaborationInviteEmail({
    projectTitle: "Corelia Builder Platform", inviterName: "Nguyễn Minh An", inviteUrl: `${appUrl}/projects/invite`,
    expiresAt: new Date("2026-10-01T08:00:00Z"), locale, fingerprint: "preview",
  }));
  add(`hackathon-review-${locale}`, "Transactional", `Hackathon review · ${locale.toUpperCase()}`, buildHackathonRegistrationReviewEmail({
    hackathonTitle: "UniHackFest 2026", isApproved: true, reviewNote: "Hồ sơ đã đầy đủ.", hackathonHref: `${appUrl}/hackathons/example`, locale,
  }));
  add(`hackathon-award-${locale}`, "Transactional", `Hackathon award · ${locale.toUpperCase()}`, buildHackathonWinnerAwardEmail({
    hackathonTitle: "UniHackFest 2026", projectTitle: "AI Learning Companion", awardLabel: "First Prize", hackathonHref: `${appUrl}/hackathons/example`, locale, fingerprint: "preview",
  }));
  add(`certificate-${locale}`, "Credentials", `Certificate · ${locale.toUpperCase()}`, buildCertificateIssuedEmail({
    courseTitle: "AI Product Engineering", certImageUrl: `${appUrl}/Corelia_Banner_Square.png`, profileUrl: `${appUrl}/profile`, locale,
  }));
  add(`credential-${locale}`, "Credentials", `Credential · ${locale.toUpperCase()}`, buildCredentialMintEmail({
    kind: "course_oca", badgeName: "Corelia Product Builder", profileUrl: `${appUrl}/profile`, credentialId: "CORELIA-2026-DEMO", imageUrl: `${appUrl}/Corelia_Banner_Square.png`, locale,
  }));
  add(`learning-${locale}`, "Learning", `Learning reminder · ${locale.toUpperCase()}`, buildLearningReminderEmail({
    courses: [{ slug: "ai-product", title: "AI Product Engineering" }, { slug: "blockchain", title: "Blockchain Foundations" }],
    displayName: "Nguyễn Minh An", locale, stage: 7, appUrl,
  }));
  for (const kind of ["course", "career_track", "hackathon"]) {
    add(`blast-${kind}-${locale}`, "Announcements", `${kind.replace("_", " ")} · ${locale.toUpperCase()}`, wrapBlastEmail({
      kind, locale, bodyHtml: `<p>${locale === "vi" ? "Thông báo mới từ Corelia Academy." : "A new update from Corelia Academy."}</p>`, unsubUrl: `${appUrl}/settings`,
    }));
  }
}

const cards = entries.map(({ file, group, title }) => `<article><header><span>${group}</span><strong>${title}</strong><a href="${file}" target="_blank">Open</a></header><iframe title="${title}" src="${file}"></iframe></article>`).join("");
writeFileSync(new URL("index.html", outputDir), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Corelia email gallery</title><style>*{box-sizing:border-box}body{margin:0;background:#05050b;color:#eae6e3;font:14px Arial,sans-serif}nav{position:sticky;top:0;z-index:2;padding:16px 24px;background:#0a0913;border-bottom:1px solid #2b2b3b}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,390px),1fr));gap:20px;padding:20px}article{min-width:0;border:1px solid #2b2b3b;background:#12121e}header{display:grid;grid-template-columns:1fr auto;gap:5px 12px;padding:12px;border-bottom:1px solid #2b2b3b}header span{color:#9bbcff;font-size:11px;text-transform:uppercase}header strong{grid-column:1}header a{grid-column:2;grid-row:1/3;align-self:center;color:#9bbcff}iframe{display:block;width:100%;height:720px;border:0;background:#0a0913}@media(max-width:430px){main{padding:8px;gap:12px}nav{padding:12px}}</style></head><body><nav><strong>Corelia email gallery</strong> · ${entries.length} variants · resize browser to test responsive layout</nav><main>${cards}</main></body></html>`);
writeFileSync(new URL("responsive.html", outputDir), `<!doctype html><html><head><meta charset="utf-8"><title>Corelia responsive email QA</title><style>body{margin:0;padding:24px;background:#05050b;color:#eae6e3;font:14px Arial,sans-serif}main{display:flex;align-items:flex-start;gap:24px;overflow:auto}.frame{flex:none}.frame p{margin:0 0 8px}.desktop{width:800px}.mobile{width:375px}iframe{display:block;width:100%;height:812px;border:1px solid #2b2b3b}</style></head><body><main><div class="frame desktop"><p>Desktop · 800px</p><iframe src="email-center-vi.html"></iframe></div><div class="frame mobile"><p>Mobile · 375px</p><iframe src="email-center-vi.html"></iframe></div></main></body></html>`);
console.log(`Generated ${entries.length} previews at ${new URL("index.html", outputDir).pathname}`);

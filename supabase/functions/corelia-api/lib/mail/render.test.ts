import { describe, expect, it } from "vitest";
import { renderTransactionalEmail } from "./render.ts";

describe("email renderer fallbacks", () => {
  const render = () => renderTransactionalEmail({
    locale: "vi", heroTag: "Thông báo", heroTitle: "Một tiêu đề rất dài ".repeat(8),
    bodyHtml: `<p>Nội dung <strong>quan trọng</strong>.</p><p><a href="https://example.com/${"long/".repeat(30)}">Liên kết dài</a></p>`,
    ctaHtml: `<a class="e-btn" href="https://example.com">Tiếp tục</a>`,
    footerReason: "Bạn nhận được email này từ Corelia.", fingerprint: "test",
  }, { appUrl: "https://app.corelia.academy" });

  it("keeps essential colors, typography and wrapping inline", () => {
    const html = render();
    expect(html).toContain('role="presentation"');
    expect(html).toContain('bgcolor="#0a0913"');
    expect(html).toContain("max-width:600px");
    expect(html).toContain("font-size:30px");
    expect(html).toContain("font-size:24px !important");
    expect(html).toContain("background-image:linear-gradient(#0a0913,#0a0913)");
    expect(html).toContain('class="body"');
    expect(html).toContain("u + .body .gmail-blend-screen");
    expect(html).toContain('<div class="gmail-blend-screen"><div class="gmail-blend-difference">');
    expect(html).toContain("font-size:15px !important");
    expect(html).toContain("overflow-wrap:anywhere");
    expect(html).toContain("background-color:#1759f1");
  });

  it("remains readable when head styles and decorative images are unavailable", () => {
    const fallback = render()
      .replace(/<style>[\s\S]*?<\/style>/, "")
      .replace(/\sbackground="[^"]*"/, "")
      .replace(/background-image:[^;]+;/, "")
      .replace(/<img[^>]*>/g, "");
    expect(fallback).toContain("background-color:#0a0913");
    expect(fallback).toContain("color:#eae6e3");
    expect(fallback).toContain("Một tiêu đề rất dài");
    expect(fallback).toContain("Tiếp tục");
  });

  it("keeps footer rows compact and omits an empty reason", () => {
    const html = renderTransactionalEmail({
      locale: "en",
      heroTag: "Update",
      heroTitle: "Account update",
      bodyHtml: "<p>Details</p>",
      footerExtraHtml: '<p><a href="https://example.com/unsubscribe">Unsubscribe</a></p>',
    }, { appUrl: "https://staging.corelia.academy/" });

    expect(html).toContain("padding:16px 24px");
    expect(html).toContain("margin:0 0 4px;line-height:18px");
    expect(html).toContain(">staging.corelia.academy</a>");
    expect(html).not.toContain("This email was sent by Corelia");
    expect(html).not.toContain("<p></p>");
  });
});

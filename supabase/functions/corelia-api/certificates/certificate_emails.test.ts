import { describe, expect, it } from "vitest";
import { buildCertificateIssuedEmail } from "./certificate_emails.ts";
import { buildCredentialMintEmail } from "../credentials/emails.ts";

describe("certificate notification emails", () => {
  it("links directly to the personalized certificate", () => {
    const { html } = buildCertificateIssuedEmail({
      courseTitle: "UniHackfest 2026",
      certificateUrl: "https://staging.corelia.academy/verify/CRL-1234567890",
      locale: "vi",
    });

    expect(html).toContain("UniHackfest 2026");
    expect(html).toContain("https://staging.corelia.academy/verify/CRL-1234567890");
    expect(html).toContain("đã điền tên");
    expect(html.match(/<img /g)).toHaveLength(1); // Only the shared Corelia logo.
  });

  it("keeps Open Campus credential artwork in its email", () => {
    const { html } = buildCredentialMintEmail({
      kind: "course_oca",
      badgeName: "UniHackfest 2026",
      profileUrl: "https://staging.corelia.academy/achievements",
      imageUrl: "https://example.com/blank-certificate.png",
      locale: "vi",
    });

    expect(html).toContain("blank-certificate.png");
  });

  it("keeps genuine badge artwork in badge emails", () => {
    const { html } = buildCredentialMintEmail({
      kind: "course",
      badgeName: "Completed course",
      profileUrl: "https://staging.corelia.academy/achievements",
      imageUrl: "https://example.com/badge.png",
      locale: "en",
    });

    expect(html).toContain("badge.png");
  });
});

import { describe, expect, it } from "vitest";
import { buildOpenCampusPayload } from "./oc_payload";

describe("buildOpenCampusPayload", () => {
  it("uses issuer art at the VC level and credential art for the subject", async () => {
    const imageUrl = "https://cdn.example.com/credentials/typescript.png";
    const logoUrl = "https://cdn.example.com/brand/corelia.png";
    const { body } = await buildOpenCampusPayload({
      template: {
        id: "template-1",
        scope_type: "course",
        course_id: "course-1",
        hackathon_id: null,
        name: "TypeScript Certificate",
        description: "Completed TypeScript fundamentals",
        image_url: imageUrl,
        achievement_type: "CertificateOfCompletion",
        identifier_prefix: "corelia-ts",
        collection_symbol: null,
        custom_metadata: {},
      },
      userId: "dd58ad83-fb70-4c35-a6b6-d0cb88c00e07",
      username: "lee",
      profileUrl: "https://staging.corelia.academy/u/lee",
      logoUrl,
      holderOcId: "lee.edu",
      holderAddress: null,
      holderName: "Lee",
      holderEmail: "lee@example.com",
      awardedIso: "2026-07-29T00:00:00.000Z",
    });

    const payload = body.credentialPayload as Record<string, unknown>;
    const subject = payload.credentialSubject as Record<string, unknown>;

    expect(payload.image).toBe(logoUrl);
    expect(subject.image).toBe(imageUrl);
  });
});

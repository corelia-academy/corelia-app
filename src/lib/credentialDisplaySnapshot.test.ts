import { describe, expect, it } from "vitest";

import {
  normalizeCredentialDisplaySnapshot,
  templateSummaryFromSnapshot,
} from "./credentialDisplaySnapshot";

describe("credential display snapshots", () => {
  it("restores an orphaned OCA template summary", () => {
    const snapshot = normalizeCredentialDisplaySnapshot({
      template_id: "template-oca",
      credential_title: "Corelia TypeScript Certificate",
      credential_description: "Completed the course",
      image_url: "https://cdn.example/oca.png",
      scope_type: "course",
      achievement_type: "CertificateOfCompletion",
      course_title: "TypeScript Fundamentals",
      instructor_name: "Corelia Instructor",
      issued_at: "2026-07-01T00:00:00Z",
    });

    expect(templateSummaryFromSnapshot(snapshot, null)).toMatchObject({
      id: "template-oca",
      scope_type: "course",
      name: "Corelia TypeScript Certificate",
      image_url: "https://cdn.example/oca.png",
      achievement_type: "CertificateOfCompletion",
    });
  });

  it("restores an orphaned OCB and keeps its hackathon role", () => {
    const snapshot = normalizeCredentialDisplaySnapshot({
      credential_title: "Hackathon Winner",
      thumbnail_url: "https://cdn.example/ocb-thumb.png",
      scope_type: "hackathon",
      achievement_type: "Badge",
      hackathon_title: "Corelia Buildathon",
      hackathon_role: "winner",
      collection_symbol: "ocbadge",
    });

    expect(templateSummaryFromSnapshot(snapshot, "template-ocb")).toMatchObject({
      id: "template-ocb",
      scope_type: "hackathon",
      achievement_type: "Badge",
      hackathon_role: "winner",
      collection_symbol: "ocbadge",
    });
  });

  it("rejects malformed snapshots without throwing", () => {
    expect(normalizeCredentialDisplaySnapshot(null)).toBeNull();
    expect(normalizeCredentialDisplaySnapshot([])).toBeNull();

    const snapshot = normalizeCredentialDisplaySnapshot({
      scope_type: "unknown",
      achievement_type: "unknown",
    });
    expect(templateSummaryFromSnapshot(snapshot, null)).toBeNull();
  });
});

import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
import { certificateAnalyticsCsv, type CertificateAnalyticsRow } from "./certificateAnalytics";

describe("certificateAnalyticsCsv", () => {
  it("preserves Vietnamese text and prevents spreadsheet formulas in exported learner fields", () => {
    const row = {
      course_id: "course-1", course_title: "Khóa học, 2026", user_id: "user-1",
      learner_name: '=HYPERLINK("https://example.com")', learner_email: "learner@example.com",
      completed_at: null, certificate_id: null, code: null, issued_at: null,
      revoked_at: null, issuance_id: null, network: null, oc_status: null,
      oc_credential_id: null, minted_at: null, error_message: null,
      core_email: null, oc_email: null, core_notification: false, oc_notification: false,
    } satisfies CertificateAnalyticsRow;
    const csv = certificateAnalyticsCsv([row]);
    expect(csv).toContain('"Khóa học, 2026"');
    expect(csv).toContain('"\'=HYPERLINK(""https://example.com"")"');
    expect(csv).toContain('"false"');
  });
});

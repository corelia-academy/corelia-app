import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";

const { sendMail } = vi.hoisted(() => ({
  sendMail: vi.fn(async () => ({ sent: true, providerMessageId: "mail-1" })),
}));
vi.mock("../lib/mail/resend.ts", () => ({ sendTransactionalEmailViaResend: sendMail }));
vi.mock("../credentials/check_course.ts", () => ({ runCourseCredentialCheck: vi.fn() }));
vi.mock("../courses/completion.ts", () => ({ syncCourseCompletionIfReady: vi.fn() }));
vi.mock("../credentials/settings.ts", () => ({ getAppBaseUrl: async () => "https://staging.corelia.academy" }));

import { issueCourseCertificateIfReady } from "./handlers.ts";

describe("issueCourseCertificateIfReady", () => {
  it("sends one email and notification when two requests issue concurrently", async () => {
    sendMail.mockClear();
    let issuedAt: string | null = null;
    let notifications = 0;
    let initialReads = 0;
    let releaseInitialReads: (() => void) | undefined;
    const initialReadBarrier = new Promise<void>((resolve) => { releaseInitialReads = resolve; });

    const db = {
      auth: { admin: { getUserById: async () => ({ data: { user: { email: "learner@example.com" } } }) } },
      rpc: async () => ({ data: { all_lessons_complete: true, final_assignment_required: false }, error: null }),
      from(table: string) {
        const query = {
          column: "",
          updatedValue: null as string | null,
          conditional: false,
          select(column: string) { this.column = column; return this; },
          eq() { return this; },
          is() { this.conditional = true; return this; },
          update(value: { certificate_issued_at: string }) { this.updatedValue = value.certificate_issued_at; return this; },
          async maybeSingle() {
            if (table === "courses") return { data: { data: { title: "UniHackfest 2026", has_certificate: true } }, error: null };
            if (table === "profiles") return { data: { username: "learner", locale: "vi" }, error: null };
            if (table === "certificate_records") return { data: { code: "CRL-1234567890" }, error: null };
            if (this.column === "*") {
              const snapshot = issuedAt;
              initialReads++;
              if (initialReads === 2) releaseInitialReads?.();
              await initialReadBarrier;
              return { data: { certificate_issued_at: snapshot }, error: null };
            }
            return { data: { certificate_issued_at: issuedAt }, error: null };
          },
          async insert() { notifications++; return { error: null }; },
          async then(resolve: (value: unknown) => void) {
            if (table !== "enrollments" || !this.updatedValue) throw new Error("Unexpected query");
            const updated = !this.conditional || !issuedAt;
            if (updated) issuedAt = this.updatedValue;
            resolve({ data: updated ? [{ certificate_issued_at: issuedAt }] : [], error: null });
          },
        };
        return query;
      },
    } as unknown as SupabaseClient;

    const results = await Promise.all([
      issueCourseCertificateIfReady(db, { courseId: "course-1", targetUserId: "user-1" }),
      issueCourseCertificateIfReady(db, { courseId: "course-1", targetUserId: "user-1" }),
    ]);

    expect(results.map((result) => result.reason).sort()).toEqual(["already_issued", "issued"]);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: "certificate-issued-user-1-course-1",
      html: expect.stringContaining("https://staging.corelia.academy/verify/CRL-1234567890"),
    }));
    expect(notifications).toBe(1);
  });
});

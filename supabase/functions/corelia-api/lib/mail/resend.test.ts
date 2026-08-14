import { beforeEach, describe, expect, it, vi } from "vitest";

function makeDb() {
  const insert = vi.fn().mockResolvedValue({ error: null });
  return {
    db: { from: vi.fn(() => ({ insert })) },
    insert,
  };
}

describe("Resend mail transport", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("Deno", { env: { get: vi.fn() } });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("records a skipped attempt when email is not configured", async () => {
    const { db, insert } = makeDb();
    const { sendTransactionalEmailViaResend } = await import("./resend.ts");

    await expect(
      sendTransactionalEmailViaResend({
        db: db as never,
        mailType: "certificate_issued",
        to: ["learner@example.com"],
        subject: "Certificate",
        html: "<p>Ready</p>",
      }),
    ).resolves.toEqual({ sent: false, skipped: true, reason: "email_not_configured" });

    expect(fetch).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        mail_type: "certificate_issued",
        recipient_email: "learner@example.com",
        provider_status: "skipped",
      }),
    ]);
  });

  it("records the Resend message ID after provider acceptance", async () => {
    const { db, insert } = makeDb();
    vi.stubGlobal("Deno", {
      env: {
        get: vi.fn((name: string) => (name === "RESEND_API_KEY" ? "key" : "Corelia <noreply@example.com>")),
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "mail_123" }), { status: 202 })));
    const { sendTransactionalEmailViaResend } = await import("./resend.ts");

    await expect(
      sendTransactionalEmailViaResend({
        db: db as never,
        mailType: "certificate_issued",
        to: ["learner@example.com"],
        subject: "Certificate",
        html: "<p>Ready</p>",
      }),
    ).resolves.toEqual({ sent: true });

    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        provider_status: "accepted",
        provider_message_id: "mail_123",
        provider_http_status: 202,
      }),
    ]);
  });
});

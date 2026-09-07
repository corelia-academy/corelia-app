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
    ).resolves.toEqual({ sent: true, providerMessageId: "mail_123" });

    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        provider_status: "accepted",
        provider_message_id: "mail_123",
        provider_http_status: 202,
      }),
    ]);
  });

  it("uses snapshot from verbatim over environment config (V-03)", async () => {
    const { db } = makeDb();
    vi.stubGlobal("Deno", {
      env: {
        get: vi.fn((name: string) => (name === "RESEND_API_KEY" ? "key" : "EnvFrom <env@example.com>")),
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "mail_456" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendTransactionalEmailViaResend } = await import("./resend.ts");

    await sendTransactionalEmailViaResend({
      db: db as never,
      mailType: "certificate_issued",
      to: ["learner@example.com"],
      subject: "Certificate",
      html: "<p>Ready</p>",
      from: "FrozenFrom <frozen@example.com>",
    });

    expect(fetchMock).toHaveBeenCalled();
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.from).toBe("FrozenFrom <frozen@example.com>");
  });

  it("classifies 409 concurrent_idempotent_requests as retryable (V-02)", async () => {
    const { db } = makeDb();
    vi.stubGlobal("Deno", {
      env: {
        get: vi.fn((name: string) => (name === "RESEND_API_KEY" ? "key" : "EnvFrom <env@example.com>")),
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ name: "concurrent_idempotent_requests", message: "Concurrent in flight" }), {
          status: 409,
        }),
      ),
    );
    const { sendTransactionalEmailViaResend } = await import("./resend.ts");

    const res = await sendTransactionalEmailViaResend({
      db: db as never,
      mailType: "test_mail",
      to: ["test@example.com"],
      subject: "Test",
      html: "<p>Test</p>",
    });

    expect(res.sent).toBe(false);
    if (!res.sent && "providerError" in res) {
      expect(res.httpStatus).toBe(409);
      expect(res.errorName).toBe("concurrent_idempotent_requests");
      expect(res.isRetryable).toBe(true);
    }
  });

  it("classifies 409 invalid_idempotent_request as permanent (V-02)", async () => {
    const { db } = makeDb();
    vi.stubGlobal("Deno", {
      env: {
        get: vi.fn((name: string) => (name === "RESEND_API_KEY" ? "key" : "EnvFrom <env@example.com>")),
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ name: "invalid_idempotent_request", message: "Payload mismatch" }), {
          status: 409,
        }),
      ),
    );
    const { sendTransactionalEmailViaResend } = await import("./resend.ts");

    const res = await sendTransactionalEmailViaResend({
      db: db as never,
      mailType: "test_mail",
      to: ["test@example.com"],
      subject: "Test",
      html: "<p>Test</p>",
    });

    expect(res.sent).toBe(false);
    if (!res.sent && "providerError" in res) {
      expect(res.httpStatus).toBe(409);
      expect(res.errorName).toBe("invalid_idempotent_request");
      expect(res.isRetryable).toBe(false);
    }
  });

  it("classifies 401 Unauthorized and 403 Forbidden as config errors (V-01b)", async () => {
    const { db } = makeDb();
    vi.stubGlobal("Deno", {
      env: {
        get: vi.fn((name: string) => (name === "RESEND_API_KEY" ? "bad_key" : "EnvFrom <env@example.com>")),
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ name: "missing_api_key", message: "API key is invalid" }), {
          status: 401,
        }),
      ),
    );
    const { sendTransactionalEmailViaResend } = await import("./resend.ts");

    const res401 = await sendTransactionalEmailViaResend({
      db: db as never,
      mailType: "test_mail",
      to: ["test@example.com"],
      subject: "Test",
      html: "<p>Test</p>",
    });

    expect(res401.sent).toBe(false);
    if (!res401.sent && "providerError" in res401) {
      expect(res401.httpStatus).toBe(401);
      expect(res401.isConfigError).toBe(true);
      expect(res401.isRetryable).toBe(false);
    }

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ name: "validation_error", message: "Domain not verified" }), {
          status: 403,
        }),
      ),
    );

    const res403 = await sendTransactionalEmailViaResend({
      db: db as never,
      mailType: "test_mail",
      to: ["test@example.com"],
      subject: "Test",
      html: "<p>Test</p>",
    });

    expect(res403.sent).toBe(false);
    if (!res403.sent && "providerError" in res403) {
      expect(res403.httpStatus).toBe(403);
      expect(res403.isConfigError).toBe(true);
      expect(res403.isRetryable).toBe(false);
    }
  });

  it("classifies 422 as permanent payload error without config flag (V-01b)", async () => {
    const { db } = makeDb();
    vi.stubGlobal("Deno", {
      env: {
        get: vi.fn((name: string) => (name === "RESEND_API_KEY" ? "key" : "EnvFrom <env@example.com>")),
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ name: "invalid_parameter", message: "Invalid to field" }), {
          status: 422,
        }),
      ),
    );
    const { sendTransactionalEmailViaResend } = await import("./resend.ts");

    const res = await sendTransactionalEmailViaResend({
      db: db as never,
      mailType: "test_mail",
      to: ["invalid-email"],
      subject: "Test",
      html: "<p>Test</p>",
    });

    expect(res.sent).toBe(false);
    if (!res.sent && "providerError" in res) {
      expect(res.httpStatus).toBe(422);
      expect(res.isConfigError).toBe(false);
      expect(res.isRetryable).toBe(false);
    }
  });

  it("dynamically resolves RESEND_SEND_URL from environment at invocation time (V-03)", async () => {
    const { db } = makeDb();
    const customUrl = "http://127.0.0.1:9999/mock/emails";
    vi.stubGlobal("Deno", {
      env: {
        get: vi.fn((name: string) => {
          if (name === "RESEND_SEND_URL") return customUrl;
          if (name === "RESEND_API_KEY") return "test_key";
          return "Corelia <noreply@example.com>";
        }),
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "mock_dyn_1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendTransactionalEmailViaResend } = await import("./resend.ts");

    await sendTransactionalEmailViaResend({
      db: db as never,
      mailType: "test_dyn",
      to: ["recipient@example.com"],
      subject: "Test Dyn",
      html: "<p>Dyn</p>",
    });

    expect(fetchMock).toHaveBeenCalledWith(customUrl, expect.any(Object));
  });
});

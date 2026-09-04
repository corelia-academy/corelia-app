import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleProjectCollaborationInviteEmail } from "./collaboration_invite_email.ts";
import { sendTransactionalEmailViaResend } from "../lib/mail/resend.ts";

vi.mock("../lib/mail/resend.ts", () => ({
  sendTransactionalEmailViaResend: vi.fn(),
}));

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("handleProjectCollaborationInviteEmail replay and idempotency", () => {
  const token = "a".repeat(32);
  const inviteId = "11111111-1111-1111-1111-111111111111";
  const notifId = "22222222-2222-2222-2222-222222222222";
  const senderId = "user-sender-1";
  const recipientEmail = "invitee@example.com";

  beforeEach(() => {
    vi.stubGlobal("Deno", { env: { get: () => "https://app.corelia.academy" } });
    vi.clearAllMocks();
  });

  function createMockDb(options: {
    notificationId?: string | null;
    emailAlreadySent?: boolean;
    emailSending?: boolean;
    emailLockAt?: string;
    lastAttemptAt?: string;
    notificationPayload?: Record<string, unknown>;
  } = {}) {
    let currentNotifId = options.notificationId !== undefined ? options.notificationId : notifId;
    let notifUpdatePayload: Record<string, unknown> | null = null;
    let inviteNotificationId = currentNotifId;
    let insertedNotif: Record<string, unknown> | null = null;
    let insertCount = 0;
    let deleteCount = 0;

    let payload: Record<string, unknown> = options.notificationPayload ?? {
      email_sent: options.emailAlreadySent ?? false,
      email_sending: options.emailSending ?? false,
      ...(options.emailLockAt ? { email_lock_at: options.emailLockAt } : {}),
      ...(options.lastAttemptAt ? { email_last_attempt_at: options.lastAttemptAt } : {}),
    };

    const mockDb = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: senderId, email: "sender@example.com" } },
          error: null,
        }),
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { email: recipientEmail } },
            error: null,
          }),
        },
      },
      from: vi.fn((table: string) => {
        if (table === "project_collaboration_invites") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockImplementation(async () => ({
              data: {
                id: inviteId,
                project_id: "proj-1",
                invitee_user_id: "user-invitee-1",
                invited_by: senderId,
                status: "pending",
                expires_at: new Date(Date.now() + 86400000).toISOString(),
                token_hash: await sha256Hex(token),
                notification_id: inviteNotificationId,
              },
              error: null,
            })),
            update: vi.fn((patch: { notification_id?: string }) => {
              let isConditionalNullCheck = false;
              const updateBuilder = {
                eq: vi.fn().mockReturnThis(),
                is: vi.fn((col: string, val: unknown) => {
                  if (col === "notification_id" && val === null) {
                    isConditionalNullCheck = true;
                  }
                  return updateBuilder;
                }),
                select: vi.fn().mockImplementation(async () => {
                  // Atomic compare-and-set claim on invite:
                  if (isConditionalNullCheck && inviteNotificationId !== null) {
                    // Another worker already claimed this invite -> 0 rows updated
                    return { data: [], error: null };
                  }
                  if (patch.notification_id) {
                    inviteNotificationId = patch.notification_id;
                  }
                  return { data: [{ notification_id: inviteNotificationId }], error: null };
                }),
              };
              return updateBuilder;
            }),
          };
        }
        if (table === "user_notifications") {
          let targetNotifId: string | null = null;
          const notifBuilder = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((col: string, val: unknown) => {
              if (col === "id" && typeof val === "string") {
                targetNotifId = val;
              }
              return notifBuilder;
            }),
            contains: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockImplementation(async () => {
              const activeId = targetNotifId || currentNotifId;
              if (!activeId) return { data: null, error: null };
              return {
                data: {
                  id: activeId,
                  payload,
                },
                error: null,
              };
            }),
            insert: vi.fn((record: Record<string, unknown>) => {
              insertCount++;
              insertedNotif = record;
              currentNotifId = (record.id as string) || "auto-created-notif-1";
              payload = { ...(record.payload as Record<string, unknown>) };
              return {
                select: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: currentNotifId, payload },
                  error: null,
                }),
              };
            }),
            delete: vi.fn(() => ({
              eq: vi.fn((col: string, val: unknown) => {
                if (col === "id") {
                  deleteCount++;
                  if (val === currentNotifId) {
                    currentNotifId = null;
                  }
                }
                return Promise.resolve({ error: null });
              }),
            })),
            update: vi.fn((patch: { payload: Record<string, unknown> }) => {
              let isConditionalLock = false;
              const updateBuilder = {
                eq: vi.fn((col: string, val: unknown) => {
                  if (col === "id" && typeof val === "string") {
                    targetNotifId = val;
                  }
                  return updateBuilder;
                }),
                or: vi.fn((condition: string) => {
                  if (condition.includes("email_sending")) {
                    isConditionalLock = true;
                  }
                  return updateBuilder;
                }),
                select: vi.fn().mockImplementation(async () => {
                  // Atomic CAS: reject if email is actively sending and lock is not stale (>30s)
                  if (isConditionalLock && payload.email_sending === true) {
                    const lockAt = typeof payload.email_lock_at === "string" ? Date.parse(payload.email_lock_at) : 0;
                    const isStale = lockAt && (Date.now() - lockAt >= 30_000);
                    if (!isStale) {
                      return { data: [], error: null };
                    }
                  }
                  payload = { ...payload, ...patch.payload };
                  notifUpdatePayload = payload;
                  const activeId = targetNotifId || currentNotifId || "updated-notif-id";
                  return { data: [{ id: activeId }], error: null };
                }),
              };
              // Support chaining without .select()
              (updateBuilder as any).then = (resolve: any) => {
                payload = { ...payload, ...patch.payload };
                notifUpdatePayload = payload;
                return Promise.resolve({ error: null }).then(resolve);
              };
              return updateBuilder;
            }),
          };
          return notifBuilder;
        }
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { email: recipientEmail, full_name: "Invitee", locale: "vi" },
              error: null,
            }),
          };
        }
        if (table === "projects") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { title: "Test Project", slug: "test-project" },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
      getUpdatedNotifPayload: () => notifUpdatePayload,
      getInsertedNotif: () => insertedNotif,
      getInsertCount: () => insertCount,
      getDeleteCount: () => deleteCount,
      getActiveNotificationCount: () => insertCount - deleteCount,
      getInviteNotificationId: () => inviteNotificationId,
    };

    return mockDb;
  }

  function createRequest(): Request {
    return new Request("https://api.corelia.academy/op", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ invite_id: inviteId, token }),
    });
  }

  it("returns idempotent success without sending duplicate email when already sent", async () => {
    const db = createMockDb({ emailAlreadySent: true });
    const req = createRequest();

    const res = await handleProjectCollaborationInviteEmail(req, db as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, email_sent: false, idempotent_replay: true });
    expect(sendTransactionalEmailViaResend).not.toHaveBeenCalled();
  });

  it("rate-limits aggressive replay if retry attempted within cooldown", async () => {
    const db = createMockDb({
      emailAlreadySent: false,
      lastAttemptAt: new Date(Date.now() - 10000).toISOString(), // 10s ago (< 60s)
    });
    const req = createRequest();

    const res = await handleProjectCollaborationInviteEmail(req, db as any);
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.message).toBe("rate_limited:try_again_later");
    expect(sendTransactionalEmailViaResend).not.toHaveBeenCalled();
  });

  it("rate-limits request if an email is already actively in-flight", async () => {
    const db = createMockDb({
      emailAlreadySent: false,
      emailSending: true,
      emailLockAt: new Date(Date.now() - 5000).toISOString(), // 5s ago (< 30s)
    });
    const req = createRequest();

    const res = await handleProjectCollaborationInviteEmail(req, db as any);
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.message).toBe("rate_limited:try_again_later");
    expect(sendTransactionalEmailViaResend).not.toHaveBeenCalled();
  });

  it("guarantees atomic locking against two concurrent requests: exactly one sends and one is rate-limited", async () => {
    const db = createMockDb({ emailAlreadySent: false });
    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      // Simulate real-world network latency of external email provider
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { sent: true, providerMessageId: "resend-msg-concurrent-1" };
    });

    const req1 = createRequest();
    const req2 = createRequest();

    // Run both requests concurrently
    const [res1, res2] = await Promise.all([
      handleProjectCollaborationInviteEmail(req1, db as any),
      handleProjectCollaborationInviteEmail(req2, db as any),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 429]);
    // Verified: Resend called exactly ONCE across concurrent invocations
    expect(sendTransactionalEmailViaResend).toHaveBeenCalledTimes(1);
  });

  it("guarantees atomic orphan invite creation against two concurrent requests: creates one notification and sends once", async () => {
    const db = createMockDb({
      notificationId: null, // orphan invite without notification_id
      emailAlreadySent: false,
    });
    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        sent: true,
        providerMessageId: "resend-msg-orphan-concurrent",
      };
    });

    const req1 = createRequest();
    const req2 = createRequest();

    const [res1, res2] = await Promise.all([
      handleProjectCollaborationInviteEmail(req1, db as any),
      handleProjectCollaborationInviteEmail(req2, db as any),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 429]);

    // Verified: Exactly ONE active notification row in DB and Resend called once
    expect(db.getActiveNotificationCount()).toBe(1);
    expect(sendTransactionalEmailViaResend).toHaveBeenCalledTimes(1);
  });

  it("cleans up candidate notification row and adopts winning notification when losing the claim race", async () => {
    const db = createMockDb({
      notificationId: null,
      emailAlreadySent: false,
    });

    const validHash = await sha256Hex(token);
    const originalFrom = db.from;
    let claimAttempt = 0;
    const maybeSingleMock = vi.fn()
      .mockResolvedValueOnce({
        data: {
          id: inviteId,
          project_id: "proj-1",
          invitee_user_id: "user-invitee-1",
          invited_by: senderId,
          status: "pending",
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          token_hash: validHash,
          notification_id: null,
        },
        error: null,
      })
      .mockResolvedValue({
        data: {
          id: inviteId,
          notification_id: "winner-notif-id",
        },
        error: null,
      });

    db.from = vi.fn((table: string) => {
      if (table === "project_collaboration_invites") {
        const handler = originalFrom(table);
        return {
          ...handler,
          update: vi.fn(() => {
            claimAttempt++;
            return {
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              select: vi.fn().mockResolvedValue({
                // Simulate another concurrent worker won the claim race
                data: [],
                error: null,
              }),
            };
          }),
          maybeSingle: maybeSingleMock,
        };
      }
      return originalFrom(table);
    });

    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      sent: true,
      providerMessageId: "resend-msg-loser-race",
    });

    const req = createRequest();
    const res = await handleProjectCollaborationInviteEmail(req, db as any);

    // Loser worker deleted its redundant candidate notification
    expect(db.getDeleteCount()).toBe(1);
    expect(claimAttempt).toBe(1);
    expect(res.status).toBe(200);
  });

  it("reclaims stale lock (>30s) and sends email successfully", async () => {
    const db = createMockDb({
      emailAlreadySent: false,
      emailSending: true,
      emailLockAt: new Date(Date.now() - 35_000).toISOString(), // 35s ago (> 30s)
    });
    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      sent: true,
      providerMessageId: "resend-msg-reclaim-1",
    });

    const req = createRequest();
    const res = await handleProjectCollaborationInviteEmail(req, db as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, email_sent: true });
    expect(sendTransactionalEmailViaResend).toHaveBeenCalledTimes(1);
    const updatedPayload = db.getUpdatedNotifPayload();
    expect(updatedPayload?.email_sent).toBe(true);
    expect(updatedPayload?.email_sending).toBe(false);
  });

  it("records email_sent in notification payload upon provider success", async () => {
    const db = createMockDb({ emailAlreadySent: false });
    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      sent: true,
      providerMessageId: "resend-msg-1",
    });

    const req = createRequest();

    const res = await handleProjectCollaborationInviteEmail(req, db as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, email_sent: true });
    expect(sendTransactionalEmailViaResend).toHaveBeenCalledTimes(1);

    const updatedPayload = db.getUpdatedNotifPayload();
    expect(updatedPayload).toMatchObject({
      email_sent: true,
      email_sending: false,
      invite_id: inviteId,
    });
    expect(typeof updatedPayload?.email_sent_at).toBe("string");
  });
});

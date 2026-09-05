import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleProjectCollaborationInviteEmail } from "./collaboration_invite_email.ts";
import { sendTransactionalEmailViaResend } from "../lib/mail/resend.ts";

vi.mock("../lib/mail/resend.ts", () => ({
  sendTransactionalEmailViaResend: vi.fn(),
  isTransactionalEmailConfigured: vi.fn(() => true),
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
    outboxStatus?: "pending" | "sending" | "accepted" | "failed" | "indeterminate";
    firstDispatchedAt?: string | null;
    notificationPayload?: Record<string, unknown>;
    existingAttempts?: Array<{ mail_type: string; recipient_email?: string; provider_status: string }>;
    inviteCreatedAt?: string;
    outboxQueryError?: boolean;
    tokenHash?: string;
    preparedToken?: string;
  } = {}) {
    let currentNotifId = options.notificationId !== undefined ? options.notificationId : notifId;
    let notifUpdatePayload: Record<string, unknown> | null = null;
    let inviteNotificationId = currentNotifId;
    let currentInviteTokenHash: string = options.tokenHash ?? "default-hash";
    let insertedNotif: Record<string, unknown> | null = null;
    let insertCount = 0;
    let deleteCount = 0;

    let payload: Record<string, unknown> = options.notificationPayload ?? {
      email_sent: options.emailAlreadySent ?? false,
      email_sending: options.emailSending ?? false,
      ...(options.emailLockAt ? { email_lock_at: options.emailLockAt } : {}),
      ...(options.lastAttemptAt ? { email_last_attempt_at: options.lastAttemptAt } : {}),
    };

    const outboxEvents: any[] = [];
    if (options.preparedToken) {
      outboxEvents.push({
        id: "outbox-prepared-1",
        idempotency_key: inviteId,
        event_type: "project_collaboration_invite",
        recipient_email: "",
        status: "pending",
        request_payload: {
          token: options.preparedToken,
          prepared: true,
        },
        provider_message_id: null,
        lease_acquired_at: null,
        lease_token: null,
        last_attempt_at: null,
        first_dispatched_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } else if (options.outboxStatus) {
      outboxEvents.push({
        id: "outbox-status-" + options.outboxStatus,
        idempotency_key: inviteId,
        event_type: "project_collaboration_invite",
        recipient_email: recipientEmail,
        status: options.outboxStatus,
        request_payload: {
          from: "Corelia <noreply@corelia.academy>",
          to: [recipientEmail],
          subject: "Invite",
          html: "<p>Invite</p>",
          idempotency_key: inviteId,
        },
        provider_message_id: options.outboxStatus === "accepted" ? "resend-msg-1" : null,
        lease_acquired_at: options.emailLockAt || (options.outboxStatus === "sending" ? new Date().toISOString() : null),
        last_attempt_at: options.lastAttemptAt || new Date().toISOString(),
        first_dispatched_at: options.firstDispatchedAt !== undefined ? options.firstDispatchedAt : (options.outboxStatus !== "pending" ? (options.lastAttemptAt || new Date().toISOString()) : null),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } else if (options.emailAlreadySent || options.existingAttempts?.some((a) => a.provider_status === "accepted")) {
      outboxEvents.push({
        id: "outbox-sent",
        idempotency_key: inviteId,
        event_type: "project_collaboration_invite",
        recipient_email: recipientEmail,
        status: "accepted",
        request_payload: {
          from: "Corelia <noreply@corelia.academy>",
          to: [recipientEmail],
          subject: "Invite",
          html: "<p>Invite</p>",
          idempotency_key: inviteId,
        },
        provider_message_id: "resend-msg-1",
        lease_acquired_at: new Date().toISOString(),
        last_attempt_at: new Date().toISOString(),
        first_dispatched_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } else if (options.emailSending) {
      outboxEvents.push({
        id: "outbox-sending",
        idempotency_key: inviteId,
        event_type: "project_collaboration_invite",
        recipient_email: recipientEmail,
        status: "sending",
        request_payload: {
          from: "Corelia <noreply@corelia.academy>",
          to: [recipientEmail],
          subject: "Invite",
          html: "<p>Invite</p>",
          idempotency_key: inviteId,
        },
        provider_message_id: null,
        lease_acquired_at: options.emailLockAt || new Date().toISOString(),
        last_attempt_at: options.emailLockAt || new Date().toISOString(),
        first_dispatched_at: options.emailLockAt || new Date().toISOString(),
        created_at: options.emailLockAt || new Date().toISOString(),
        updated_at: options.emailLockAt || new Date().toISOString(),
      });
    } else if (options.lastAttemptAt) {
      outboxEvents.push({
        id: "outbox-recent-attempt",
        idempotency_key: inviteId,
        event_type: "project_collaboration_invite",
        recipient_email: recipientEmail,
        status: "indeterminate",
        request_payload: {
          from: "Corelia <noreply@corelia.academy>",
          to: [recipientEmail],
          subject: "Invite",
          html: "<p>Invite</p>",
          idempotency_key: inviteId,
        },
        provider_message_id: null,
        lease_acquired_at: null,
        last_attempt_at: options.lastAttemptAt,
        first_dispatched_at: options.lastAttemptAt,
        created_at: options.lastAttemptAt,
        updated_at: options.lastAttemptAt,
      });
    }

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
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((_col: string, _val: unknown) => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  email: recipientEmail,
                  full_name: "Test User",
                  locale: "vi",
                },
                error: null,
              }),
            })),
          };
        }
        if (table === "projects") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "proj-1",
                title: "Test Project",
                slug: "test-project",
              },
              error: null,
            }),
          };
        }
        if (table === "email_delivery_attempts") {
          let mailTypeFilter: string | null = null;
          let statusFilter: string | null = null;
          let recipientFilter: string | null = null;
          const attempts = options.existingAttempts ? [...options.existingAttempts] : [];
          const queryBuilder: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((field: string, val: string) => {
              if (field === "mail_type") mailTypeFilter = val;
              if (field === "provider_status") statusFilter = val;
              if (field === "recipient_email") recipientFilter = val;
              return queryBuilder;
            }),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn(async () => {
              const match = attempts.find(
                (a) => (!mailTypeFilter || a.mail_type === mailTypeFilter) &&
                       (!statusFilter || a.provider_status === statusFilter) &&
                       (!recipientFilter || a.recipient_email === recipientFilter)
              );
              return { data: match ? { id: "attempt-1", ...match } : null, error: null };
            }),
            insert: vi.fn(async (records: any) => {
              const recs = Array.isArray(records) ? records : [records];
              attempts.push(...recs);
              return { data: recs, error: null };
            }),
            then: async (resolve: any, reject: any) => {
              const matched = attempts.filter(
                (a) => (!mailTypeFilter || a.mail_type === mailTypeFilter) &&
                       (!statusFilter || a.provider_status === statusFilter) &&
                       (!recipientFilter || a.recipient_email === recipientFilter)
              );
              return Promise.resolve({ data: matched, error: null }).then(resolve, reject);
            },
          };
          return queryBuilder;
        }
        if (table === "email_outbox_events") {
          if (options.outboxQueryError) {
            const errBuilder: any = {
              select: vi.fn(() => errBuilder),
              eq: vi.fn(() => errBuilder),
              limit: vi.fn(() => errBuilder),
              then: (resolve: any) => resolve({ data: null, error: { message: "db connection failed" } }),
            };
            return errBuilder;
          }
          const queryEqs: Record<string, any> = {};
          let orPred: string | null = null;
          let limitCount: number | null = null;

          const outboxBuilder: any = {
            select: vi.fn(() => outboxBuilder),
            eq: vi.fn((col: string, val: any) => {
              queryEqs[col] = val;
              return outboxBuilder;
            }),
            or: vi.fn((pred: string) => {
              orPred = pred;
              return outboxBuilder;
            }),
            limit: vi.fn((n: number) => {
              limitCount = n;
              return outboxBuilder;
            }),
            insert: vi.fn((record: any) => {
              const rec = Array.isArray(record) ? record[0] : record;
              const duplicate = outboxEvents.some((e) => e.idempotency_key === rec.idempotency_key);
              const insertBuilder: any = {
                select: vi.fn(async () => {
                  if (duplicate) {
                    return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
                  }
                  const newRow = {
                    id: "outbox-" + (outboxEvents.length + 1),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    provider_message_id: null,
                    ...rec,
                  };
                  outboxEvents.push(newRow);
                  return { data: [newRow], error: null };
                }),
                then: (resolve: any, reject: any) => insertBuilder.select().then(resolve, reject),
              };
              return insertBuilder;
            }),
            update: vi.fn((patch: any) => {
              const updateEqs: Record<string, any> = {};
              let updateOrPred: string | null = null;
              const updateBuilder = {
                eq: vi.fn((col: string, val: any) => {
                  updateEqs[col] = val;
                  return updateBuilder;
                }),
                or: vi.fn((pred: string) => {
                  updateOrPred = pred;
                  return updateBuilder;
                }),
                select: vi.fn(async () => {
                  const target = outboxEvents.find((e) => {
                    for (const [k, v] of Object.entries(updateEqs)) {
                      if ((e as any)[k] !== v) return false;
                    }
                    return true;
                  });
                  if (!target) return { data: [], error: null };
                  if (updateOrPred) {
                    const now = Date.now();
                    const LEASE_MS = 30_000;
                    const leaseAt = target.lease_acquired_at ? Date.parse(target.lease_acquired_at) : 0;
                    const isStale = !leaseAt || (now - leaseAt >= LEASE_MS) || (leaseAt > now);
                    const canAcquire =
                      target.status === "pending" ||
                      target.status === "indeterminate" ||
                      (target.status === "sending" && isStale);
                    if (!canAcquire) {
                      return { data: [], error: null };
                    }
                  }
                  Object.assign(target, patch, { updated_at: new Date().toISOString() });
                  return { data: [target], error: null };
                }),
                then: async (resolve: any, reject: any) => {
                  const res = await updateBuilder.select();
                  return Promise.resolve(res).then(resolve, reject);
                },
              };
              return updateBuilder;
            }),
            then: async (resolve: any, reject: any) => {
              let matched = outboxEvents.filter((e) => {
                for (const [k, v] of Object.entries(queryEqs)) {
                  if ((e as any)[k] !== v) return false;
                }
                return true;
              });
              if (limitCount !== null) matched = matched.slice(0, limitCount);
              return Promise.resolve({ data: matched, error: null }).then(resolve, reject);
            },
          };
          return outboxBuilder;
        }
        if (table === "project_collaboration_invites") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockImplementation(async () => {
              if (currentInviteTokenHash === "default-hash") {
                currentInviteTokenHash = await sha256Hex(token);
              }
              return {
                data: {
                  id: inviteId,
                  project_id: "proj-1",
                  invitee_user_id: "user-invitee-1",
                  invited_by: senderId,
                  status: "pending",
                  expires_at: new Date(Date.now() + 86400000).toISOString(),
                  token_hash: currentInviteTokenHash,
                  notification_id: inviteNotificationId,
                  created_at: options.inviteCreatedAt ?? new Date().toISOString(),
                },
                error: null,
              };
            }),
            update: vi.fn((patch: { notification_id?: string; token_hash?: string }) => {
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
                  if (patch.token_hash) {
                    currentInviteTokenHash = patch.token_hash;
                  }
                  return { data: [{ id: inviteId, notification_id: inviteNotificationId, token_hash: currentInviteTokenHash }], error: null };
                }),
                then: async (resolve: any, reject: any) => {
                  const res = await updateBuilder.select();
                  return Promise.resolve(res).then(resolve, reject);
                },
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
      getCurrentTokenHash: () => currentInviteTokenHash,
      getOutboxEvents: () => outboxEvents,
    };

    return mockDb;
  }

  function createRequest(bodyOverride?: Record<string, unknown>): Request {
    return new Request("https://api.corelia.academy/op", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyOverride !== undefined ? bodyOverride : { invite_id: inviteId, token }),
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

  it("passes stable idempotencyKey to Resend and sets deterministic fingerprint in email html", async () => {
    const db = createMockDb({ emailAlreadySent: false });
    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      sent: true,
      providerMessageId: "resend-msg-idem-invite",
    });

    const req = createRequest();
    const res = await handleProjectCollaborationInviteEmail(req, db as any);
    expect(res.status).toBe(200);

    expect(sendTransactionalEmailViaResend).toHaveBeenCalledTimes(1);
    const mailCall = (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];

    // Assert stable per-event idempotency key passed to Resend:
    expect(mailCall.idempotencyKey).toBe(inviteId);
    expect(mailCall.mailType).toBe(`project_collaboration_invite:${inviteId}`);

    // Assert HTML body contains the deterministic fingerprint:
    expect(mailCall.html).toContain(inviteId);
  });

  it("skips resending when authoritative delivery is already recorded in email_delivery_attempts even if notification payload has email_sent=false", async () => {
    // Simulate recipient tampering or un-synced display state:
    const db = createMockDb({
      emailAlreadySent: false, // Untrusted/tampered notification payload
      existingAttempts: [
        {
          mail_type: `project_collaboration_invite:${inviteId}`,
          recipient_email: recipientEmail,
          provider_status: "accepted",
        },
      ],
    });

    const req = createRequest();
    const res = await handleProjectCollaborationInviteEmail(req, db as any);
    const body = await res.json();
    expect(body).toEqual({ ok: true, email_sent: false, idempotent_replay: true });
    expect(sendTransactionalEmailViaResend).not.toHaveBeenCalled();
  });

  it("allows retry with only invite_id (no token) when outbox record already exists", async () => {
    // Record already exists in outbox with sending or indeterminate status from previous run:
    const db = createMockDb({
      outboxStatus: "indeterminate",
      lastAttemptAt: new Date(Date.now() - 120_000).toISOString(), // 2 minutes ago (past 60s cooldown)
    });
    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      sent: true,
      providerMessageId: "resend-msg-tokenless-retry",
    });

    // Request from client containing ONLY invite_id (no token provided):
    const req = createRequest({ invite_id: inviteId });
    const res = await handleProjectCollaborationInviteEmail(req, db as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ ok: true, email_sent: true });
    expect(sendTransactionalEmailViaResend).toHaveBeenCalledTimes(1);
  });

  it("rejects with 400 invalid_input:token when provided token is shorter than 32 characters", async () => {
    const db = createMockDb({ emailAlreadySent: false });
    const req = createRequest({ invite_id: inviteId, token: "too_short" });
    const res = await handleProjectCollaborationInviteEmail(req, db as any);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toEqual({ message: "invalid_input:token" });
    expect(sendTransactionalEmailViaResend).not.toHaveBeenCalled();
  });

  it("returns 422 provider_error_permanent and marks failed when Resend returns permanent error (422)", async () => {
    const db = createMockDb({ emailAlreadySent: false });
    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      sent: false,
      providerError: true,
      httpStatus: 422,
      body: "Unprocessable Entity",
      isRetryable: false,
    });

    const req = createRequest();
    const res = await handleProjectCollaborationInviteEmail(req, db as any);
    expect(res.status).toBe(422);

    const body = await res.json();
    expect(body).toEqual({ message: "provider_error_permanent", status: 422 });
    const updatedPayload = db.getUpdatedNotifPayload();
    expect(updatedPayload?.email_sending).toBe(false);
    expect(updatedPayload?.email_delivery_failed).toBe(true);
  });

  it("returns 502 provider_error_retryable and marks indeterminate when Resend returns 500", async () => {
    const db = createMockDb({ emailAlreadySent: false });
    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      sent: false,
      providerError: true,
      httpStatus: 500,
      body: "Internal Server Error",
      isRetryable: true,
    });

    const req = createRequest();
    const res = await handleProjectCollaborationInviteEmail(req, db as any);
    expect(res.status).toBe(502);

    const body = await res.json();
    expect(body).toEqual({ message: "provider_error_retryable", status: 500 });
    const updatedPayload = db.getUpdatedNotifPayload();
    expect(updatedPayload?.email_sending).toBe(false);
  });

  it("returns 429 when client calls while in active cooldown (<60s)", async () => {
    const db = createMockDb({
      outboxStatus: "indeterminate",
      lastAttemptAt: new Date(Date.now() - 10_000).toISOString(), // 10s ago (< 60s cooldown)
    });

    const req = createRequest({ invite_id: inviteId });
    const res = await handleProjectCollaborationInviteEmail(req, db as any);
    expect(res.status).toBe(429);

    const body = await res.json();
    expect(body.message).toBe("rate_limited:try_again_later");
    expect(sendTransactionalEmailViaResend).not.toHaveBeenCalled();
  });

  it("returns 422 email_delivery_rejected when outbox record is failed permanent", async () => {
    const db = createMockDb({
      outboxStatus: "failed",
    });

    const req = createRequest({ invite_id: inviteId });
    const res = await handleProjectCollaborationInviteEmail(req, db as any);
    expect(res.status).toBe(422);

    const body = await res.json();
    expect(body).toEqual({ message: "email_delivery_rejected" });
    expect(sendTransactionalEmailViaResend).not.toHaveBeenCalled();
  });

  it("returns 409 indeterminate_delivery_requires_reconciliation when outbox record was dispatched >24h ago", async () => {
    const db = createMockDb({
      outboxStatus: "indeterminate",
      lastAttemptAt: new Date(Date.now() - (25 * 3600 * 1000)).toISOString(),
      firstDispatchedAt: new Date(Date.now() - (25 * 3600 * 1000)).toISOString(),
    });

    const req = createRequest({ invite_id: inviteId });
    const res = await handleProjectCollaborationInviteEmail(req, db as any);
    expect(res.status).toBe(409);

    const body = await res.json();
    expect(body).toEqual({ message: "indeterminate_delivery_requires_reconciliation" });
    expect(sendTransactionalEmailViaResend).not.toHaveBeenCalled();
  });

  it("dispatches successfully from prepared outbox record when client token is omitted (S3)", async () => {
    const preparedToken = "b".repeat(64);
    const tokenHash = await sha256Hex(preparedToken);
    const db = createMockDb({ preparedToken, tokenHash });
    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      sent: true,
      providerMessageId: "resend-msg-prepared-success",
    });

    // Request contains only invite_id, NO token:
    const req = createRequest({ invite_id: inviteId });
    const res = await handleProjectCollaborationInviteEmail(req, db as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ ok: true, email_sent: true });
    expect(sendTransactionalEmailViaResend).toHaveBeenCalledTimes(1);

    // Verify email link was constructed with the prepared token:
    const callArgs = (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.html).toContain(`/invites/project/${preparedToken}`);

    // Verify outbox record now contains completed snapshot:
    const outboxRow = db.getOutboxEvents()[0];
    expect(outboxRow.request_payload.html).toBeDefined();
    expect(outboxRow.request_payload.metadata.invite_token).toBe(preparedToken);
  });

  it("fails closed with 500 internal_error when outbox query encounters DB error (V-01a)", async () => {
    const db = createMockDb({ outboxQueryError: true });
    const req = createRequest({ invite_id: inviteId });
    const res = await handleProjectCollaborationInviteEmail(req, db as any);
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body).toEqual({ message: "internal_error" });
    expect(sendTransactionalEmailViaResend).not.toHaveBeenCalled();
  });

  it("rejects tokenless request for legacy invite under HOLD without prepared outbox (V-01a, V-02b)", async () => {
    const db = createMockDb(); // No outbox record prepared
    const req = createRequest({ invite_id: inviteId });
    const res = await handleProjectCollaborationInviteEmail(req, db as any);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toEqual({ message: "missing_fields:token" });
    expect(sendTransactionalEmailViaResend).not.toHaveBeenCalled();
    expect(db.getOutboxEvents().length).toBe(0);
  });

  it("project title containing invite URL pattern does not affect token or link (V-01a, S3)", async () => {
    const realToken = "e".repeat(64);
    const fakeTokenInTitle = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const tokenHash = await sha256Hex(realToken);

    const db = createMockDb({ preparedToken: realToken, tokenHash });
    // Override project title with a string containing an invite URL pattern before CTA
    const origFrom = db.from;
    db.from = vi.fn((table: string) => {
      if (table === "projects") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "proj-1",
              title: `Adversarial Project /invites/project/${fakeTokenInTitle}`,
              slug: "adversarial-project",
            },
            error: null,
          }),
        };
      }
      return origFrom(table);
    });

    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      sent: true,
      providerMessageId: "resend-msg-title-isolation",
    });

    const req = createRequest({ invite_id: inviteId });
    const res = await handleProjectCollaborationInviteEmail(req, db as any);
    expect(res.status).toBe(200);

    // Email link and snapshot metadata must strictly contain realToken, NOT fakeTokenInTitle:
    const callArgs = (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.html).toContain(`/invites/project/${realToken}`);

    const outboxRow = db.getOutboxEvents()[0];
    expect(outboxRow.request_payload.metadata.invite_token).toBe(realToken);
    expect(outboxRow.request_payload.metadata.invite_token).not.toBe(fakeTokenInTitle);
  });

  it("ensures atomic consistency and single dispatch under concurrent tokenless requests (S3)", async () => {
    const preparedToken = "f".repeat(64);
    const tokenHash = await sha256Hex(preparedToken);
    const db = createMockDb({ preparedToken, tokenHash });
    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      return {
        sent: true,
        providerMessageId: "resend-msg-concurrent-s3",
      };
    });

    // Launch two concurrent tokenless requests:
    const req1 = createRequest({ invite_id: inviteId });
    const req2 = createRequest({ invite_id: inviteId });

    const [res1, res2] = await Promise.all([
      handleProjectCollaborationInviteEmail(req1, db as any),
      handleProjectCollaborationInviteEmail(req2, db as any),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // Winner gets 200; loser gets 429 (lease locked by winner in claimOutboxLease):
    expect(statuses).toEqual([200, 429]);

    // Crucial invariant: Exactly one email was dispatched containing the prepared token
    expect(sendTransactionalEmailViaResend).toHaveBeenCalledTimes(1);
    const callArgs = (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.html).toContain(`/invites/project/${preparedToken}`);
  });

  it("returns 503 provider_config_error on 401/403 and does not mark outbox permanently failed (V-01b)", async () => {
    const db = createMockDb();
    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      sent: false,
      providerError: true,
      httpStatus: 401,
      body: "Unauthorized",
      isRetryable: false,
      isConfigError: true,
    });

    const req = createRequest({ invite_id: inviteId, token });
    const res = await handleProjectCollaborationInviteEmail(req, db as any);
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body).toEqual({ message: "provider_config_error", status: 401 });

    const updatedPayload = db.getUpdatedNotifPayload();
    expect(updatedPayload?.email_sending).toBe(false);
    // Crucial: email_delivery_failed must NOT be set to true on config errors
    expect(updatedPayload?.email_delivery_failed).toBeUndefined();
  });
});

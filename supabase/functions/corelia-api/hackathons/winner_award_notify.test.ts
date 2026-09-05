import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleHackathonWinnerAwardNotify } from "./winner_award_notify.ts";
import { generateDeterministicUuid } from "../lib/crypto.ts";
import { sendTransactionalEmailViaResend } from "../lib/mail/resend.ts";

vi.mock("../lib/mail/resend.ts", () => ({
  sendTransactionalEmailViaResend: vi.fn(),
  isTransactionalEmailConfigured: vi.fn(() => true),
}));

describe("handleHackathonWinnerAwardNotify retry resilience", () => {
  const adminId = "admin-1";
  const hackathonId = "hack-1";
  const projectId = "proj-1";
  const ownerId = "owner-1";
  const recipientEmail = "winner@example.com";

  beforeEach(() => {
    vi.stubGlobal("Deno", { env: { get: () => "https://app.corelia.academy" } });
    vi.clearAllMocks();
  });

  function createMockDb(options: {
    existingNotif?: { id: string; payload: Record<string, unknown> } | null;
    failFirstUpdate?: boolean;
    outboxStatus?: "pending" | "sending" | "accepted" | "failed" | "indeterminate";
    firstDispatchedAt?: string | null;
    existingAttempts?: Array<{ mail_type: string; recipient_email?: string; provider_status: string }>;
  }) {
    let insertedNotifs: Array<Record<string, unknown>> = [];
    let updatedNotifs: Array<{ id: string; payload: Record<string, unknown> }> = [];
    let updateAttemptCount = 0;
    let currentPayload: Record<string, unknown> | null = options.existingNotif
      ? { ...options.existingNotif.payload }
      : null;
    let currentNotifId = options.existingNotif?.id ?? "notif-new-1";

    const outboxEvents: any[] = [];
    if (options.existingNotif) {
      const isSent = options.existingNotif.payload.email_sent === true;
      const isSending = options.existingNotif.payload.email_sending === true;
      const lastAttempt = options.existingNotif.payload.email_last_attempt_at as string | undefined;
      const lockAt = options.existingNotif.payload.email_lock_at as string | undefined;

      if (isSent) {
        outboxEvents.push({
          id: "outbox-existing-sent",
          idempotency_key: options.existingNotif.id,
          event_type: "hackathon_winner_award",
          recipient_email: recipientEmail,
          status: "accepted",
          request_payload: {
            from: "Corelia <noreply@corelia.academy>",
            to: [recipientEmail],
            subject: "Winner Award",
            html: "<p>Winner</p>",
            idempotency_key: options.existingNotif.id,
          },
          provider_message_id: "resend-msg-1",
          lease_acquired_at: new Date().toISOString(),
          last_attempt_at: new Date().toISOString(),
          first_dispatched_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } else if (isSending) {
        outboxEvents.push({
          id: "outbox-existing-sending",
          idempotency_key: options.existingNotif.id,
          event_type: "hackathon_winner_award",
          recipient_email: recipientEmail,
          status: "sending",
          request_payload: {
            from: "Corelia <noreply@corelia.academy>",
            to: [recipientEmail],
            subject: "Winner Award",
            html: "<p>Winner</p>",
            idempotency_key: options.existingNotif.id,
          },
          provider_message_id: null,
          lease_acquired_at: lockAt || new Date().toISOString(),
          last_attempt_at: lockAt || new Date().toISOString(),
          first_dispatched_at: lockAt || new Date().toISOString(),
          created_at: lockAt || new Date().toISOString(),
          updated_at: lockAt || new Date().toISOString(),
        });
      } else if (lastAttempt) {
        outboxEvents.push({
          id: "outbox-existing-recent",
          idempotency_key: options.existingNotif.id,
          event_type: "hackathon_winner_award",
          recipient_email: recipientEmail,
          status: "indeterminate",
          request_payload: {
            from: "Corelia <noreply@corelia.academy>",
            to: [recipientEmail],
            subject: "Winner Award",
            html: "<p>Winner</p>",
            idempotency_key: options.existingNotif.id,
          },
          provider_message_id: null,
          lease_acquired_at: null,
          last_attempt_at: lastAttempt,
          first_dispatched_at: lastAttempt,
          created_at: lastAttempt,
          updated_at: lastAttempt,
        });
      }
    }

    const mockDb = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: adminId, email: "admin@example.com" } },
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
            eq: vi.fn((field: string, val: string) => {
              if (field === "id" && val === adminId) {
                return { maybeSingle: vi.fn().mockResolvedValue({ data: { role: "admin" }, error: null }) };
              }
              return { maybeSingle: vi.fn().mockResolvedValue({ data: { email: recipientEmail, locale: "vi" }, error: null }) };
            }),
          };
        }
        if (table === "hackathons") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: hackathonId,
                document: { title: "Summer Hackathon", slug: "summer-hackathon" },
              },
              error: null,
            }),
          };
        }
        if (table === "projects") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: projectId,
                title: "Winning Project",
                slug: "winning-project",
                owner_id: ownerId,
                source_id: hackathonId,
              },
              error: null,
            }),
          };
        }
        if (table === "project_collaborators") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
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
          let eqCol: string | null = null;
          let eqVal: any = null;
          const queryEqs: Record<string, any> = {};
          let orPred: string | null = null;
          let limitCount: number | null = null;

          const outboxBuilder: any = {
            select: vi.fn(() => outboxBuilder),
            eq: vi.fn((col: string, val: any) => {
              eqCol = col;
              eqVal = val;
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
              const updateEqs: Record<string, any> = { ...queryEqs };
              let updateOrPred = orPred;
              const updateBuilder: any = {
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
              if (options.existingAttempts?.some((a) => a.provider_status === "accepted")) {
                const syntheticAccepted = {
                  id: "outbox-synth-accepted",
                  idempotency_key: eqVal || "synth-key",
                  event_type: "hackathon_winner_award",
                  recipient_email: recipientEmail,
                  status: "accepted",
                  request_payload: {
                    from: "Corelia <noreply@corelia.academy>",
                    to: [recipientEmail],
                    subject: "Winner Award",
                    html: "<p>Winner</p>",
                    idempotency_key: eqVal || "synth-key",
                  },
                  provider_message_id: "resend-msg-synth",
                  lease_acquired_at: new Date().toISOString(),
                  last_attempt_at: new Date().toISOString(),
                  first_dispatched_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                return Promise.resolve({ data: [syntheticAccepted], error: null }).then(resolve);
              }

              if (options.existingNotif) {
                const p = options.existingNotif.payload;
                let existing = outboxEvents.find((e) => e.idempotency_key === eqVal);
                if (!existing) {
                  existing = {
                    id: "outbox-existing-" + (outboxEvents.length + 1),
                    idempotency_key: eqVal,
                    event_type: "hackathon_winner_award",
                    recipient_email: recipientEmail,
                    status: p.email_sent === true ? "accepted" : (p.email_sending === true ? "sending" : (p.email_last_attempt_at ? "indeterminate" : "pending")),
                    request_payload: {
                      from: "Corelia <noreply@corelia.academy>",
                      to: [recipientEmail],
                      subject: "Winner Award",
                      html: "<p>Winner</p>",
                      idempotency_key: eqVal,
                    },
                    provider_message_id: p.email_sent === true ? "resend-msg-1" : null,
                    lease_acquired_at: (p.email_lock_at as string) || (p.email_sending ? new Date().toISOString() : null),
                    last_attempt_at: (p.email_last_attempt_at as string) || (p.email_lock_at as string) || null,
                    first_dispatched_at: (p.email_last_attempt_at as string) || (p.email_lock_at as string) || null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  };
                  outboxEvents.push(existing);
                }
                return Promise.resolve({ data: [existing], error: null }).then(resolve);
              }

              let matched = outboxEvents.filter((e) => !eqCol || (e as any)[eqCol] === eqVal);
              if (limitCount !== null) matched = matched.slice(0, limitCount);
              return Promise.resolve({ data: matched, error: null }).then(resolve, reject);
            },
          };
          return outboxBuilder;
        }
        if (table === "user_notifications") {
          let targetId = currentNotifId;
          const notifQueryBuilder = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((field: string, val: string) => {
              if (field === "id") targetId = val;
              return notifQueryBuilder;
            }),
            contains: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            then: (resolve: any) => {
              const rows = insertedNotifs.map((n, i) => ({ id: (n.id as string) || `notif-new-${i + 1}`, ...n }));
              return Promise.resolve({ data: rows, error: null }).then(resolve);
            },
            maybeSingle: vi.fn().mockImplementation(async () => {
              const matched = insertedNotifs.find((n) => n.id === targetId);
              if (matched) {
                return {
                  data: { id: matched.id, payload: matched.payload },
                  error: null,
                };
              }
              if (!currentPayload) return { data: null, error: null };
              return {
                data: { id: currentNotifId, payload: currentPayload },
                error: null,
              };
            }),
            insert: vi.fn((record: Record<string, unknown>) => {
              const recId = (record.id as string) || currentNotifId;
              const alreadyExists = insertedNotifs.some((n) => n.id === recId);
              if (alreadyExists) {
                // Simulate PostgreSQL 23505 duplicate key violation on primary key:
                return {
                  select: vi.fn().mockReturnThis(),
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: {
                      code: "23505",
                      message: 'duplicate key value violates unique constraint "user_notifications_pkey"',
                    },
                  }),
                };
              }
              const recWithId = { id: recId, ...record };
              insertedNotifs.push(recWithId);
              currentNotifId = recId;
              currentPayload = { ...(record.payload as Record<string, unknown>) };
              return {
                select: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: recId },
                  error: null,
                }),
              };
            }),
            delete: vi.fn(() => ({
              eq: vi.fn((field: string, val: string) => {
                insertedNotifs = insertedNotifs.filter((n) => (n.id ?? currentNotifId) !== val);
                return Promise.resolve({ error: null });
              }),
            })),
            update: vi.fn((patch: { payload: Record<string, unknown> }) => {
              updateAttemptCount++;
              let isConditionalLock = false;

              const updateBuilder = {
                eq: vi.fn((field: string, val: string) => {
                  if (field === "id") targetId = val;
                  return updateBuilder;
                }),
                or: vi.fn((condition: string) => {
                  if (condition.includes("email_sending")) {
                    isConditionalLock = true;
                  }
                  return updateBuilder;
                }),
                select: vi.fn().mockImplementation(async () => {
                  if (options.failFirstUpdate && updateAttemptCount === 1) {
                    return { data: null, error: { message: "transient network error" } };
                  }
                  // Atomic CAS: if already sending, update affects 0 rows unless stale (>30s)
                  if (isConditionalLock && currentPayload?.email_sending === true) {
                    const lockAt = typeof currentPayload.email_lock_at === "string" ? Date.parse(currentPayload.email_lock_at) : 0;
                    const isStale = lockAt && (Date.now() - lockAt >= 30_000);
                    if (!isStale) {
                      return { data: [], error: null };
                    }
                  }
                  currentPayload = { ...(currentPayload ?? {}), ...patch.payload };
                  updatedNotifs.push({ id: targetId, payload: patch.payload });
                  return { data: [{ id: targetId }], error: null };
                }),
              };

              (updateBuilder as any).then = (resolve: any) => {
                if (options.failFirstUpdate && updateAttemptCount === 1) {
                  return Promise.resolve({ error: { message: "transient network error" } }).then(resolve);
                }
                currentPayload = { ...(currentPayload ?? {}), ...patch.payload };
                updatedNotifs.push({ id: targetId, payload: patch.payload });
                return Promise.resolve({ error: null }).then(resolve);
              };

              return updateBuilder;
            }),
          };
          return notifQueryBuilder;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
      getInsertedNotifs: () => insertedNotifs,
      getUpdatedNotifs: () => updatedNotifs,
      getUpdateAttemptCount: () => updateAttemptCount,
    };

    return mockDb;
  }

  it("inserts in-app notification and sends email on first run, updating email_sent to true", async () => {
    const db = createMockDb({ existingNotif: null });
    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      sent: true,
      providerMessageId: "resend-msg-1",
    });

    const req = new Request("https://api.corelia.academy/op", {
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({
        hackathon_id: hackathonId,
        awards: [{ project_id: projectId, label: "First Place" }],
      }),
    });

    const res = await handleHackathonWinnerAwardNotify(req, db as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, notified_count: 1, emails_sent_count: 1, failures_count: 0, failures: [] });
    expect(db.getInsertedNotifs().length).toBe(1);
    expect(sendTransactionalEmailViaResend).toHaveBeenCalledTimes(1);
    const callArgs = (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.html).toContain("https://app.corelia.academy/projects/winning-project");
    expect(callArgs.html).toContain("Xem chi tiết giải thưởng →");
    expect(callArgs.html).not.toContain("/overview");
    const lastUpdate = db.getUpdatedNotifs().at(-1);
    expect(lastUpdate?.payload.email_sent).toBe(true);
    expect(lastUpdate?.payload.email_sending).toBe(false);
  });

  it("retries email without duplicating notification if previous run had provider error", async () => {
    const db = createMockDb({
      existingNotif: {
        id: "existing-notif-id",
        payload: {
          hackathon_id: hackathonId,
          project_id: projectId,
          award_label: "First Place",
          email_sent: false,
        },
      },
    });

    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      sent: true,
      providerMessageId: "resend-msg-retry",
    });

    const req = new Request("https://api.corelia.academy/op", {
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({
        hackathon_id: hackathonId,
        awards: [{ project_id: projectId, label: "First Place" }],
      }),
    });

    const res = await handleHackathonWinnerAwardNotify(req, db as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(db.getInsertedNotifs().length).toBe(0);
    expect(sendTransactionalEmailViaResend).toHaveBeenCalledTimes(1);
    expect(body).toEqual({ ok: true, notified_count: 0, emails_sent_count: 1, failures_count: 0, failures: [] });
    const lastUpdate = db.getUpdatedNotifs().at(-1);
    expect(lastUpdate?.payload.email_sent).toBe(true);
    expect(lastUpdate?.payload.email_sending).toBe(false);
  });

  it("skips email and notification when award email has already been sent", async () => {
    const db = createMockDb({
      existingNotif: {
        id: "existing-notif-id",
        payload: {
          hackathon_id: hackathonId,
          project_id: projectId,
          award_label: "First Place",
          email_sent: true,
        },
      },
    });

    const req = new Request("https://api.corelia.academy/op", {
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({
        hackathon_id: hackathonId,
        awards: [{ project_id: projectId, label: "First Place" }],
      }),
    });

    const res = await handleHackathonWinnerAwardNotify(req, db as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(db.getInsertedNotifs().length).toBe(0);
    expect(sendTransactionalEmailViaResend).not.toHaveBeenCalled();
    expect(body).toEqual({ ok: true, notified_count: 0, emails_sent_count: 0, failures_count: 0, failures: [] });
  });

  it("skips sending email when award email is currently in-flight", async () => {
    const db = createMockDb({
      existingNotif: {
        id: "existing-notif-id",
        payload: {
          hackathon_id: hackathonId,
          project_id: projectId,
          award_label: "First Place",
          email_sent: false,
          email_sending: true,
          email_lock_at: new Date(Date.now() - 5000).toISOString(), // 5s ago (< 30s)
        },
      },
    });

    const req = new Request("https://api.corelia.academy/op", {
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({
        hackathon_id: hackathonId,
        awards: [{ project_id: projectId, label: "First Place" }],
      }),
    });

    const res = await handleHackathonWinnerAwardNotify(req, db as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(db.getInsertedNotifs().length).toBe(0);
    expect(sendTransactionalEmailViaResend).not.toHaveBeenCalled();
    expect(body).toEqual({
      ok: true,
      notified_count: 0,
      emails_sent_count: 0,
      failures_count: 1,
      failures: [
        {
          project_id: projectId,
          user_id: ownerId,
          recipient_email: recipientEmail,
          reason: "lease_locked",
          is_retryable: true,
        },
      ],
    });
  });

  it("retries updating notification payload if first attempt fails transiently", async () => {
    const db = createMockDb({
      existingNotif: {
        id: "existing-notif-id",
        payload: {
          hackathon_id: hackathonId,
          project_id: projectId,
          award_label: "First Place",
          email_sent: false,
        },
      },
      failFirstUpdate: true,
    });

    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      sent: true,
      providerMessageId: "resend-msg-transient",
    });

    const req = new Request("https://api.corelia.academy/op", {
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({
        hackathon_id: hackathonId,
        awards: [{ project_id: projectId, label: "First Place" }],
      }),
    });

    const res = await handleHackathonWinnerAwardNotify(req, db as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, notified_count: 0, emails_sent_count: 1, failures_count: 0, failures: [] });
    expect(sendTransactionalEmailViaResend).toHaveBeenCalledTimes(1);
    // Verified retry occurred and update eventually succeeded
    expect(db.getUpdateAttemptCount()).toBeGreaterThanOrEqual(2);
    const lastUpdate = db.getUpdatedNotifs().at(-1);
    expect(lastUpdate?.payload.email_sent).toBe(true);
  });

  it("falls back to /hackathons/:slug/projects when project has no slug", async () => {
    const db = createMockDb({ existingNotif: null });
    const originalFrom = db.from;
    // Overwrite project to have empty slug
    db.from = vi.fn((table: string) => {
      if (table === "projects") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: projectId,
              title: "Project Without Slug",
              slug: "",
              owner_id: ownerId,
              source_id: hackathonId,
            },
            error: null,
          }),
        };
      }
      return originalFrom(table);
    });

    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      sent: true,
      providerMessageId: "resend-msg-fallback",
    });

    const req = new Request("https://api.corelia.academy/op", {
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({
        hackathon_id: hackathonId,
        awards: [{ project_id: projectId, label: "Special Prize" }],
      }),
    });

    const res = await handleHackathonWinnerAwardNotify(req, db as any);
    expect(res.status).toBe(200);
    const callArgs = (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.html).toContain("https://app.corelia.academy/hackathons/summer-hackathon/projects");
    expect(callArgs.html).toContain("Xem cuộc thi →");
  });

  it("guarantees atomic locking against two concurrent winner award notify calls: sends email once", async () => {
    const db = createMockDb({
      existingNotif: {
        id: "existing-notif-id",
        payload: {
          hackathon_id: hackathonId,
          project_id: projectId,
          award_label: "First Place",
          email_sent: false,
        },
      },
    });

    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      // Simulate real-world network latency of external email provider
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { sent: true, providerMessageId: "resend-msg-concurrent-winner" };
    });

    const createReq = () => new Request("https://api.corelia.academy/op", {
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({
        hackathon_id: hackathonId,
        awards: [{ project_id: projectId, label: "First Place" }],
      }),
    });

    const [res1, res2] = await Promise.all([
      handleHackathonWinnerAwardNotify(createReq(), db as any),
      handleHackathonWinnerAwardNotify(createReq(), db as any),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    // Verified: Resend called exactly ONCE across concurrent invocations
    expect(sendTransactionalEmailViaResend).toHaveBeenCalledTimes(1);

    const body1 = await res1.json();
    const body2 = await res2.json();
    const totalEmailsSent = body1.emails_sent_count + body2.emails_sent_count;
    expect(totalEmailsSent).toBe(1);
  });

  it("reclaims stale lock (>30s) for winner award email and sends successfully", async () => {
    const db = createMockDb({
      existingNotif: {
        id: "stale-notif-id",
        payload: {
          hackathon_id: hackathonId,
          project_id: projectId,
          award_label: "First Place",
          email_sent: false,
          email_sending: true,
          email_lock_at: new Date(Date.now() - 35_000).toISOString(), // 35s ago (>30s)
        },
      },
    });

    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      sent: true,
      providerMessageId: "resend-msg-stale-winner",
    });

    const req = new Request("https://api.corelia.academy/op", {
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({
        hackathon_id: hackathonId,
        awards: [{ project_id: projectId, label: "First Place" }],
      }),
    });

    const res = await handleHackathonWinnerAwardNotify(req, db as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, notified_count: 0, emails_sent_count: 1, failures_count: 0, failures: [] });
    expect(sendTransactionalEmailViaResend).toHaveBeenCalledTimes(1);
    const lastUpdate = db.getUpdatedNotifs().at(-1);
    expect(lastUpdate?.payload.email_sent).toBe(true);
    expect(lastUpdate?.payload.email_sending).toBe(false);
  });

  it("guarantees atomic idempotency against two concurrent calls when NO notification exists initially (new notification first-insert race)", async () => {
    const db = createMockDb({ existingNotif: null });

    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      // Simulate real-world network latency of external email provider
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { sent: true, providerMessageId: "resend-msg-concurrent-first-insert" };
    });

    const createReq = () => new Request("https://api.corelia.academy/op", {
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({
        hackathon_id: hackathonId,
        awards: [{ project_id: projectId, label: "First Place" }],
      }),
    });

    const [res1, res2] = await Promise.all([
      handleHackathonWinnerAwardNotify(createReq(), db as any),
      handleHackathonWinnerAwardNotify(createReq(), db as any),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // Verified: Resend called exactly ONCE across concurrent invocations
    expect(sendTransactionalEmailViaResend).toHaveBeenCalledTimes(1);

    // Verified: Exactly ONE notification was created in DB
    expect(db.getInsertedNotifs().length).toBe(1);

    const body1 = await res1.json();
    const body2 = await res2.json();
    const totalEmailsSent = body1.emails_sent_count + body2.emails_sent_count;
    expect(totalEmailsSent).toBe(1);
    const totalNotified = body1.notified_count + body2.notified_count;
    expect(totalNotified).toBe(1);
  });

  it("passes stable idempotencyKey to Resend and sets deterministic fingerprint in email html", async () => {
    const db = createMockDb({ existingNotif: null });
    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      sent: true,
      providerMessageId: "resend-msg-idem-test",
    });

    const req = new Request("https://api.corelia.academy/op", {
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({
        hackathon_id: hackathonId,
        awards: [{ project_id: projectId, label: "First Place" }],
      }),
    });

    const res = await handleHackathonWinnerAwardNotify(req, db as any);
    expect(res.status).toBe(200);

    expect(sendTransactionalEmailViaResend).toHaveBeenCalledTimes(1);
    const mailCall = (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];

    // Assert stable per-event idempotency key passed to Resend:
    expect(mailCall.idempotencyKey).toBeDefined();
    expect(mailCall.idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(mailCall.mailType).toBe(`hackathon_winner_award:${mailCall.idempotencyKey}`);

    // Assert HTML body contains the deterministic fingerprint:
    expect(mailCall.html).toContain(mailCall.idempotencyKey);
  });

  it("skips resending when authoritative delivery is already recorded in email_delivery_attempts even if notification payload has email_sent=false", async () => {
    // Compute exact deterministic UUID for this award event:
    const notifId = await generateDeterministicUuid(
      `hackathon_winner_award:${hackathonId}:${projectId}:${ownerId}:first place`
    );
    const db = createMockDb({
      existingNotif: {
        id: notifId,
        payload: {
          hackathon_id: hackathonId,
          project_id: projectId,
          award_label: "First Place",
          email_sent: false, // Untrusted/tampered recipient payload
          email_sending: false,
        },
      },
      existingAttempts: [
        {
          mail_type: `hackathon_winner_award:${notifId}`,
          recipient_email: recipientEmail,
          provider_status: "accepted",
        },
      ],
    });

    const req = new Request("https://api.corelia.academy/op", {
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({
        hackathon_id: hackathonId,
        awards: [{ project_id: projectId, label: "First Place" }],
      }),
    });

    const res = await handleHackathonWinnerAwardNotify(req, db as any);
    expect(res.status).toBe(200);

    // Resend MUST NOT be called because service-role email_delivery_attempts proves delivery occurred
    expect(sendTransactionalEmailViaResend).not.toHaveBeenCalled();

    const body = await res.json();
    expect(body.emails_sent_count).toBe(0);
  });

  it("records failure with is_retryable=true when Resend returns 500", async () => {
    const db = createMockDb({ existingNotif: null });
    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      sent: false,
      providerError: true,
      httpStatus: 500,
      body: "Internal Server Error",
      isRetryable: true,
    });

    const req = new Request("https://api.corelia.academy/op", {
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({
        hackathon_id: hackathonId,
        awards: [{ project_id: projectId, label: "First Place" }],
      }),
    });

    const res = await handleHackathonWinnerAwardNotify(req, db as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.emails_sent_count).toBe(0);
    expect(body.failures_count).toBe(1);
    expect(body.failures[0]).toEqual({
      project_id: projectId,
      user_id: ownerId,
      recipient_email: recipientEmail,
      reason: "provider_error_retryable",
      is_retryable: true,
    });
  });

  it("records failure with is_retryable=false when Resend returns 422 permanent error", async () => {
    const db = createMockDb({ existingNotif: null });
    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      sent: false,
      providerError: true,
      httpStatus: 422,
      body: "Unprocessable Entity",
      isRetryable: false,
    });

    const req = new Request("https://api.corelia.academy/op", {
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({
        hackathon_id: hackathonId,
        awards: [{ project_id: projectId, label: "First Place" }],
      }),
    });

    const res = await handleHackathonWinnerAwardNotify(req, db as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.emails_sent_count).toBe(0);
    expect(body.failures_count).toBe(1);
    expect(body.failures[0]).toEqual({
      project_id: projectId,
      user_id: ownerId,
      recipient_email: recipientEmail,
      reason: "provider_error_permanent",
      is_retryable: false,
    });
  });

  it("records failure with reason: email_not_configured and is_retryable=true when transactional email is not configured (V-01c)", async () => {
    const { isTransactionalEmailConfigured } = await import("../lib/mail/resend.ts");
    (isTransactionalEmailConfigured as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);

    const db = createMockDb({ existingNotif: null });
    const req = new Request("https://api.corelia.academy/op", {
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({
        hackathon_id: hackathonId,
        awards: [{ project_id: projectId, label: "First Place" }],
      }),
    });

    const res = await handleHackathonWinnerAwardNotify(req, db as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.emails_sent_count).toBe(0);
    expect(body.failures_count).toBe(1);
    expect(body.failures[0]).toEqual({
      project_id: projectId,
      user_id: ownerId,
      recipient_email: recipientEmail,
      reason: "email_not_configured",
      is_retryable: true,
    });
    expect(sendTransactionalEmailViaResend).not.toHaveBeenCalled();
  });

  it("records failure with reason: provider_config_error and is_retryable=true when Resend returns 401/403 (V-01b)", async () => {
    const db = createMockDb({ existingNotif: null });
    (sendTransactionalEmailViaResend as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      sent: false,
      providerError: true,
      httpStatus: 401,
      body: "Unauthorized",
      isRetryable: false,
      isConfigError: true,
    });

    const req = new Request("https://api.corelia.academy/op", {
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({
        hackathon_id: hackathonId,
        awards: [{ project_id: projectId, label: "First Place" }],
      }),
    });

    const res = await handleHackathonWinnerAwardNotify(req, db as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.emails_sent_count).toBe(0);
    expect(body.failures_count).toBe(1);
    expect(body.failures[0]).toEqual({
      project_id: projectId,
      user_id: ownerId,
      recipient_email: recipientEmail,
      reason: "provider_config_error",
      is_retryable: true,
    });
  });
});

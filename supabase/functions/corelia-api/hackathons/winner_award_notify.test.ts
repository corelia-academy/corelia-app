import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleHackathonWinnerAwardNotify } from "./winner_award_notify.ts";
import { sendTransactionalEmailViaResend } from "../lib/mail/resend.ts";

vi.mock("../lib/mail/resend.ts", () => ({
  sendTransactionalEmailViaResend: vi.fn(),
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
  }) {
    let insertedNotifs: Array<Record<string, unknown>> = [];
    let updatedNotifs: Array<{ id: string; payload: Record<string, unknown> }> = [];
    let updateAttemptCount = 0;
    let currentPayload: Record<string, unknown> | null = options.existingNotif
      ? { ...options.existingNotif.payload }
      : null;
    let currentNotifId = options.existingNotif?.id ?? "notif-new-1";

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
                  if (options.failFirstUpdate && updateAttemptCount === 2) {
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
                if (options.failFirstUpdate && updateAttemptCount === 2) {
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
    expect(body).toEqual({ ok: true, notified_count: 1, emails_sent_count: 1 });
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
    expect(body).toEqual({ ok: true, notified_count: 0, emails_sent_count: 1 });
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
    expect(body).toEqual({ ok: true, notified_count: 0, emails_sent_count: 0 });
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
    expect(body).toEqual({ ok: true, notified_count: 0, emails_sent_count: 0 });
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
    expect(body).toEqual({ ok: true, notified_count: 0, emails_sent_count: 1 });
    expect(sendTransactionalEmailViaResend).toHaveBeenCalledTimes(1);
    // Verified retry occurred and update eventually succeeded
    expect(db.getUpdateAttemptCount()).toBeGreaterThanOrEqual(3);
    const lastUpdate = db.getUpdatedNotifs().at(-1);
    expect(lastUpdate?.payload.email_sent).toBe(true);
  });

  it("falls back to /hackathons/:slug/projects when project has no slug", async () => {
    const db = createMockDb({ existingNotif: null });
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
      return (createMockDb({ existingNotif: null }) as any).from(table);
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
    expect(body).toEqual({ ok: true, notified_count: 0, emails_sent_count: 1 });
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
});

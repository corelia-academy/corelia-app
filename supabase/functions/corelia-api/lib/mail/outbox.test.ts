import { describe, expect, it, vi } from "vitest";
import {
  claimOutboxLease,
  commitOutboxSuccess,
  commitOutboxFailure,
  releaseOutboxUnconfigured,
  persistOutboxDispatch,
  reconcileOutboxEvent,
  handleAdminEmailOutboxReconcile,
  isAuthoritativeEmailDelivered,
  buildAntiToctouCasPredicate,
  PROVIDER_WINDOW_MS,
  DISPATCH_SAFETY_BUFFER_MS,
  type OutboxEventRow,
  type OutboxRequestPayload,
} from "./outbox.ts";

function createMockDb(initialEvents: OutboxEventRow[] = []) {
  const events: OutboxEventRow[] = [...initialEvents];
  const deliveryAttempts: any[] = [];

  const db = {
    from: vi.fn((table: string) => {
      if (table === "email_delivery_attempts") {
        const attEqs: Record<string, any> = {};
        let limitN: number | null = null;
        const attBuilder: any = {
          select: vi.fn(() => attBuilder),
          eq: vi.fn((col: string, val: any) => {
            attEqs[col] = val;
            return attBuilder;
          }),
          limit: vi.fn((n: number) => {
            limitN = n;
            return attBuilder;
          }),
          insert: vi.fn(async (rows: any) => {
            const arr = Array.isArray(rows) ? rows : [rows];
            deliveryAttempts.push(...arr);
            return { data: arr, error: null };
          }),
          then: async (resolve: any, reject: any) => {
            let matched = deliveryAttempts.filter((row) => {
              for (const [k, v] of Object.entries(attEqs)) {
                if (row[k] !== v) return false;
              }
              return true;
            });
            if (limitN !== null) matched = matched.slice(0, limitN);
            return Promise.resolve({ data: matched, error: null }).then(resolve, reject);
          },
        };
        return attBuilder;
      }

      if (table === "email_outbox_events") {
        const queryEqs: Record<string, any> = {};
        let orPred: string | null = null;
        let limitCount: number | null = null;

        const builder: any = {
          select: vi.fn(() => builder),
          eq: vi.fn((col: string, val: any) => {
            queryEqs[col] = val;
            return builder;
          }),
          or: vi.fn((pred: string) => {
            orPred = pred;
            return builder;
          }),
          limit: vi.fn((n: number) => {
            limitCount = n;
            return builder;
          }),
          insert: vi.fn((record: any) => {
            const rec = Array.isArray(record) ? record[0] : record;
            const duplicate = events.some((e) => e.idempotency_key === rec.idempotency_key);
            const insertBuilder: any = {
              select: vi.fn(async () => {
                if (duplicate) {
                  return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
                }
                const newRow: OutboxEventRow = {
                  id: "outbox-" + (events.length + 1),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  provider_message_id: null,
                  ...rec,
                };
                events.push(newRow);
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
                const target = events.find((e) => {
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
            let matched = events.filter((e) => {
              for (const [k, v] of Object.entries(queryEqs)) {
                if ((e as any)[k] !== v) return false;
              }
              return true;
            });
            if (limitCount !== null) matched = matched.slice(0, limitCount);
            return Promise.resolve({ data: matched, error: null }).then(resolve, reject);
          },
        };
        return builder;
      }
      return {};
    }),
  };

  return { db, events, deliveryAttempts };
}

describe("Transactional Outbox Core (V-01, V-02, V-03)", () => {
  const dummyPayload: OutboxRequestPayload = {
    from: "Corelia <noreply@corelia.academy>",
    to: ["user@example.com"],
    subject: "Test Subject",
    html: "<p>Original Frozen Snapshot</p>",
    idempotency_key: "idemp-key-1",
  };

  describe("claimOutboxLease", () => {
    it("claims initial lease and persists request snapshot before dispatch (V-03)", async () => {
      const { db, events } = createMockDb();
      const snapshotBuilder = vi.fn().mockReturnValue(dummyPayload);

      const result = await claimOutboxLease({
        db: db as any,
        idempotencyKey: "idemp-key-1",
        eventType: "collaboration_invite",
        recipientEmail: "user@example.com",
        buildSnapshot: snapshotBuilder,
      });

      expect(result.type).toBe("claimed");
      if (result.type === "claimed") {
        expect(result.isInitial).toBe(true);
        expect(result.event.status).toBe("sending");
        expect(result.event.request_payload).toEqual(dummyPayload);
        expect(result.event.first_dispatched_at).toBeNull();
      }
      expect(snapshotBuilder).toHaveBeenCalledTimes(1);
      expect(events.length).toBe(1);
    });

    it("prevents re-sending event that was already accepted, even outside 24 hours (V-02)", async () => {
      const pastDate = new Date(Date.now() - 48 * 3600 * 1000).toISOString(); // 48h ago
      const existing: OutboxEventRow = {
        id: "outbox-1",
        idempotency_key: "idemp-key-1",
        event_type: "collaboration_invite",
        recipient_email: "user@example.com",
        status: "accepted",
        request_payload: dummyPayload,
        provider_message_id: "resend-msg-123",
        lease_acquired_at: pastDate,
        last_attempt_at: pastDate,
        first_dispatched_at: pastDate,
        created_at: pastDate,
        updated_at: pastDate,
      };

      const { db } = createMockDb([existing]);
      const snapshotBuilder = vi.fn();

      const result = await claimOutboxLease({
        db: db as any,
        idempotencyKey: "idemp-key-1",
        eventType: "collaboration_invite",
        recipientEmail: "user@example.com",
        buildSnapshot: snapshotBuilder,
      });

      expect(result.type).toBe("already_accepted");
      expect(snapshotBuilder).not.toHaveBeenCalled();
    });

    it("locks lease if another worker is actively sending (<30s)", async () => {
      const recentDate = new Date(Date.now() - 10 * 1000).toISOString(); // 10s ago
      const existing: OutboxEventRow = {
        id: "outbox-1",
        idempotency_key: "idemp-key-1",
        event_type: "collaboration_invite",
        recipient_email: "user@example.com",
        status: "sending",
        request_payload: dummyPayload,
        provider_message_id: null,
        lease_acquired_at: recentDate,
        last_attempt_at: recentDate,
        first_dispatched_at: recentDate,
        created_at: recentDate,
        updated_at: recentDate,
      };

      const { db } = createMockDb([existing]);
      const result = await claimOutboxLease({
        db: db as any,
        idempotencyKey: "idemp-key-1",
        eventType: "collaboration_invite",
        recipientEmail: "user@example.com",
        buildSnapshot: vi.fn(),
      });

      expect(result.type).toBe("lease_locked");
    });

    it("enforces 60-second cooldown on retry attempts", async () => {
      const recentAttempt = new Date(Date.now() - 25 * 1000).toISOString(); // 25s ago
      const existing: OutboxEventRow = {
        id: "outbox-1",
        idempotency_key: "idemp-key-1",
        event_type: "collaboration_invite",
        recipient_email: "user@example.com",
        status: "indeterminate",
        request_payload: dummyPayload,
        provider_message_id: null,
        lease_acquired_at: null,
        last_attempt_at: recentAttempt,
        first_dispatched_at: recentAttempt,
        created_at: recentAttempt,
        updated_at: recentAttempt,
      };

      const { db } = createMockDb([existing]);
      const result = await claimOutboxLease({
        db: db as any,
        idempotencyKey: "idemp-key-1",
        eventType: "collaboration_invite",
        recipientEmail: "user@example.com",
        buildSnapshot: vi.fn(),
      });

      expect(result.type).toBe("rate_limited");
      if (result.type === "rate_limited") {
        expect(result.retryAfterSeconds).toBeGreaterThan(0);
      }
    });

    it("reclaims stale lease (>30s) and reuses original snapshot on retry (V-03)", async () => {
      const staleDate = new Date(Date.now() - 70 * 1000).toISOString(); // 70s ago
      const existing: OutboxEventRow = {
        id: "outbox-1",
        idempotency_key: "idemp-key-1",
        event_type: "collaboration_invite",
        recipient_email: "user@example.com",
        status: "sending",
        request_payload: dummyPayload,
        provider_message_id: null,
        lease_acquired_at: staleDate,
        last_attempt_at: staleDate,
        first_dispatched_at: staleDate,
        created_at: staleDate,
        updated_at: staleDate,
      };

      const { db } = createMockDb([existing]);
      const unusedSnapshotBuilder = vi.fn().mockReturnValue({
        ...dummyPayload,
        html: "<p>Tampered / Modified Content</p>",
      });

      const result = await claimOutboxLease({
        db: db as any,
        idempotencyKey: "idemp-key-1",
        eventType: "collaboration_invite",
        recipientEmail: "user@example.com",
        buildSnapshot: unusedSnapshotBuilder,
      });

      expect(result.type).toBe("claimed");
      if (result.type === "claimed") {
        expect(result.isInitial).toBe(false);
        // CRITICAL V-03: Snapshot must remain original frozen content, NOT overwritten by builder
        expect(result.event.request_payload.html).toBe("<p>Original Frozen Snapshot</p>");
      }
      expect(unusedSnapshotBuilder).not.toHaveBeenCalled();
    });

    it("stops auto-resend outside 24h provider retention window and requires reconciliation (V-02)", async () => {
      const outsideWindow = new Date(Date.now() - 25 * 3600 * 1000).toISOString(); // 25h ago
      const existing: OutboxEventRow = {
        id: "outbox-1",
        idempotency_key: "idemp-key-1",
        event_type: "collaboration_invite",
        recipient_email: "user@example.com",
        status: "indeterminate",
        request_payload: dummyPayload,
        provider_message_id: null,
        lease_acquired_at: null,
        last_attempt_at: outsideWindow,
        first_dispatched_at: outsideWindow,
        created_at: outsideWindow,
        updated_at: outsideWindow,
      };

      const { db } = createMockDb([existing]);
      const result = await claimOutboxLease({
        db: db as any,
        idempotencyKey: "idemp-key-1",
        eventType: "collaboration_invite",
        recipientEmail: "user@example.com",
        buildSnapshot: vi.fn(),
      });

      expect(result.type).toBe("indeterminate_outside_window");
    });

    it("backfills accepted status and returns already_accepted when authoritative legacy attempt exists", async () => {
      const { db, events, deliveryAttempts } = createMockDb();
      deliveryAttempts.push({
        id: "att-1",
        mail_type: "collaboration_invite:legacy-key-1",
        recipient_email: "changed_email@example.com", // even if recipient email was different
        provider_status: "accepted",
      });
      const snapshotBuilder = vi.fn().mockReturnValue(dummyPayload);

      const result = await claimOutboxLease({
        db: db as any,
        idempotencyKey: "legacy-key-1",
        eventType: "collaboration_invite",
        recipientEmail: "legacy@example.com",
        buildSnapshot: snapshotBuilder,
      });

      expect(result.type).toBe("already_accepted");
      expect(events.length).toBe(1);
      expect(events[0].status).toBe("accepted");
      expect(events[0].idempotency_key).toBe("legacy-key-1");
    });

    it("does NOT backfill when authoritative legacy attempt does not exist (ignores client notification state) (V-01)", async () => {
      const { db, events } = createMockDb();
      const snapshotBuilder = vi.fn().mockReturnValue(dummyPayload);

      // No accepted entry in email_delivery_attempts
      const result = await claimOutboxLease({
        db: db as any,
        idempotencyKey: "fresh-key-1",
        eventType: "collaboration_invite",
        recipientEmail: "fresh@example.com",
        buildSnapshot: snapshotBuilder,
      });

      expect(result.type).toBe("claimed");
      expect(events.length).toBe(1);
      expect(events[0].status).toBe("sending");
    });

    it("returns db_error and does not dispatch when legacy delivery check errors (fail-closed) (V-02b)", async () => {
      const db = {
        from: vi.fn((table: string) => {
          if (table === "email_outbox_events") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          }
          if (table === "email_delivery_attempts") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: null, error: { message: "connection timeout" } }),
            };
          }
          return {};
        }),
      };

      const result = await claimOutboxLease({
        db: db as any,
        idempotencyKey: "legacy-err-key",
        eventType: "collaboration_invite",
        recipientEmail: "user@example.com",
        buildSnapshot: vi.fn().mockReturnValue(dummyPayload),
      });

      expect(result.type).toBe("db_error");
    });

    it("returns db_error when legacy backfill insert fails (does not return mock accepted) (V-02b)", async () => {
      const db = {
        from: vi.fn((table: string) => {
          if (table === "email_outbox_events") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              insert: vi.fn(() => ({
                select: vi.fn().mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied" } }),
              })),
            };
          }
          if (table === "email_delivery_attempts") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [{ id: "att-1" }], error: null }),
            };
          }
          return {};
        }),
      };

      const result = await claimOutboxLease({
        db: db as any,
        idempotencyKey: "legacy-backfill-fail",
        eventType: "collaboration_invite",
        recipientEmail: "user@example.com",
        buildSnapshot: vi.fn().mockReturnValue(dummyPayload),
      });

      expect(result.type).toBe("db_error");
    });
  });

  describe("persistOutboxDispatch (V-02a)", () => {
    it("persists first_dispatched_at before network call when previously null", async () => {
      const initial: OutboxEventRow = {
        id: "outbox-1",
        idempotency_key: "idemp-key-1",
        event_type: "collaboration_invite",
        recipient_email: "user@example.com",
        status: "sending",
        request_payload: dummyPayload,
        provider_message_id: null,
        lease_acquired_at: new Date().toISOString(),
        lease_token: "lease-token-1",
        last_attempt_at: new Date().toISOString(),
        first_dispatched_at: null,
        reconciled_at: null,
        reconciled_by: null,
        reconcile_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { db, events } = createMockDb([initial]);
      const res = await persistOutboxDispatch({
        db: db as any,
        idempotencyKey: "idemp-key-1",
        leaseToken: "lease-token-1",
      });

      expect(res.ok).toBe(true);
      expect(events[0].first_dispatched_at).not.toBeNull();
      expect(events[0].first_dispatched_at).toBe(res.firstDispatchedAt);
    });

    it("preserves original first_dispatched_at on retry (immutable) (V-02a)", async () => {
      const originalTime = new Date(Date.now() - 5000).toISOString();
      const initial: OutboxEventRow = {
        id: "outbox-1",
        idempotency_key: "idemp-key-1",
        event_type: "collaboration_invite",
        recipient_email: "user@example.com",
        status: "sending",
        request_payload: dummyPayload,
        provider_message_id: null,
        lease_acquired_at: new Date().toISOString(),
        lease_token: "lease-token-2",
        last_attempt_at: originalTime,
        first_dispatched_at: originalTime,
        reconciled_at: null,
        reconciled_by: null,
        reconcile_reason: null,
        created_at: originalTime,
        updated_at: originalTime,
      };

      const { db, events } = createMockDb([initial]);
      const res = await persistOutboxDispatch({
        db: db as any,
        idempotencyKey: "idemp-key-1",
        leaseToken: "lease-token-2",
        existingFirstDispatchedAt: originalTime,
      });

      expect(res.ok).toBe(true);
      expect(events[0].first_dispatched_at).toBe(originalTime);
      expect(res.firstDispatchedAt).toBe(originalTime);
    });

    it("fails and does not permit dispatch if leaseToken does not match (fenced)", async () => {
      const initial: OutboxEventRow = {
        id: "outbox-1",
        idempotency_key: "idemp-key-1",
        event_type: "collaboration_invite",
        recipient_email: "user@example.com",
        status: "sending",
        request_payload: dummyPayload,
        provider_message_id: null,
        lease_acquired_at: new Date().toISOString(),
        lease_token: "valid-token",
        last_attempt_at: new Date().toISOString(),
        first_dispatched_at: null,
        reconciled_at: null,
        reconciled_by: null,
        reconcile_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { db, events } = createMockDb([initial]);
      const res = await persistOutboxDispatch({
        db: db as any,
        idempotencyKey: "idemp-key-1",
        leaseToken: "stale-token",
      });

      expect(res.ok).toBe(false);
      expect(res.error).toBe("lease_lost_or_fenced");
      expect(events[0].first_dispatched_at).toBeNull();
    });

    it("rejects dispatch with dispatch_window_expired if existingFirstDispatchedAt exceeds 24h retention window (V-02a [P2])", async () => {
      const now = new Date();
      const expiredTime = new Date(now.getTime() - (25 * 3600 * 1000)).toISOString();
      const initial: OutboxEventRow = {
        id: "outbox-1",
        idempotency_key: "idemp-key-1",
        event_type: "collaboration_invite",
        recipient_email: "user@example.com",
        status: "sending",
        request_payload: dummyPayload,
        provider_message_id: null,
        lease_acquired_at: now.toISOString(),
        lease_token: "lease-token-expired",
        last_attempt_at: expiredTime,
        first_dispatched_at: expiredTime,
        reconciled_at: null,
        reconciled_by: null,
        reconcile_reason: null,
        created_at: expiredTime,
        updated_at: expiredTime,
      };

      const { db } = createMockDb([initial]);
      const res = await persistOutboxDispatch({
        db: db as any,
        idempotencyKey: "idemp-key-1",
        leaseToken: "lease-token-expired",
        existingFirstDispatchedAt: expiredTime,
        now,
      });

      expect(res.ok).toBe(false);
      expect(res.error).toBe("dispatch_window_expired");
      expect(res.firstDispatchedAt).toBe(expiredTime);
    });

    it("rejects dispatch if existingFirstDispatchedAt is within the 60s safety buffer before 24h (V-02a [P2])", async () => {
      const now = new Date();
      const boundaryTime = new Date(now.getTime() - (PROVIDER_WINDOW_MS - 30_000)).toISOString();
      const initial: OutboxEventRow = {
        id: "outbox-1",
        idempotency_key: "idemp-key-1",
        event_type: "collaboration_invite",
        recipient_email: "user@example.com",
        status: "sending",
        request_payload: dummyPayload,
        provider_message_id: null,
        lease_acquired_at: now.toISOString(),
        lease_token: "lease-token-buffer",
        last_attempt_at: boundaryTime,
        first_dispatched_at: boundaryTime,
        reconciled_at: null,
        reconciled_by: null,
        reconcile_reason: null,
        created_at: boundaryTime,
        updated_at: boundaryTime,
      };

      const { db } = createMockDb([initial]);
      const res = await persistOutboxDispatch({
        db: db as any,
        idempotencyKey: "idemp-key-1",
        leaseToken: "lease-token-buffer",
        existingFirstDispatchedAt: boundaryTime,
        now,
      });

      expect(res.ok).toBe(false);
      expect(res.error).toBe("dispatch_window_expired");
    });

    it("permits dispatch when existingFirstDispatchedAt is well within the 24h retention window", async () => {
      const now = new Date();
      const validTime = new Date(now.getTime() - (2 * 3600 * 1000)).toISOString();
      const initial: OutboxEventRow = {
        id: "outbox-1",
        idempotency_key: "idemp-key-1",
        event_type: "collaboration_invite",
        recipient_email: "user@example.com",
        status: "sending",
        request_payload: dummyPayload,
        provider_message_id: null,
        lease_acquired_at: now.toISOString(),
        lease_token: "lease-token-valid",
        last_attempt_at: validTime,
        first_dispatched_at: validTime,
        reconciled_at: null,
        reconciled_by: null,
        reconcile_reason: null,
        created_at: validTime,
        updated_at: validTime,
      };

      const { db, events } = createMockDb([initial]);
      const res = await persistOutboxDispatch({
        db: db as any,
        idempotencyKey: "idemp-key-1",
        leaseToken: "lease-token-valid",
        existingFirstDispatchedAt: validTime,
        now,
      });

      expect(res.ok).toBe(true);
      expect(res.firstDispatchedAt).toBe(validTime);
      expect(events[0].first_dispatched_at).toBe(validTime);
    });
  });

  describe("commitOutboxSuccess & commitOutboxFailure", () => {
    it("commits accepted status and records provider message ID", async () => {
      const initial: OutboxEventRow = {
        id: "outbox-1",
        idempotency_key: "idemp-key-1",
        event_type: "collaboration_invite",
        recipient_email: "user@example.com",
        status: "sending",
        request_payload: dummyPayload,
        provider_message_id: null,
        lease_acquired_at: new Date().toISOString(),
        lease_token: "lease-token-1",
        last_attempt_at: new Date().toISOString(),
        first_dispatched_at: new Date().toISOString(),
        reconciled_at: null,
        reconciled_by: null,
        reconcile_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { db, events } = createMockDb([initial]);
      const ok = await commitOutboxSuccess({
        db: db as any,
        idempotencyKey: "idemp-key-1",
        leaseToken: "lease-token-1",
        providerMessageId: "msg_resend_999",
      });

      expect(ok).toBe(true);
      expect(events[0].status).toBe("accepted");
      expect(events[0].provider_message_id).toBe("msg_resend_999");
      expect(events[0].lease_token).toBeNull();
    });

    it("rejects commit when lease token does not match (fenced stale worker) (V-01)", async () => {
      const initial: OutboxEventRow = {
        id: "outbox-1",
        idempotency_key: "idemp-key-1",
        event_type: "collaboration_invite",
        recipient_email: "user@example.com",
        status: "sending",
        request_payload: dummyPayload,
        provider_message_id: null,
        lease_acquired_at: new Date().toISOString(),
        lease_token: "new-lease-token",
        last_attempt_at: new Date().toISOString(),
        first_dispatched_at: new Date().toISOString(),
        reconciled_at: null,
        reconciled_by: null,
        reconcile_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { db, events } = createMockDb([initial]);
      const ok = await commitOutboxSuccess({
        db: db as any,
        idempotencyKey: "idemp-key-1",
        leaseToken: "stale-lease-token",
        providerMessageId: "msg_stale",
      });

      expect(ok).toBe(false);
      expect(events[0].status).toBe("sending");
      expect(events[0].lease_token).toBe("new-lease-token");
    });

    it("commits indeterminate status on transient failure", async () => {
      const initial: OutboxEventRow = {
        id: "outbox-1",
        idempotency_key: "idemp-key-1",
        event_type: "collaboration_invite",
        recipient_email: "user@example.com",
        status: "sending",
        request_payload: dummyPayload,
        provider_message_id: null,
        lease_acquired_at: new Date().toISOString(),
        lease_token: "lease-token-1",
        last_attempt_at: new Date().toISOString(),
        first_dispatched_at: new Date().toISOString(),
        reconciled_at: null,
        reconciled_by: null,
        reconcile_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { db, events } = createMockDb([initial]);
      const ok = await commitOutboxFailure({
        db: db as any,
        idempotencyKey: "idemp-key-1",
        leaseToken: "lease-token-1",
        isPermanent: false,
      });

      expect(ok).toBe(true);
      expect(events[0].status).toBe("indeterminate");
      expect(events[0].lease_token).toBeNull();
    });

    it("prevents stale worker failure from downgrading an accepted event (V-01)", async () => {
      const initial: OutboxEventRow = {
        id: "outbox-1",
        idempotency_key: "idemp-key-1",
        event_type: "collaboration_invite",
        recipient_email: "user@example.com",
        status: "accepted",
        request_payload: dummyPayload,
        provider_message_id: "valid_msg_id",
        lease_acquired_at: null,
        lease_token: null,
        last_attempt_at: new Date().toISOString(),
        first_dispatched_at: new Date().toISOString(),
        reconciled_at: null,
        reconciled_by: null,
        reconcile_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { db, events } = createMockDb([initial]);
      const ok = await commitOutboxFailure({
        db: db as any,
        idempotencyKey: "idemp-key-1",
        leaseToken: "stale-token",
        isPermanent: false,
      });

      expect(ok).toBe(false);
      expect(events[0].status).toBe("accepted");
    });

    it("commits failed status on permanent failure (4xx)", async () => {
      const initial: OutboxEventRow = {
        id: "outbox-1",
        idempotency_key: "idemp-key-1",
        event_type: "collaboration_invite",
        recipient_email: "user@example.com",
        status: "sending",
        request_payload: dummyPayload,
        provider_message_id: null,
        lease_acquired_at: new Date().toISOString(),
        lease_token: "lease-token-1",
        last_attempt_at: new Date().toISOString(),
        first_dispatched_at: new Date().toISOString(),
        reconciled_at: null,
        reconciled_by: null,
        reconcile_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { db, events } = createMockDb([initial]);
      const ok = await commitOutboxFailure({
        db: db as any,
        idempotencyKey: "idemp-key-1",
        leaseToken: "lease-token-1",
        isPermanent: true,
      });

      expect(ok).toBe(true);
      expect(events[0].status).toBe("failed");
    });

    it("resets first_dispatched_at to null on config error if initial attempt without prior dispatch (V-01b)", async () => {
      const initial: OutboxEventRow = {
        id: "outbox-1",
        idempotency_key: "idemp-key-config-err",
        event_type: "collaboration_invite",
        recipient_email: "user@example.com",
        status: "sending",
        request_payload: dummyPayload,
        provider_message_id: null,
        lease_acquired_at: new Date().toISOString(),
        lease_token: "lease-token-1",
        last_attempt_at: new Date().toISOString(),
        first_dispatched_at: new Date().toISOString(),
        reconciled_at: null,
        reconciled_by: null,
        reconcile_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { db, events } = createMockDb([initial]);
      const ok = await commitOutboxFailure({
        db: db as any,
        idempotencyKey: "idemp-key-config-err",
        leaseToken: "lease-token-1",
        isPermanent: false,
        isConfigError: true,
        existingFirstDispatchedAt: null, // Initial dispatch attempt
      });

      expect(ok).toBe(true);
      expect(events[0].status).toBe("indeterminate");
      expect(events[0].first_dispatched_at).toBeNull();
    });

    it("preserves first_dispatched_at across retries on 401/403 config error and blocks resending after 24h (V-01b)", async () => {
      const t0 = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      const initial: OutboxEventRow = {
        id: "outbox-1",
        idempotency_key: "idemp-key-timeout-chain",
        event_type: "collaboration_invite",
        recipient_email: "user@example.com",
        status: "sending",
        request_payload: dummyPayload,
        provider_message_id: null,
        lease_acquired_at: new Date().toISOString(),
        lease_token: "retry-lease-token",
        last_attempt_at: new Date().toISOString(),
        first_dispatched_at: t0.toISOString(), // Established in attempt 1 (timeout)
        reconciled_at: null,
        reconciled_by: null,
        reconcile_reason: null,
        created_at: t0.toISOString(),
        updated_at: t0.toISOString(),
      };

      const { db, events } = createMockDb([initial]);

      // Attempt 2: retry encounters 401/403 config error
      const ok = await commitOutboxFailure({
        db: db as any,
        idempotencyKey: "idemp-key-timeout-chain",
        leaseToken: "retry-lease-token",
        isPermanent: false,
        isConfigError: true,
        existingFirstDispatchedAt: t0.toISOString(), // Prior dispatch attempt existed!
      });

      expect(ok).toBe(true);
      expect(events[0].status).toBe("indeterminate");
      // CRUCIAL: first_dispatched_at MUST NOT be wiped out
      expect(events[0].first_dispatched_at).toBe(t0.toISOString());

      // Attempt 3: 25 hours later, admin fixes config and retries
      const t25h = new Date(t0.getTime() + 25 * 3600 * 1000);
      const claimResult = await claimOutboxLease({
        db: db as any,
        idempotencyKey: "idemp-key-timeout-chain",
        eventType: "collaboration_invite",
        recipientEmail: "user@example.com",
        buildSnapshot: () => dummyPayload,
        now: t25h,
      });

      // Must be rejected as indeterminate_outside_window
      expect(claimResult.type).toBe("indeterminate_outside_window");

      // Also verify persistOutboxDispatch fails with dispatch_window_expired
      const persistResult = await persistOutboxDispatch({
        db: db as any,
        idempotencyKey: "idemp-key-timeout-chain",
        leaseToken: "some-lease-token",
        existingFirstDispatchedAt: events[0].first_dispatched_at,
        now: t25h,
      });

      expect(persistResult.ok).toBe(false);
      expect(persistResult.error).toBe("dispatch_window_expired");
    });
  });

  describe("releaseOutboxUnconfigured", () => {
    it("resets sending event to pending and keeps first_dispatched_at null (V-02)", async () => {
      const initial: OutboxEventRow = {
        id: "outbox-1",
        idempotency_key: "idemp-key-1",
        event_type: "collaboration_invite",
        recipient_email: "user@example.com",
        status: "sending",
        request_payload: dummyPayload,
        provider_message_id: null,
        lease_acquired_at: new Date().toISOString(),
        lease_token: "lease-token-1",
        last_attempt_at: new Date().toISOString(),
        first_dispatched_at: null,
        reconciled_at: null,
        reconciled_by: null,
        reconcile_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { db, events } = createMockDb([initial]);
      const ok = await releaseOutboxUnconfigured({
        db: db as any,
        idempotencyKey: "idemp-key-1",
        leaseToken: "lease-token-1",
      });

      expect(ok).toBe(true);
      expect(events[0].status).toBe("pending");
      expect(events[0].lease_token).toBeNull();
      expect(events[0].first_dispatched_at).toBeNull();
    });
  });

  describe("reconcileOutboxEvent", () => {
    it("reconciles event manually outside 24h window", async () => {
      const initial: OutboxEventRow = {
        id: "outbox-1",
        idempotency_key: "idemp-key-1",
        event_type: "collaboration_invite",
        recipient_email: "user@example.com",
        status: "indeterminate",
        request_payload: dummyPayload,
        provider_message_id: null,
        lease_acquired_at: null,
        lease_token: null,
        last_attempt_at: new Date().toISOString(),
        first_dispatched_at: new Date().toISOString(),
        reconciled_at: null,
        reconciled_by: null,
        reconcile_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { db, events } = createMockDb([initial]);
      const res = await reconcileOutboxEvent({
        db: db as any,
        idempotencyKey: "idemp-key-1",
        forceStatus: "accepted",
        operatorId: "admin-1",
        providerMessageId: "manual_verified_id",
        reason: "Support verified delivery in Resend dashboard",
      });

      expect(res.ok).toBe(true);
      expect(events[0].status).toBe("accepted");
      expect(events[0].provider_message_id).toBe("manual_verified_id");
      expect(events[0].reconciled_by).toBe("admin-1");
      expect(events[0].reconcile_reason).toBe("Support verified delivery in Resend dashboard");
    });

    it("rejects reconciliation when operatorId or reason is missing", async () => {
      const { db } = createMockDb();
      const res1 = await reconcileOutboxEvent({
        db: db as any,
        idempotencyKey: "idemp-key-1",
        forceStatus: "accepted",
        operatorId: "",
        reason: "Valid reason",
      });
      expect(res1.ok).toBe(false);
      expect(res1.error).toBe("missing_operator_id");

      const res2 = await reconcileOutboxEvent({
        db: db as any,
        idempotencyKey: "idemp-key-1",
        forceStatus: "accepted",
        operatorId: "admin-1",
        reason: "   ",
      });
      expect(res2.ok).toBe(false);
      expect(res2.error).toBe("missing_reconcile_reason");
    });

    it("reconciles stale sending event (>30s) whose worker crashed (V-02a)", async () => {
      const staleDate = new Date(Date.now() - 60 * 1000).toISOString();
      const initial: OutboxEventRow = {
        id: "outbox-1",
        idempotency_key: "idemp-key-1",
        event_type: "collaboration_invite",
        recipient_email: "user@example.com",
        status: "sending",
        request_payload: dummyPayload,
        provider_message_id: null,
        lease_acquired_at: staleDate,
        lease_token: "crashed-worker-token",
        last_attempt_at: staleDate,
        first_dispatched_at: staleDate,
        reconciled_at: null,
        reconciled_by: null,
        reconcile_reason: null,
        created_at: staleDate,
        updated_at: staleDate,
      };

      const { db, events } = createMockDb([initial]);
      const res = await reconcileOutboxEvent({
        db: db as any,
        idempotencyKey: "idemp-key-1",
        forceStatus: "failed",
        operatorId: "admin-1",
        reason: "Worker died after dispatch attempt",
      });

      expect(res.ok).toBe(true);
      expect(events[0].status).toBe("failed");
      expect(events[0].reconciled_by).toBe("admin-1");
    });
  });
});

describe("outbox mail delivery state & anti-TOCTOU helpers (legacy)", () => {
  describe("buildAntiToctouCasPredicate", () => {
    it("generates predicate containing both is.null and neq.true clauses to handle SQL 3-valued logic", () => {
      const staleThreshold = "2026-09-01T00:00:00.000Z";
      const predicate = buildAntiToctouCasPredicate(staleThreshold);

      // Must account for initial NULL email_sent:
      expect(predicate).toContain("and(payload->>email_sent.is.null,payload->>email_sending.is.null)");
      expect(predicate).toContain("and(payload->>email_sent.is.null,payload->>email_sending.eq.false)");
      expect(predicate).toContain(`and(payload->>email_sent.is.null,payload->>email_lock_at.lt.${staleThreshold})`);

      // Must account for boolean/text false email_sent:
      expect(predicate).toContain("and(payload->>email_sent.neq.true,payload->>email_sending.is.null)");
      expect(predicate).toContain("and(payload->>email_sent.neq.true,payload->>email_sending.eq.false)");
      expect(predicate).toContain(`and(payload->>email_sent.neq.true,payload->>email_lock_at.lt.${staleThreshold})`);
    });
  });

  describe("isAuthoritativeEmailDelivered", () => {
    it("returns { delivered: true } when an accepted delivery attempt exists", async () => {
      const queryBuilder: any = {
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: [{ id: "attempt-uuid-1" }], error: null }),
      };
      const db = {
        from: vi.fn(() => ({
          select: vi.fn(() => queryBuilder),
        })),
      };

      const result = await isAuthoritativeEmailDelivered({
        db: db as any,
        scopedMailType: "project_collaboration_invite:invite-123",
      });

      expect(result.delivered).toBe(true);
      expect(result.error).toBeUndefined();
      expect(queryBuilder.eq).toHaveBeenCalledWith("mail_type", "project_collaboration_invite:invite-123");
      expect(queryBuilder.eq).toHaveBeenCalledWith("provider_status", "accepted");
    });

    it("returns { delivered: false } when no accepted attempt is found", async () => {
      const queryBuilder: any = {
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: [], error: null }),
      };
      const db = {
        from: vi.fn(() => ({
          select: vi.fn(() => queryBuilder),
        })),
      };

      const result = await isAuthoritativeEmailDelivered({
        db: db as any,
        scopedMailType: "hackathon_winner_award:notif-456",
      });

      expect(result.delivered).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it("returns { delivered: false, error } when query fails (fail-closed) (V-02b)", async () => {
      const queryBuilder: any = {
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: null, error: { message: "query timeout" } }),
      };
      const db = {
        from: vi.fn(() => ({
          select: vi.fn(() => queryBuilder),
        })),
      };

      const result = await isAuthoritativeEmailDelivered({
        db: db as any,
        scopedMailType: "hackathon_winner_award:notif-456",
      });

      expect(result.delivered).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("query timeout");
    });
  });
});

describe("handleAdminEmailOutboxReconcile HTTP handler", () => {
  const dummyPayload: OutboxRequestPayload = {
    from: "Corelia <noreply@corelia.academy>",
    to: ["user@example.com"],
    subject: "Test Subject",
    html: "<p>Original Frozen Snapshot</p>",
    idempotency_key: "idemp-key-1",
  };

  it("rejects unauthenticated request with 401", async () => {
    const req = new Request("http://localhost/functions/v1/corelia-api?op=admin.emailOutbox.reconcile", {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: "k1", forceStatus: "accepted", reason: "r1" }),
    });
    const db = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("unauth") }) },
    };
    const res = await handleAdminEmailOutboxReconcile(req, db as any);
    expect(res.status).toBe(401);
  });

  it("rejects non-admin role with 403", async () => {
    const req = new Request("http://localhost/functions/v1/corelia-api?op=admin.emailOutbox.reconcile", {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: JSON.stringify({ idempotencyKey: "k1", forceStatus: "accepted", reason: "r1" }),
    });
    const db = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-1" } }, error: null }) },
      from: vi.fn((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { role: "student" }, error: null }),
      })),
    };
    const res = await handleAdminEmailOutboxReconcile(req, db as any);
    expect(res.status).toBe(403);
  });

  it("allows admin role to reconcile indeterminate event", async () => {
    const initial: OutboxEventRow = {
      id: "outbox-1",
      idempotency_key: "k1",
      event_type: "collaboration_invite",
      recipient_email: "user@example.com",
      status: "indeterminate",
      request_payload: dummyPayload,
      provider_message_id: null,
      lease_acquired_at: null,
      lease_token: null,
      last_attempt_at: new Date().toISOString(),
      first_dispatched_at: new Date().toISOString(),
      reconciled_at: null,
      reconciled_by: null,
      reconcile_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { db, events } = createMockDb([initial]);
    (db as any).auth = { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null }) };
    const originalFrom = db.from;
    db.from = vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { role: "admin" }, error: null }),
        } as any;
      }
      return originalFrom(table);
    });

    const req = new Request("http://localhost/functions/v1/corelia-api?op=admin.emailOutbox.reconcile", {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: JSON.stringify({ idempotencyKey: "k1", forceStatus: "accepted", reason: "Verified in Resend dashboard" }),
    });

    const res = await handleAdminEmailOutboxReconcile(req, db as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(events[0].status).toBe("accepted");
    expect(events[0].reconciled_by).toBe("admin-1");
  });

  it("handles isConfigError by setting indeterminate, clearing first_dispatched_at, and allowing subsequent lease claim (V-01b)", async () => {
    const initial: OutboxEventRow = {
      id: "outbox-config-err",
      idempotency_key: "cfg-err-key",
      event_type: "project_collaboration_invite",
      recipient_email: "test@example.com",
      status: "sending",
      request_payload: dummyPayload,
      provider_message_id: null,
      lease_acquired_at: new Date().toISOString(),
      lease_token: "token-lease-1",
      last_attempt_at: new Date().toISOString(),
      first_dispatched_at: new Date().toISOString(),
      reconciled_at: null,
      reconciled_by: null,
      reconcile_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { db, events } = createMockDb([initial]);

    const committed = await commitOutboxFailure({
      db: db as any,
      idempotencyKey: "cfg-err-key",
      leaseToken: "token-lease-1",
      isPermanent: false,
      isConfigError: true,
      existingFirstDispatchedAt: null, // Initial dispatch attempt
    });

    expect(committed).toBe(true);
    expect(events[0].status).toBe("indeterminate");
    expect(events[0].first_dispatched_at).toBeNull();
    expect(events[0].lease_token).toBeNull();

    // After cooldown (simulate 65 seconds later), claimOutboxLease should succeed:
    const futureTime = new Date(Date.now() + 65_000);
    const reclaimRes = await claimOutboxLease({
      db: db as any,
      idempotencyKey: "cfg-err-key",
      eventType: "project_collaboration_invite",
      recipientEmail: "test@example.com",
      buildSnapshot: () => dummyPayload,
      now: futureTime,
    });

    expect(reclaimRes.type).toBe("claimed");
    if (reclaimRes.type === "claimed") {
      expect(reclaimRes.isInitial).toBe(false);
      expect(events[0].status).toBe("sending");
    }
  });
});

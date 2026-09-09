import { getUserRole } from "../authz.ts";
import { json } from "../http.ts";
import { verifyBearerUser, type SupabaseClient } from "../supabase.ts";

export type OutboxStatus = "pending" | "sending" | "accepted" | "failed" | "indeterminate";

export interface OutboxRequestPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  idempotency_key: string;
}

export interface OutboxEventRow {
  id: string;
  idempotency_key: string;
  event_type: string;
  recipient_email: string;
  status: OutboxStatus;
  request_payload: OutboxRequestPayload;
  provider_message_id: string | null;
  lease_acquired_at: string | null;
  lease_token: string | null;
  last_attempt_at: string | null;
  first_dispatched_at: string | null;
  reconciled_at: string | null;
  reconciled_by: string | null;
  reconcile_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type ClaimOutboxResult =
  | { type: "claimed"; event: OutboxEventRow; leaseToken: string; isInitial: boolean }
  | { type: "already_accepted"; event: OutboxEventRow }
  | { type: "rate_limited"; event: OutboxEventRow; retryAfterSeconds: number }
  | { type: "lease_locked"; event: OutboxEventRow }
  | { type: "failed_permanent"; event: OutboxEventRow }
  | { type: "indeterminate_outside_window"; event: OutboxEventRow }
  | { type: "db_error"; error: Error };

export const LEASE_TIMEOUT_MS = 30_000;
export const COOLDOWN_MS = 60_000;
export const PROVIDER_WINDOW_MS = 24 * 3600 * 1000; // 24 hours (Resend idempotency retention)
export const DISPATCH_SAFETY_BUFFER_MS = 60_000; // 60 seconds safety margin to guarantee provider receives request within retention window

/**
 * Claims lease on an outbox event.
 *
 * 1. Checks legacy email_delivery_attempts bridge if outbox row does not exist yet.
 * 2. Persists event and full request payload snapshot BEFORE first provider call.
 * 3. Reuses identical snapshot on retry to guarantee byte-for-byte identical request body (V-03).
 * 4. Assigns a cryptographically unique lease_token (fencing token) to protect commits (V-01).
 * 5. Leaves first_dispatched_at null until dispatch actually occurs (V-02).
 */
export async function claimOutboxLease(params: {
  db: SupabaseClient;
  idempotencyKey: string;
  eventType: string;
  recipientEmail: string;
  buildSnapshot: () => OutboxRequestPayload;
  now?: Date;
}): Promise<ClaimOutboxResult> {
  const now = params.now ?? new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();

  try {
    // 1. Fetch existing outbox record:
    const { data: existingRows, error: fetchErr } = await params.db
      .from("email_outbox_events")
      .select("*")
      .eq("idempotency_key", params.idempotencyKey)
      .limit(1);

    if (fetchErr) {
      console.error("[corelia-api/outbox] DB fetch error:", fetchErr);
      return { type: "db_error", error: new Error(fetchErr.message) };
    }

    const existingRow = Array.isArray(existingRows) && existingRows.length > 0 ? (existingRows[0] as OutboxEventRow) : null;

    // 2. Initial dispatch path (record does not exist yet):
    if (!existingRow) {
      // Legacy Migration Bridge: check if authoritative delivery attempt already accepted
      const scopedMailType = `${params.eventType}:${params.idempotencyKey}`;
      const legacyCheck = await isAuthoritativeEmailDelivered({
        db: params.db,
        scopedMailType,
      });

      if (legacyCheck.error) {
        console.error("[corelia-api/outbox] Legacy delivery check error:", legacyCheck.error);
        return { type: "db_error", error: legacyCheck.error };
      }

      if (legacyCheck.delivered) {
        const snapshot = params.buildSnapshot();
        const legacyBackfillRecord = {
          idempotency_key: params.idempotencyKey,
          event_type: params.eventType,
          recipient_email: params.recipientEmail,
          status: "accepted" as OutboxStatus,
          request_payload: snapshot,
          provider_message_id: null,
          lease_acquired_at: null,
          lease_token: null,
          last_attempt_at: nowIso,
          first_dispatched_at: nowIso,
          created_at: nowIso,
          updated_at: nowIso,
        };

        const { data: bRows, error: bErr } = await params.db
          .from("email_outbox_events")
          .insert(legacyBackfillRecord)
          .select("*");

        if (bErr) {
          if (bErr.code === "23505" || bErr.message?.includes("unique") || bErr.message?.includes("duplicate")) {
            return claimOutboxLease(params);
          }
          console.error("[corelia-api/outbox] legacy backfill insert error:", bErr);
          return { type: "db_error", error: new Error(bErr.message) };
        }

        const bRow = Array.isArray(bRows) && bRows.length > 0 ? (bRows[0] as OutboxEventRow) : null;
        if (!bRow) {
          return { type: "db_error", error: new Error("legacy_backfill_insert_empty_result") };
        }
        return { type: "already_accepted", event: bRow };
      }

      const snapshot = params.buildSnapshot();
      const leaseToken = crypto.randomUUID();

      const insertRecord = {
        idempotency_key: params.idempotencyKey,
        event_type: params.eventType,
        recipient_email: params.recipientEmail,
        status: "sending" as OutboxStatus,
        request_payload: snapshot,
        lease_acquired_at: nowIso,
        lease_token: leaseToken,
        last_attempt_at: nowIso,
        first_dispatched_at: null, // Left null until provider dispatch actually executes
      };

      const { data: insertedRows, error: insertErr } = await params.db
        .from("email_outbox_events")
        .insert(insertRecord)
        .select("*");

      if (insertErr) {
        // Concurrency contention: another worker inserted in the same millisecond (23505 unique violation)
        if (insertErr.code === "23505" || insertErr.message.includes("unique") || insertErr.message.includes("duplicate")) {
          // Fall through to retry/claim evaluation below
          return claimOutboxLease(params);
        }
        console.error("[corelia-api/outbox] DB insert error:", insertErr);
        return { type: "db_error", error: new Error(insertErr.message) };
      }

      const insertedRow = Array.isArray(insertedRows) && insertedRows.length > 0 ? (insertedRows[0] as OutboxEventRow) : null;
      if (!insertedRow) {
        return { type: "db_error", error: new Error("Outbox row insert returned empty result") };
      }

      return { type: "claimed", event: insertedRow, leaseToken, isInitial: true };
    }

    // 3. Evaluation of existing outbox record:
    if (existingRow.status === "accepted") {
      return { type: "already_accepted", event: existingRow };
    }

    if (existingRow.status === "failed") {
      return { type: "failed_permanent", event: existingRow };
    }

    // Check provider 24-hour retention window only if event was actually dispatched:
    if (existingRow.first_dispatched_at) {
      const firstDispatchedAtMs = Date.parse(existingRow.first_dispatched_at);
      if (nowMs - firstDispatchedAtMs > PROVIDER_WINDOW_MS - DISPATCH_SAFETY_BUFFER_MS) {
        // Outside 24h provider deduplication window: DO NOT auto-resend indeterminate event
        return { type: "indeterminate_outside_window", event: existingRow };
      }
    }

    // Check active lease lock (< 30s):
    const leaseAcquiredAtMs = existingRow.lease_acquired_at ? Date.parse(existingRow.lease_acquired_at) : 0;
    const isLeaseActive = existingRow.status === "sending" && (nowMs - leaseAcquiredAtMs < LEASE_TIMEOUT_MS) && (leaseAcquiredAtMs <= nowMs);

    if (isLeaseActive) {
      return { type: "lease_locked", event: existingRow };
    }

    // Check rate-limit cooldown (< 60s) for retrying indeterminate/failed attempts:
    if (existingRow.status !== "sending") {
      const lastAttemptAtMs = existingRow.last_attempt_at ? Date.parse(existingRow.last_attempt_at) : 0;
      const attemptAgeMs = nowMs - lastAttemptAtMs;
      if (lastAttemptAtMs && attemptAgeMs < COOLDOWN_MS && lastAttemptAtMs <= nowMs) {
        const retryAfterSeconds = Math.ceil((COOLDOWN_MS - attemptAgeMs) / 1000);
        return { type: "rate_limited", event: existingRow, retryAfterSeconds };
      }
    }

    // 4. Atomic CAS lease acquisition with fencing token:
    const staleThresholdIso = new Date(nowMs - LEASE_TIMEOUT_MS).toISOString();
    const leaseToken = crypto.randomUUID();

    const { data: updatedRows, error: updateErr } = await params.db
      .from("email_outbox_events")
      .update({
        status: "sending",
        lease_acquired_at: nowIso,
        lease_token: leaseToken,
        last_attempt_at: nowIso,
        updated_at: nowIso,
      })
      .eq("idempotency_key", params.idempotencyKey)
      .or(`status.in.(pending,indeterminate),and(status.eq.sending,lease_acquired_at.lt.${staleThresholdIso}),and(status.eq.sending,lease_acquired_at.gt.${nowIso})`)
      .select("*");

    if (updateErr) {
      console.error("[corelia-api/outbox] DB CAS update error:", updateErr);
      return { type: "db_error", error: new Error(updateErr.message) };
    }

    if (!updatedRows || updatedRows.length === 0) {
      // Concurrent worker acquired lease in the same instant
      return { type: "lease_locked", event: existingRow };
    }

    return { type: "claimed", event: updatedRows[0] as OutboxEventRow, leaseToken, isInitial: false };
  } catch (err) {
    console.error("[corelia-api/outbox] Exception during claimOutboxLease:", err);
    return { type: "db_error", error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Persists the dispatch attempt timestamp to the outbox event BEFORE calling the provider.
 *
 * Fenced: only succeeds if lease_token matches and status is 'sending'.
 * Guarantees that first_dispatched_at is set once and remains IMMUTABLE across retries.
 * If this call fails or lease was lost, dispatch MUST NOT proceed.
 */
export async function persistOutboxDispatch(params: {
  db: SupabaseClient;
  idempotencyKey: string;
  leaseToken: string;
  existingFirstDispatchedAt?: string | null;
  now?: Date;
}): Promise<{ ok: boolean; firstDispatchedAt: string; error?: string }> {
  const now = params.now ?? new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();

  // V-02a [P2]: Validate that the 24-hour provider idempotency retention window
  // (with safety margin) has not expired since the initial dispatch attempt.
  // Prevents race condition where lease was claimed before expiration, but worker delay/stall
  // causes the actual dispatch to occur outside the provider's deduplication window.
  if (params.existingFirstDispatchedAt) {
    const firstDispatchedAtMs = Date.parse(params.existingFirstDispatchedAt);
    if (
      Number.isFinite(firstDispatchedAtMs) &&
      nowMs - firstDispatchedAtMs > PROVIDER_WINDOW_MS - DISPATCH_SAFETY_BUFFER_MS
    ) {
      console.warn(
        `[corelia-api/outbox] persistOutboxDispatch rejected: elapsed ${nowMs - firstDispatchedAtMs}ms exceeds provider window threshold`,
      );
      return {
        ok: false,
        firstDispatchedAt: params.existingFirstDispatchedAt,
        error: "dispatch_window_expired",
      };
    }
  }

  const patch: Record<string, unknown> = {
    last_attempt_at: nowIso,
    updated_at: nowIso,
  };

  // first_dispatched_at is immutable once set; only set if not previously established
  if (!params.existingFirstDispatchedAt) {
    patch.first_dispatched_at = nowIso;
  }

  try {
    const { data, error } = await params.db
      .from("email_outbox_events")
      .update(patch)
      .eq("idempotency_key", params.idempotencyKey)
      .eq("lease_token", params.leaseToken)
      .eq("status", "sending")
      .select("id, first_dispatched_at");

    if (error) {
      console.error("[corelia-api/outbox] persistOutboxDispatch error:", error);
      return { ok: false, firstDispatchedAt: params.existingFirstDispatchedAt || nowIso, error: error.message };
    }

    const affected = Array.isArray(data) ? data.length : 0;
    if (affected === 0) {
      console.warn(`[corelia-api/outbox] persistOutboxDispatch fenced: 0 rows for leaseToken: ${params.leaseToken}`);
      return { ok: false, firstDispatchedAt: params.existingFirstDispatchedAt || nowIso, error: "lease_lost_or_fenced" };
    }

    const persistedTime = (data[0] as any)?.first_dispatched_at || params.existingFirstDispatchedAt || nowIso;
    return { ok: true, firstDispatchedAt: persistedTime };
  } catch (err) {
    console.error("[corelia-api/outbox] persistOutboxDispatch exception:", err);
    return { ok: false, firstDispatchedAt: params.existingFirstDispatchedAt || nowIso, error: String(err) };
  }
}

/**
 * Commits successful provider delivery to outbox with fencing token protection.
 *
 * Fenced: only commits if lease_token matches and event is still in 'sending' status.
 * Never overwrites an accepted status, and asserts affected rows > 0.
 * Does NOT alter first_dispatched_at (which is set immutably prior to dispatch).
 */
export async function commitOutboxSuccess(params: {
  db: SupabaseClient;
  idempotencyKey: string;
  leaseToken: string;
  providerMessageId: string | null;
  maxRetries?: number;
}): Promise<boolean> {
  const maxRetries = params.maxRetries ?? 3;
  const nowIso = new Date().toISOString();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data, error } = await params.db
        .from("email_outbox_events")
        .update({
          status: "accepted",
          provider_message_id: params.providerMessageId,
          lease_token: null,
          updated_at: nowIso,
        })
        .eq("idempotency_key", params.idempotencyKey)
        .eq("lease_token", params.leaseToken)
        .eq("status", "sending")
        .select("id");

      if (error) {
        console.warn(`[corelia-api/outbox] commitOutboxSuccess attempt ${attempt + 1} error:`, error);
      } else {
        const rowsAffected = Array.isArray(data) ? data.length : 0;
        if (rowsAffected > 0) {
          return true;
        }

        // 0 rows affected: check if already committed as accepted by idempotent duplicate
        const { data: checkRows } = await params.db
          .from("email_outbox_events")
          .select("status")
          .eq("idempotency_key", params.idempotencyKey)
          .limit(1);

        if (Array.isArray(checkRows) && checkRows[0]?.status === "accepted") {
          return true;
        }

        console.warn(`[corelia-api/outbox] commitOutboxSuccess fenced: 0 rows updated for leaseToken: ${params.leaseToken}`);
        return false;
      }
    } catch (err) {
      console.warn(`[corelia-api/outbox] commitOutboxSuccess attempt ${attempt + 1} exception:`, err);
    }
    await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
  }

  console.error("[corelia-api/outbox] commitOutboxSuccess failed after retries for key:", params.idempotencyKey);
  return false;
}

/**
 * Commits delivery failure or indeterminate state with fencing token protection.
 *
 * Fenced: will NEVER overwrite an accepted status or a lease owned by a newer worker.
 * Asserts affected rows > 0.
 * Does NOT alter first_dispatched_at (which is set immutably prior to dispatch).
 */
export async function commitOutboxFailure(params: {
  db: SupabaseClient;
  idempotencyKey: string;
  leaseToken: string;
  isPermanent: boolean;
  isConfigError?: boolean;
  existingFirstDispatchedAt?: string | null;
  maxRetries?: number;
}): Promise<boolean> {
  const status: OutboxStatus = params.isConfigError ? "indeterminate" : params.isPermanent ? "failed" : "indeterminate";
  const maxRetries = params.maxRetries ?? 3;
  const nowIso = new Date().toISOString();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const patch: Record<string, unknown> = {
        status,
        lease_token: null,
        updated_at: nowIso,
      };

      // V-01b: Only clear first_dispatched_at if this was the initial dispatch attempt
      // (no prior dispatch timestamp existed before this attempt: existingFirstDispatchedAt === null)
      // AND provider rejected at gateway level (401/403).
      // If a prior dispatch attempt already occurred, first_dispatched_at is immutable and must
      // NEVER be cleared across retries, preventing duplicate delivery outside the 24h retention window.
      if (params.isConfigError && params.existingFirstDispatchedAt === null) {
        patch.first_dispatched_at = null;
      }

      const { data, error } = await params.db
        .from("email_outbox_events")
        .update(patch)
        .eq("idempotency_key", params.idempotencyKey)
        .eq("lease_token", params.leaseToken)
        .eq("status", "sending") // Strictly guarded: never downgrade from accepted
        .select("id");

      if (error) {
        console.warn(`[corelia-api/outbox] commitOutboxFailure attempt ${attempt + 1} error:`, error);
      } else {
        const rowsAffected = Array.isArray(data) ? data.length : 0;
        if (rowsAffected > 0) {
          return true;
        }
        console.warn(`[corelia-api/outbox] commitOutboxFailure fenced: 0 rows updated for leaseToken: ${params.leaseToken}`);
        return false;
      }
    } catch (err) {
      console.warn(`[corelia-api/outbox] commitOutboxFailure attempt ${attempt + 1} exception:`, err);
    }
    await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
  }

  console.error("[corelia-api/outbox] commitOutboxFailure failed after retries for key:", params.idempotencyKey);
  return false;
}

/**
 * Releases outbox event when provider is not configured (skipped: true).
 * Returns status to 'pending', clears lease, and leaves first_dispatched_at as null.
 */
export async function releaseOutboxUnconfigured(params: {
  db: SupabaseClient;
  idempotencyKey: string;
  leaseToken: string;
}): Promise<boolean> {
  const nowIso = new Date().toISOString();
  try {
    const { data, error } = await params.db
      .from("email_outbox_events")
      .update({
        status: "pending",
        lease_acquired_at: null,
        lease_token: null,
        updated_at: nowIso,
      })
      .eq("idempotency_key", params.idempotencyKey)
      .eq("lease_token", params.leaseToken)
      .eq("status", "sending")
      .select("id");

    return !error && Array.isArray(data) && data.length > 0;
  } catch (err) {
    console.error("[corelia-api/outbox] releaseOutboxUnconfigured exception:", err);
    return false;
  }
}

/**
 * Administrative audited reconciliation helper for resolving indeterminate or stale sending outbox events.
 *
 * Restricts updates to events currently in 'indeterminate' status, or 'sending' status with an expired lease.
 * Records operator_id, timestamp, and verification reason.
 * Asserts affected rows > 0.
 */
export async function reconcileOutboxEvent(params: {
  db: SupabaseClient;
  idempotencyKey: string;
  forceStatus: "accepted" | "failed";
  operatorId: string;
  reason: string;
  providerMessageId?: string | null;
  now?: Date;
}): Promise<{ ok: boolean; affectedRows: number; error?: string }> {
  if (!params.reason?.trim()) {
    return { ok: false, affectedRows: 0, error: "missing_reconcile_reason" };
  }
  if (!params.operatorId?.trim()) {
    return { ok: false, affectedRows: 0, error: "missing_operator_id" };
  }

  try {
    const now = params.now ?? new Date();
    const nowIso = now.toISOString();
    const staleThresholdIso = new Date(now.getTime() - LEASE_TIMEOUT_MS).toISOString();

    const { data, error } = await params.db
      .from("email_outbox_events")
      .update({
        status: params.forceStatus,
        reconciled_at: nowIso,
        reconciled_by: params.operatorId.trim(),
        reconcile_reason: params.reason.trim(),
        provider_message_id: params.providerMessageId?.trim() ?? null,
        lease_token: null,
        updated_at: nowIso,
      })
      .eq("idempotency_key", params.idempotencyKey)
      .or(`status.eq.indeterminate,and(status.eq.sending,lease_acquired_at.lt.${staleThresholdIso})`)
      .select("id");

    if (error) {
      return { ok: false, affectedRows: 0, error: error.message };
    }

    const affectedRows = Array.isArray(data) ? data.length : 0;
    if (affectedRows === 0) {
      return { ok: false, affectedRows: 0, error: "event_not_found_or_not_reconcilable" };
    }

    return { ok: true, affectedRows };
  } catch (err) {
    return { ok: false, affectedRows: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

// -----------------------------------------------------------------------------
// Legacy & Complementary Helpers (Preserved for compatibility and fallback checks)
// -----------------------------------------------------------------------------

/**
 * Tra cứu trạng thái giao nhận đã gửi từ bảng email_delivery_attempts.
 * Sử dụng .limit(1) để miễn nhiễm với trường hợp nhiều bản ghi accepted.
 * Bắt buộc fail-closed: lỗi truy vấn trả về { delivered: false, error } để chặn dispatch.
 * Không lọc theo recipient_email để chống việc người nhận đổi email làm sót audit cũ.
 */
export async function isAuthoritativeEmailDelivered(params: {
  db: SupabaseClient;
  scopedMailType: string;
}): Promise<{ delivered: boolean; error?: Error }> {
  try {
    const { data, error } = await params.db
      .from("email_delivery_attempts")
      .select("id")
      .eq("mail_type", params.scopedMailType)
      .eq("provider_status", "accepted")
      .limit(1);

    if (error) {
      console.error("[corelia-api] authoritative delivery check error:", error);
      return { delivered: false, error: new Error(error.message) };
    }
    return { delivered: Array.isArray(data) && data.length > 0 };
  } catch (err) {
    console.error("[corelia-api] authoritative delivery check exception:", err);
    return { delivered: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Predicate cho notification CAS (phục vụ hiển thị và downstream display cache).
 */
export function buildAntiToctouCasPredicate(staleThresholdIso: string): string {
  return [
    `and(payload->>email_sent.is.null,payload->>email_sending.is.null)`,
    `and(payload->>email_sent.is.null,payload->>email_sending.eq.false)`,
    `and(payload->>email_sent.is.null,payload->>email_lock_at.lt.${staleThresholdIso})`,
    `and(payload->>email_sent.neq.true,payload->>email_sending.is.null)`,
    `and(payload->>email_sent.neq.true,payload->>email_sending.eq.false)`,
    `and(payload->>email_sent.neq.true,payload->>email_lock_at.lt.${staleThresholdIso})`,
  ].join(",");
}

/**
 * Admin audited reconciliation endpoint handler for corelia-api.
 * Protected: requires bearer auth and role 'admin' or 'support_staff'.
 */
export async function handleAdminEmailOutboxReconcile(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const role = await getUserRole(db, user.id);
    if (role !== "admin" && role !== "support_staff") {
      return json({ message: "forbidden:admin_only" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const { idempotencyKey, forceStatus, reason, providerMessageId } = body ?? {};

    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      return json({ message: "invalid_input:missing_idempotency_key" }, 400);
    }
    if (forceStatus !== "accepted" && forceStatus !== "failed") {
      return json({ message: "invalid_input:invalid_force_status" }, 400);
    }
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return json({ message: "invalid_input:missing_reconcile_reason" }, 400);
    }

    const res = await reconcileOutboxEvent({
      db,
      idempotencyKey,
      forceStatus,
      operatorId: user.id,
      reason,
      providerMessageId: typeof providerMessageId === "string" ? providerMessageId : null,
    });

    if (!res.ok) {
      if (res.error === "event_not_found_or_not_reconcilable" || res.error === "event_not_found_or_not_indeterminate") {
        return json({ message: "event_not_found_or_not_reconcilable" }, 409);
      }
      return json({ message: res.error ?? "reconcile_failed" }, 400);
    }

    return json({ ok: true, affected_rows: res.affectedRows }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Authorization|session|token/i.test(msg)) return json({ message: "unauthenticated" }, 401);
    console.error("[corelia-api] admin.emailOutbox.reconcile", err);
    return json({ message: "internal_error" }, 500);
  }
}

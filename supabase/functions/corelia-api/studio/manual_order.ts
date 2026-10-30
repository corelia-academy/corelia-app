import { getUserRole } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";
import { checkManualOrder, type ManualOrder } from "./ranking.ts";
import { loadRankingInput, runRanking } from "./ranking_run.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ManualOrderSnapshotItem = {
  course_id: string;
  position: number;
  reason: string | null;
};

function parseSnapshot(value: unknown): ManualOrderSnapshotItem[] | null {
  if (!Array.isArray(value)) return null;
  const ids = new Set<string>();
  const rows: ManualOrderSnapshotItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const courseId = typeof row.course_id === "string" ? row.course_id : "";
    if (!UUID_RE.test(courseId) || ids.has(courseId) || typeof row.position !== "number" || !Number.isInteger(row.position) || row.position < 1) return null;
    if (row.reason !== null && row.reason !== undefined && typeof row.reason !== "string") return null;
    ids.add(courseId);
    rows.push({
      course_id: courseId,
      position: row.position,
      reason: typeof row.reason === "string" ? row.reason.trim() || null : null,
    });
  }
  return rows;
}

async function adminId(req: Request, db: SupabaseClient): Promise<string | Response> {
  let userId: string;
  try {
    userId = (await verifyBearerUser(req, db)).id;
  } catch {
    return json({ message: "unauthenticated" }, 401);
  }
  if ((await getUserRole(db, userId)) !== "admin") return json({ message: "forbidden" }, 403);
  return userId;
}

/** Save one manual position and recompute the displayed ranking. The explanation is optional. */
export async function handleCatalogManualOrder(req: Request, db: SupabaseClient): Promise<Response> {
  const actor = await adminId(req, db);
  if (actor instanceof Response) return actor;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const courseId = String(body.course_id ?? "");
  const position = body.position;
  const hasReason = Object.prototype.hasOwnProperty.call(body, "reason");
  if (
    !UUID_RE.test(courseId)
    || typeof position !== "number"
    || !Number.isInteger(position)
    || position < 1
    || (hasReason && body.reason !== null && typeof body.reason !== "string")
  ) return json({ message: "invalid_input" }, 400);

  const reason = typeof body.reason === "string" ? body.reason.trim() || null : null;
  const { input } = await loadRankingInput(db);
  const check = checkManualOrder(input, courseId, position);
  if (!check.ok) return json({ message: check.reason }, 409);

  const { data, error } = await db.rpc("studio_set_manual_order", {
    p_course_id: courseId,
    p_position: position,
    p_reason: reason,
    p_actor: actor,
  });
  if (error) {
    if (error.message === "course_not_found") return json({ message: "course_not_found" }, 404);
    throw new Error(error.message);
  }
  const saved = await runRanking(db);
  return json({ manual_order_id: data as string, computed_at: saved.computed_at }, 200);
}

/** Remove active manual overrides and return the snapshot needed to undo the reset. */
export async function handleCatalogManualOrderReset(req: Request, db: SupabaseClient): Promise<Response> {
  const actor = await adminId(req, db);
  if (actor instanceof Response) return actor;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const expected = body.expected_snapshot === undefined || body.expected_snapshot === null
    ? null
    : parseSnapshot(body.expected_snapshot);
  if (body.expected_snapshot !== undefined && body.expected_snapshot !== null && !expected) return json({ message: "invalid_input" }, 400);

  const { data, error } = await db.rpc("studio_clear_manual_orders", { p_expected: expected });
  if (error) {
    if (error.message === "manual_order_conflict") return json({ message: "manual_order_conflict" }, 409);
    throw new Error(error.message);
  }
  const saved = await runRanking(db);
  return json({ snapshot: data as ManualOrderSnapshotItem[], computed_at: saved.computed_at }, 200);
}

/** Restore only when the current score/prerequisite graph still accepts every saved position. */
export async function handleCatalogManualOrderRestore(req: Request, db: SupabaseClient): Promise<Response> {
  const actor = await adminId(req, db);
  if (actor instanceof Response) return actor;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const snapshot = parseSnapshot(body.snapshot);
  if (!snapshot || snapshot.length === 0) return json({ message: "invalid_input" }, 400);

  const { input } = await loadRankingInput(db);
  const snapshotOrders: ManualOrder[] = snapshot.map((item) => ({
    course_id: item.course_id,
    position: item.position,
    // Existing active rows have one current record per course; the timestamp only selects the
    // latest row for that course, so one stable value preserves the batch's effective order.
    created_at: "1970-01-01T00:00:00.000Z",
  }));
  const validationInput = { ...input, manualOrders: snapshotOrders };
  for (const item of snapshot) {
    const check = checkManualOrder(validationInput, item.course_id, item.position);
    if (!check.ok) return json({ message: check.reason }, 409);
  }

  const { data, error } = await db.rpc("studio_restore_manual_orders", { p_snapshot: snapshot, p_actor: actor });
  if (error) {
    if (error.message === "manual_order_conflict") return json({ message: "manual_order_conflict" }, 409);
    throw new Error(error.message);
  }
  const saved = await runRanking(db);
  return json({ snapshot: data as ManualOrderSnapshotItem[], computed_at: saved.computed_at }, 200);
}

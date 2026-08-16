import { isAuthFailure, getUserRole } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";
import { mintCredentialOnce } from "./mint.ts";

/**
 * Retry all credential_issuances that are held at 'pending' with
 * error_message='awaiting_holder_id' for a specific user.
 *
 * Also picks up 'pending' rows with error_message=NULL that are older than
 * ORPHAN_AGE_MS: mintCredentialOnce() briefly clears error_message right
 * before it POSTs to OpenCampus (see mint.ts), so a NULL value can mean
 * either a genuinely in-flight attempt or a row orphaned by an unexpected
 * exception before that fix landed. The age guard keeps this from re-firing
 * a mint that is still actually running.
 *
 * Called automatically after a user successfully connects their OCID
 * (see OCIDRedirect.tsx → credentials.retryPending).
 *
 * Each mint is attempted independently; partial failures are logged but do
 * not abort the others.
 */
const ORPHAN_AGE_MS = 2 * 60 * 1000;

export async function retryPendingIssuancesForUser(
  db: SupabaseClient,
  userId: string,
): Promise<{ retried: number; minted: number; stillFailed: number }> {
  // Rows explicitly marked awaiting_holder_id are always retried immediately
  // (the whole point of calling this right after connecting OCID). The
  // error_message IS NULL branch only matches once it's old enough to no
  // longer be a mint that's still genuinely in flight — see ORPHAN_AGE_MS doc
  // above. Kept as a single nested-or so the age check does not also gate
  // the awaiting_holder_id branch.
  const orphanCutoffIso = new Date(Date.now() - ORPHAN_AGE_MS).toISOString();
  const { data: pending, error } = await db
    .from("credential_issuances")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .or(`error_message.eq.awaiting_holder_id,and(error_message.is.null,updated_at.lt.${orphanCutoffIso})`);

  if (error) throw new Error(error.message);
  if (!pending?.length) return { retried: 0, minted: 0, stillFailed: 0 };

  let minted = 0;
  let stillFailed = 0;

  for (const row of pending) {
    try {
      const result = await mintCredentialOnce(db, String(row.id));
      if (result.ok || result.duplicate) {
        minted++;
      } else if (result.error === "awaiting_holder_id") {
        // Holder still missing — leave as-is
        stillFailed++;
      } else {
        stillFailed++;
      }
    } catch (e) {
      console.error("[corelia-api] retry_pending: mint failed for issuance", row.id, e);
      stillFailed++;
    }
  }

  return { retried: pending.length, minted, stillFailed };
}

async function retryFailedIssuanceForUser(
  db: SupabaseClient,
  callerId: string,
  issuanceId: string,
): Promise<{
  retried: number;
  minted: number;
  stillFailed: number;
  status: string;
  ocCredentialId: string | null;
  message?: string;
}> {
  const role = await getUserRole(db, callerId);
  const isAdmin = role === "admin" || role === "support_staff";

  let query = db.from("credential_issuances").select("id, status, user_id").eq("id", issuanceId);
  if (!isAdmin) {
    query = query.eq("user_id", callerId);
  }
  const { data: issuance, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!issuance) throw new Error("Credential issuance not found");
  if (issuance.status !== "failed" && issuance.status !== "pending") {
    throw new Error("Only failed or pending credential issuances can be retried");
  }

  const { error: resetError } = await db
    .from("credential_issuances")
    .update({
      status: "pending",
      error_message: null,
      oc_request_payload: null,
      oc_response: null,
    })
    .eq("id", issuanceId);
  if (resetError) throw new Error(resetError.message);

  const result = await mintCredentialOnce(db, issuanceId);
  const { data: after, error: afterError } = await db
    .from("credential_issuances")
    .select("status, oc_credential_id, error_message")
    .eq("id", issuanceId)
    .maybeSingle();
  if (afterError) throw new Error(afterError.message);

  const status = String(after?.status ?? "unknown");
  return {
    retried: 1,
    minted: result.ok ? 1 : 0,
    stillFailed: status === "failed" ? 1 : 0,
    status,
    ocCredentialId: after?.oc_credential_id ?? null,
    ...(status === "failed" && after?.error_message
      ? { message: String(after.error_message) }
      : {}),
  };
}

export async function handleRetryPendingCredentials(
  req: Request,
  db: SupabaseClient,
): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const body = (await req.json().catch(() => ({}))) as { issuanceId?: unknown };
    const issuanceId = typeof body.issuanceId === "string" ? body.issuanceId.trim() : "";
    if (issuanceId) {
      const result = await retryFailedIssuanceForUser(db, user.id, issuanceId);
      return json({ ok: true, ...result });
    }
    const result = await retryPendingIssuancesForUser(db, user.id);
    return json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ message: "Chưa đăng nhập", ok: false }, 401);
    console.error("[corelia-api] credentials.retryPending", e);
    return json({ message: "Không thể retry credentials.", ok: false }, 500);
  }
}

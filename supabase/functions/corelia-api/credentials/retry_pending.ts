import { isAuthFailure } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";
import { mintCredentialOnce } from "./mint.ts";

/**
 * Retry all credential_issuances that are held at 'pending' with
 * error_message='awaiting_holder_id' for a specific user.
 *
 * Called automatically after a user successfully connects their OCID
 * (see OCIDRedirect.tsx → credentials.retryPending).
 *
 * Each mint is attempted independently; partial failures are logged but do
 * not abort the others.
 */
export async function retryPendingIssuancesForUser(
  db: SupabaseClient,
  userId: string,
): Promise<{ retried: number; minted: number; stillFailed: number }> {
  const { data: pending, error } = await db
    .from("credential_issuances")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .eq("error_message", "awaiting_holder_id");

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
  userId: string,
  issuanceId: string,
): Promise<{
  retried: number;
  minted: number;
  stillFailed: number;
  status: string;
  ocCredentialId: string | null;
  message?: string;
}> {
  const { data: issuance, error } = await db
    .from("credential_issuances")
    .select("id, status")
    .eq("id", issuanceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!issuance) throw new Error("Credential issuance not found");
  if (issuance.status !== "failed") {
    throw new Error("Only failed credential issuances can be retried");
  }

  const { error: resetError } = await db
    .from("credential_issuances")
    .update({
      status: "pending",
      error_message: null,
      oc_request_payload: null,
      oc_response: null,
    })
    .eq("id", issuanceId)
    .eq("user_id", userId);
  if (resetError) throw new Error(resetError.message);

  const result = await mintCredentialOnce(db, issuanceId);
  const { data: after, error: afterError } = await db
    .from("credential_issuances")
    .select("status, oc_credential_id, error_message")
    .eq("id", issuanceId)
    .eq("user_id", userId)
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

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

export async function handleRetryPendingCredentials(
  req: Request,
  db: SupabaseClient,
): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const result = await retryPendingIssuancesForUser(db, user.id);
    return json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ message: "Chưa đăng nhập", ok: false }, 401);
    console.error("[corelia-api] credentials.retryPending", e);
    return json({ message: "Không thể retry credentials.", ok: false }, 500);
  }
}

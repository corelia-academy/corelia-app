import { getUserRole, isAuthFailure } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";

export async function handleRevokeCredential(
  req: Request,
  db: SupabaseClient,
): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const role = await getUserRole(db, user.id);
    if (role !== "admin" && role !== "support_staff") {
      return json({ ok: false, message: "Không đủ quyền thu hồi chứng nhận." }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(body.id ?? "").trim();
    const isGhost = Boolean(body.isGhost);

    if (!id) {
      return json({ ok: false, message: "Thiếu ID chứng nhận cần thu hồi." }, 400);
    }

    if (isGhost) {
      const { error } = await db
        .from("pending_credential_issuances")
        .delete()
        .eq("id", id);
      if (error) throw new Error(error.message);
      return json({ ok: true, message: "Đã thu hồi cấp chờ thành công." });
    }

    // Standard credential issuance
    const { data: issuance, error: fetchErr } = await db
      .from("credential_issuances")
      .select("id, status")
      .eq("id", id)
      .maybeSingle<{ id: string; status: string }>();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!issuance) {
      return json({ ok: false, message: "Không tìm thấy chứng nhận." }, 404);
    }

    if (issuance.status === "minted") {
      return json({
        ok: false,
        message: "Không thể thu hồi chứng chỉ đã được mint on-chain thành công.",
      }, 400);
    }

    const now = new Date().toISOString();
    const reason = String(body.reason ?? "").trim() || "Revoked by admin";

    // Mark pending or failed issuance as revoked with audit trail
    const { error: updateErr } = await db
      .from("credential_issuances")
      .update({
        status: "revoked",
        revoked_at: now,
        revoked_by: user.id,
        revoked_reason: reason,
        updated_at: now,
      })
      .eq("id", id)
      .in("status", ["pending", "failed"]);

    if (updateErr) throw new Error(updateErr.message);
    return json({ ok: true, status: "revoked", message: "Đã thu hồi chứng nhận thành công." });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) {
      return json({ ok: false, message: "Chưa đăng nhập." }, 401);
    }
    console.error("[corelia-api] credentials.revoke error:", e);
    return json({ ok: false, message: "Thu hồi chứng nhận thất bại." }, 500);
  }
}

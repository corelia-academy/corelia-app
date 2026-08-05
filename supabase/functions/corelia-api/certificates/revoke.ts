import { getUserRole, isAuthFailure } from "../lib/authz.ts";
import { json, nowIso } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";
import { normalizeCertificateCode } from "./code.ts";

/** Admin/support only — marks a certificate as revoked (or restores it).
 *
 *  Revocation lives here rather than on enrollments.certificate_issued_at because a
 *  verification record must outlive the enrollment: clearing the timestamp would leave
 *  the code resolving as valid, and deleting the record would make an already-printed
 *  code simply vanish instead of reading "đã thu hồi". */
export async function handleRevokeCertificate(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const role = await getUserRole(db, user.id);
    if (role !== "admin" && role !== "support_staff") {
      return json({ message: "Không đủ quyền thu hồi chứng nhận.", ok: false }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const code = normalizeCertificateCode(String(body.code ?? "").slice(0, 64));
    if (!code) return json({ message: "Mã chứng nhận không hợp lệ.", ok: false }, 400);

    const restore = body.restore === true;
    const reason = String(body.reason ?? "").trim();

    const { data, error } = await db.from("certificate_records")
      .update(
        restore
          ? { revoked_at: null, revoked_by: null, revoked_reason: null }
          : { revoked_at: nowIso(), revoked_by: user.id, revoked_reason: reason || null },
      )
      .eq("code", code)
      .select("code, revoked_at, revoked_reason")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return json({ message: "Không tìm thấy chứng nhận.", ok: false }, 404);

    return json({ ok: true, ...data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ message: "Chưa đăng nhập", ok: false }, 401);
    console.error("[corelia-api] certificates.revoke", e);
    return json({ message: "Không thể thu hồi chứng nhận.", ok: false }, 500);
  }
}

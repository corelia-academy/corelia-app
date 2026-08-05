import { coreliaEdgeUrl, supabaseFunctionHeaders } from "@/lib/coreliaEdgeApi";
import { supabase } from "@/lib/supabase";

/** Shape returned by public.corelia_verify_certificate(). Deliberately carries no
 *  user_id or email — the RPC never selects them. */
export type VerifiedCertificate = {
  status: "valid" | "revoked" | "not_found";
  code?: string | null;
  holder_name?: string | null;
  course_title?: string | null;
  instructor_name?: string | null;
  issued_at?: string | null;
  revoked_at?: string | null;
  revoked_reason?: string | null;
  /** Present only when the course is still published. */
  course_path?: string | null;
  /** Present only when the holder's profile is public and has a username. */
  holder_path?: string | null;
  /** Layout snapshot so /verify can redraw the exact artifact the learner downloaded.
   *  Nulls are normal — certificateLayout() applies the defaults and the clamping. */
  certificate_template_url?: string | null;
  certificate_name_x_percent?: number | null;
  certificate_name_y_percent?: number | null;
  certificate_name_size_percent?: number | null;
  certificate_name_color?: string | null;
  certificate_footer_x_percent?: number | null;
  certificate_footer_y_percent?: number | null;
  certificate_footer_size_percent?: number | null;
  certificate_footer_color?: string | null;
  certificate_qr_x_percent?: number | null;
  certificate_qr_y_percent?: number | null;
  certificate_qr_size_percent?: number | null;
  oc_credential_id?: string | null;
};

/** For ops NOT in PROTECTED_OPS (verify_jwt is off for this function, see
 *  supabase/config.toml) — no session required, only the anon apikey header. */
async function postPublicJson<T>(op: string, body: Record<string, unknown>): Promise<T> {
  const url = coreliaEdgeUrl(op);
  if (!url) throw new Error("Thiếu cấu hình Corelia Edge URL.");

  const res = await fetch(url, {
    method: "POST",
    headers: { ...supabaseFunctionHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const parsed = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) {
    throw new Error(typeof parsed.message === "string" ? parsed.message : `HTTP ${res.status}`);
  }
  return parsed;
}

async function postJson<T>(op: string, body: Record<string, unknown>): Promise<T> {
  const url = coreliaEdgeUrl(op);
  if (!url) throw new Error("Thiếu cấu hình Corelia Edge URL.");

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Chưa đăng nhập");

  const res = await fetch(url, {
    method: "POST",
    headers: { ...supabaseFunctionHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const parsed = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) {
    throw new Error(typeof parsed.message === "string" ? parsed.message : `HTTP ${res.status}`);
  }
  return parsed;
}

/** Public — resolves a certificate code for the /verify page. No login required. */
export async function invokeVerifyCertificate(
  code: string,
): Promise<{ ok: boolean } & VerifiedCertificate> {
  return await postPublicJson("certificates.verify", { code });
}

/** Admin/support only. */
export async function invokeRevokeCertificate(params: {
  code: string;
  reason?: string;
  restore?: boolean;
}): Promise<{ ok: boolean; message?: string }> {
  return await postJson("certificates.revoke", {
    code: params.code,
    ...(params.reason ? { reason: params.reason } : {}),
    ...(params.restore ? { restore: true } : {}),
  });
}

/** Absolute URL a QR code on a printed certificate points at. */
export function certificateVerifyUrl(code: string): string {
  return `${window.location.origin}/verify/${encodeURIComponent(code)}`;
}

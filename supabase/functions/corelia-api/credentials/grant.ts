import { canManageHackathon, getUserRole, isAuthFailure } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";
import { issuerReferenceId, legacyIssuerReferenceId } from "./ids.ts";
import { mintCredentialOnce } from "./mint.ts";
import { getDefaultMintNetwork, type MintNetwork } from "./settings.ts";
import { resolveMintNetwork } from "./oc_payload.ts";

export async function handleGrantCredentials(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const templateId = String(body.templateId ?? "").trim();
    const userIdsRaw = body.userIds;
    const grantedReason = body.grantedReason != null ? String(body.grantedReason) : null;

    const userIds = Array.isArray(userIdsRaw)
      ? userIdsRaw.map((x) => String(x).trim()).filter(Boolean)
      : [];

    if (!templateId) return json({ ok: false, message: "Thiếu templateId" }, 400);
    if (userIds.length === 0) return json({ ok: false, message: "Thiếu userIds" }, 400);

    const { data: template, error: tplErr } = await db.from("credential_templates").select("*").eq(
      "id",
      templateId,
    ).maybeSingle();
    if (tplErr) throw new Error(tplErr.message);
    if (!template) return json({ ok: false, message: "Không tìm thấy template." }, 404);
    if (!template.is_active) {
      return json({ ok: false, message: "Template chưa active." }, 400);
    }

    const scope = String(template.scope_type ?? "");
    const role = await getUserRole(db, user.id);

    if (scope === "hackathon") {
      const hid = String(template.hackathon_id ?? "");
      if (!hid) return json({ ok: false, message: "Template hackathon không hợp lệ." }, 400);
      if (role !== "admin" && role !== "support_staff") {
        if (!await canManageHackathon(db, user.id, hid)) {
          return json({ ok: false, message: "Không đủ quyền cấp giải." }, 403);
        }
      }
    } else if (scope === "activity_milestone") {
      if (role !== "admin" && role !== "support_staff") {
        return json({ ok: false, message: "Chỉ admin mới cấp milestone thủ công." }, 403);
      }
    } else {
      return json({ ok: false, message: "Grant chỉ hỗ trợ hackathon hoặc activity_milestone." }, 400);
    }

    const identifierPrefix = String(template.identifier_prefix ?? "").trim();
    const defaultNet = await getDefaultMintNetwork(db);
    const network = resolveMintNetwork(
      template.network_override as string | null | undefined,
      defaultNet as MintNetwork,
    );

    const issuanceIds: string[] = [];
    const errors: string[] = [];

    for (const uid of userIds) {
      const issuerRef = issuerReferenceId(String(template.id), uid);
      const legacyIssuerRef = legacyIssuerReferenceId(identifierPrefix, uid);
      const { data: existing } = await db.from("credential_issuances").select("id, status")
        .in("issuer_reference_id", [issuerRef, legacyIssuerRef])
        .eq("network", network)
        .limit(1)
        .maybeSingle();
      if (existing && (existing.status === "minted" || existing.status === "pending")) {
        errors.push(`${uid}: đã có issuance`);
        continue;
      }

      const { data: inserted, error: insErr } = await db.from("credential_issuances").insert({
        template_id: templateId,
        user_id: uid,
        course_id: scope === "hackathon" ? null : null,
        hackathon_id: scope === "hackathon" ? String(template.hackathon_id) : null,
        issuer_reference_id: issuerRef,
        network,
        status: "pending",
        oc_request_payload: null,
        oc_response: null,
        oc_credential_id: null,
        minted_at: null,
        error_message: null,
        retry_count: 0,
        granted_by: user.id,
        granted_reason: grantedReason,
      }).select("id").maybeSingle();

      if (insErr) {
        if (/duplicate key|unique constraint/i.test(insErr.message)) {
          errors.push(`${uid}: trùng issuance`);
          continue;
        }
        errors.push(`${uid}: ${insErr.message}`);
        continue;
      }

      const iid = inserted?.id != null ? String(inserted.id) : null;
      if (!iid) continue;
      const mintResult = await mintCredentialOnce(db, iid);
      if (!mintResult.ok) {
        errors.push(`${uid}: mint failed (${mintResult.error ?? "unknown"})`);
        continue;
      }
      issuanceIds.push(iid);
    }

    return json({ ok: true, issuanceIds, errors });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ ok: false, message: "Chưa đăng nhập" }, 401);
    console.error("[corelia-api] credentials.grant", e);
    return json({ ok: false, message: "Không thể cấp chứng nhận." }, 500);
  }
}

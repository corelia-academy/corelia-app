import { getUserRole, isAuthFailure } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { sendTransactionalEmailViaResend } from "../lib/mail/resend.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";
import { buildCredentialMintEmail } from "./emails.ts";
import { issuerReferenceId } from "./ids.ts";
import { mintCredentialOnce } from "./mint.ts";
import { resolveMintNetwork } from "./oc_payload.ts";
import { getAppBaseUrl, getDefaultMintNetwork, type MintNetwork } from "./settings.ts";

/** Admin manual mint (activity_milestone scope only) targeting an email instead of
 *  a known userId. Two outcomes:
 *   - The email already has an account (checked fresh here, not trusting the
 *     admin's earlier client-side lookup — the account may have been created in
 *     the gap between lookup and submit): grant + mint directly, same shape as
 *     credentials.grant's per-user loop.
 *   - No account yet: stage the grant in pending_credential_issuances and email
 *     the recipient a claim link. private.handle_new_user() converts the staged
 *     row into a real credential_issuances row the moment that email signs up. */
export async function handleGrantPendingCredential(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const role = await getUserRole(db, user.id);
    if (role !== "admin" && role !== "support_staff") {
      return json({ ok: false, message: "Chỉ admin mới cấp thủ công." }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const templateId = String(body.templateId ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const grantedReason = body.grantedReason != null ? String(body.grantedReason).trim() || null : null;

    if (!templateId) return json({ ok: false, message: "Thiếu templateId" }, 400);
    if (!email || !email.includes("@")) return json({ ok: false, message: "Email không hợp lệ" }, 400);

    const { data: template, error: tplErr } = await db.from("credential_templates").select("*").eq(
      "id",
      templateId,
    ).maybeSingle();
    if (tplErr) throw new Error(tplErr.message);
    if (!template) return json({ ok: false, message: "Không tìm thấy template." }, 404);
    if (!template.is_active) return json({ ok: false, message: "Template chưa active." }, 400);
    if (template.scope_type !== "activity_milestone") {
      return json({ ok: false, message: "Cấp thủ công chỉ hỗ trợ template loại activity_milestone." }, 400);
    }

    const defaultNet = await getDefaultMintNetwork(db);
    const network = resolveMintNetwork(
      template.network_override as string | null | undefined,
      defaultNet as MintNetwork,
    );
    const identifierPrefix = String(template.identifier_prefix ?? "").trim();

    const { data: existingProfile, error: profErr } = await db.from("profiles").select("id").ilike(
      "email",
      email,
    ).maybeSingle();
    if (profErr) throw new Error(profErr.message);

    if (existingProfile?.id) {
      const uid = String(existingProfile.id);
      const issuerRef = issuerReferenceId(identifierPrefix, uid);

      const { data: existing } = await db.from("credential_issuances").select("id, status").eq(
        "issuer_reference_id",
        issuerRef,
      ).eq("network", network).maybeSingle();
      if (existing && (existing.status === "minted" || existing.status === "pending")) {
        return json({ ok: true, mode: "direct", issuanceIds: [], errors: [`${email}: đã có issuance`] });
      }

      const { data: inserted, error: insErr } = await db.from("credential_issuances").insert({
        template_id: templateId,
        user_id: uid,
        course_id: null,
        hackathon_id: null,
        issuer_reference_id: issuerRef,
        network,
        status: "pending",
        granted_by: user.id,
        granted_reason: grantedReason,
      }).select("id").maybeSingle();
      if (insErr) {
        if (/duplicate key|unique constraint/i.test(insErr.message)) {
          return json({ ok: true, mode: "direct", issuanceIds: [], errors: [`${email}: trùng issuance`] });
        }
        throw new Error(insErr.message);
      }
      const iid = inserted?.id != null ? String(inserted.id) : null;
      if (!iid) return json({ ok: false, message: "Không tạo được issuance." }, 500);

      const mintResult = await mintCredentialOnce(db, iid);
      if (!mintResult.ok) {
        return json({
          ok: true,
          mode: "direct",
          issuanceIds: [],
          errors: [`${email}: mint failed (${mintResult.error ?? "unknown"})`],
        });
      }
      return json({ ok: true, mode: "direct", issuanceIds: [iid], errors: [] });
    }

    // No account yet — stage the grant. Re-submitting the same email+template
    // pair (e.g. admin fixes a typo in the reason) updates the staged row instead
    // of erroring, per the table's UNIQUE (email, template_id) constraint.
    const { error: pendErr } = await db.from("pending_credential_issuances").upsert(
      {
        email,
        template_id: templateId,
        network,
        granted_by: user.id,
        granted_reason: grantedReason,
      },
      { onConflict: "email,template_id" },
    );
    if (pendErr) throw new Error(pendErr.message);

    const baseUrl = await getAppBaseUrl(db);
    const claimUrl = `${baseUrl}/claim?email=${encodeURIComponent(email)}`;
    const { subject, html } = buildCredentialMintEmail({
      kind: "pending_claim",
      badgeName: template.name,
      profileUrl: claimUrl,
      imageUrl: template.image_url,
      locale: "vi",
    });
    const mailResult = await sendTransactionalEmailViaResend({ to: [email], subject, html });

    return json({ ok: true, mode: "pending", emailSent: mailResult.sent === true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ ok: false, message: "Chưa đăng nhập" }, 401);
    console.error("[corelia-api] credentials.grantPending", e);
    return json({ ok: false, message: "Không thể cấp chứng nhận." }, 500);
  }
}

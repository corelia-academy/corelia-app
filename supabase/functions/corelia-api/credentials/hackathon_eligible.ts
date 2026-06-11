import { canManageHackathon, isAuthFailure } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";

export type EligibleUser = {
  userId: string;
  displayName: string;
  teamName: string | null;
  hasOcid: boolean;
  issuanceStatus: "none" | "pending" | "minted" | "failed";
  issuanceId: string | null;
};

export async function handleHackathonListEligible(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const hackathonId = String(body.hackathonId ?? "").trim();
    const templateId = String(body.templateId ?? "").trim();

    if (!hackathonId) return json({ ok: false, message: "Thiếu hackathonId" }, 400);
    if (!templateId) return json({ ok: false, message: "Thiếu templateId" }, 400);

    if (!await canManageHackathon(db, user.id, hackathonId)) {
      return json({ ok: false, message: "Không đủ quyền." }, 403);
    }

    const { data: template, error: tplErr } = await db
      .from("credential_templates")
      .select("id, scope_type, hackathon_id")
      .eq("id", templateId)
      .maybeSingle();
    if (tplErr) throw new Error(tplErr.message);
    if (!template) return json({ ok: false, message: "Không tìm thấy template." }, 404);
    if (template.scope_type !== "hackathon" || String(template.hackathon_id) !== hackathonId) {
      return json({ ok: false, message: "Template không thuộc hackathon này." }, 400);
    }

    const { data: regs, error: regsErr } = await db
      .from("hackathon_registrations")
      .select("id, user_id, document")
      .eq("hackathon_id", hackathonId);
    if (regsErr) throw new Error(regsErr.message);

    const approvedRegs = (regs ?? []).filter((r) => {
      const doc = (r.document ?? {}) as Record<string, unknown>;
      return doc.status === "approved";
    });

    if (approvedRegs.length === 0) {
      return json({ ok: true, users: [], summary: { total: 0, minted: 0, pending: 0, none: 0, failed: 0 } });
    }

    const userIds = approvedRegs.map((r) => String(r.user_id));

    const [issuancesRes, profilesRes] = await Promise.all([
      db
        .from("credential_issuances")
        .select("id, user_id, status")
        .eq("template_id", templateId)
        .in("user_id", userIds),
      db
        .from("profiles")
        .select("id, username, full_name, ocid, ocid_eth_address")
        .in("id", userIds),
    ]);

    if (issuancesRes.error) throw new Error(issuancesRes.error.message);
    if (profilesRes.error) throw new Error(profilesRes.error.message);

    const issuanceMap = new Map<string, { id: string; status: string }>();
    for (const iss of issuancesRes.data ?? []) {
      issuanceMap.set(String(iss.user_id), { id: String(iss.id), status: String(iss.status) });
    }

    const profileMap = new Map<string, { username: string; full_name: string; ocid: string | null; ocid_eth_address: string | null }>();
    for (const p of profilesRes.data ?? []) {
      profileMap.set(String(p.id), {
        username: String(p.username ?? ""),
        full_name: String(p.full_name ?? ""),
        ocid: p.ocid ?? null,
        ocid_eth_address: p.ocid_eth_address ?? null,
      });
    }

    const eligibleUsers: EligibleUser[] = approvedRegs.map((r) => {
      const uid = String(r.user_id);
      const profile = profileMap.get(uid);
      const doc = (r.document ?? {}) as Record<string, unknown>;
      const teamName = typeof doc.team_name === "string" ? doc.team_name : null;
      const issuance = issuanceMap.get(uid);

      return {
        userId: uid,
        displayName: profile?.full_name || profile?.username || uid,
        teamName,
        hasOcid: !!(profile?.ocid ?? profile?.ocid_eth_address),
        issuanceStatus: (issuance?.status as EligibleUser["issuanceStatus"]) ?? "none",
        issuanceId: issuance?.id ?? null,
      };
    });

    const summary = {
      total: eligibleUsers.length,
      minted: eligibleUsers.filter((u) => u.issuanceStatus === "minted").length,
      pending: eligibleUsers.filter((u) => u.issuanceStatus === "pending").length,
      failed: eligibleUsers.filter((u) => u.issuanceStatus === "failed").length,
      none: eligibleUsers.filter((u) => u.issuanceStatus === "none").length,
    };

    return json({ ok: true, users: eligibleUsers, summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ ok: false, message: "Chưa đăng nhập" }, 401);
    console.error("[corelia-api] credentials.hackathon.listEligible", e);
    return json({ ok: false, message: "Không thể lấy danh sách." }, 500);
  }
}

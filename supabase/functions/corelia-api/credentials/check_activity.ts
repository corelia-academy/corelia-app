import { getUserRole, isAuthFailure } from "../lib/authz.ts";
import { json, nowIso } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";
import { issuerReferenceId } from "./ids.ts";
import { mintCredentialOnce } from "./mint.ts";
import { getDefaultMintNetwork, type MintNetwork } from "./settings.ts";
import { resolveMintNetwork } from "./oc_payload.ts";

type ActivityRule = {
  event?: string;
  days?: number;
  count?: number;
  track?: string;
  manual?: boolean;
};

export async function handleCheckActivityMilestones(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const targetUserId = String(body.userId ?? user.id).trim();
    const eventType = String(body.eventType ?? "").trim();
    const payload = (body.payload ?? {}) as Record<string, unknown>;

    if (!eventType) return json({ ok: false, message: "Thiếu eventType" }, 400);

    if (targetUserId !== user.id) {
      const role = await getUserRole(db, user.id);
      if (role !== "admin" && role !== "support_staff") {
        return json({ ok: false, message: "Không đủ quyền." }, 403);
      }
    }

    const summary = await runActivityMilestoneCheck(db, targetUserId, eventType, payload);
    return json({ ok: true, ...summary, evaluatedAt: nowIso() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ ok: false, message: "Chưa đăng nhập" }, 401);
    console.error("[corelia-api] credentials.checkActivityMilestones", e);
    return json({ ok: false, message: "Không thể xử lý." }, 500);
  }
}

async function countCompletedCourses(db: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await db.from("enrollments").select("id", { count: "exact", head: true }).eq(
    "user_id",
    userId,
  ).not("certificate_issued_at", "is", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countCompletedCoursesInTrack(
  db: SupabaseClient,
  userId: string,
  trackSlug: string,
): Promise<number> {
  const { data: track, error: tErr } = await db.from("career_tracks").select("id").eq(
    "slug",
    trackSlug,
  ).maybeSingle();
  if (tErr) throw new Error(tErr.message);
  if (!track?.id) return 0;

  const { data: rows, error } = await db.from("career_track_courses").select("course_id").eq(
    "track_id",
    track.id,
  );
  if (error) throw new Error(error.message);
  const ids = (rows ?? []).map((r) => String(r.course_id));
  if (ids.length === 0) return 0;

  const { count, error: cErr } = await db.from("enrollments").select("id", { count: "exact", head: true }).eq(
    "user_id",
    userId,
  ).not("certificate_issued_at", "is", null).in("course_id", ids);
  if (cErr) throw new Error(cErr.message);
  return count ?? 0;
}

async function countProjects(db: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await db.from("projects").select("id", { count: "exact", head: true }).eq(
    "owner_id",
    userId,
  );
  if (error) throw new Error(error.message);
  return count ?? 0;
}

function ruleMatchesEvent(rule: ActivityRule, eventType: string): boolean {
  const ev = String(rule.event ?? "");
  if (ev === eventType) return true;
  if (eventType === "course_completed" && ev === "courses_completed") return true;
  if (eventType === "courses_completed" && ev === "course_completed") return true;
  if (ev === "login_streak" && eventType === "login_streak_updated") return true;
  return false;
}

async function evaluateRule(
  db: SupabaseClient,
  userId: string,
  rule: ActivityRule,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  if (rule.manual === true) return false;
  if (!ruleMatchesEvent(rule, eventType)) return false;

  const ev = String(rule.event ?? "");

  if (ev === "login_streak") {
    const need = Number(rule.days ?? 0);
    const actual = Number(payload.days ?? 0);
    return need > 0 && actual >= need;
  }

  if (ev === "courses_completed" || eventType === "course_completed") {
    const need = Number(rule.count ?? 1);
    const n = await countCompletedCourses(db, userId);
    return n >= need;
  }

  if (ev === "courses_completed_in_track") {
    const need = Number(rule.count ?? 0);
    const track = String(rule.track ?? "").trim();
    if (!track || need <= 0) return false;
    const n = await countCompletedCoursesInTrack(db, userId, track);
    return n >= need;
  }

  if (ev === "projects_submitted") {
    const need = Number(rule.count ?? 1);
    const n = await countProjects(db, userId);
    return n >= need;
  }

  void eventType;
  return false;
}

export async function runActivityMilestoneCheck(
  db: SupabaseClient,
  userId: string,
  eventType: string,
  payload: Record<string, unknown> = {},
): Promise<{ awarded: string[]; skipped: string[] }> {
  const awarded: string[] = [];
  const skipped: string[] = [];

  const { data: templates, error } = await db.from("credential_templates").select("*").eq(
    "scope_type",
    "activity_milestone",
  ).eq("is_active", true).eq("trigger_type", "auto");
  if (error) throw new Error(error.message);

  const defaultNet = await getDefaultMintNetwork(db);

  for (const template of templates ?? []) {
    const rule = (template.trigger_rule ?? {}) as ActivityRule;
    const ok = await evaluateRule(db, userId, rule, eventType, payload);
    if (!ok) continue;

    const identifierPrefix = String(template.identifier_prefix ?? "").trim();
    const network = resolveMintNetwork(
      template.network_override as string | null | undefined,
      defaultNet as MintNetwork,
    );
    const issuerRef = issuerReferenceId(identifierPrefix, userId);

    const { data: existing } = await db.from("credential_issuances").select("id, status").eq(
      "issuer_reference_id",
      issuerRef,
    ).eq("network", network).maybeSingle();
    if (existing && (existing.status === "minted" || existing.status === "pending")) {
      skipped.push(String(template.id));
      continue;
    }

    const { data: inserted, error: insErr } = await db.from("credential_issuances").insert({
      template_id: template.id,
      user_id: userId,
      course_id: null,
      hackathon_id: null,
      issuer_reference_id: issuerRef,
      network,
      status: "pending",
      oc_request_payload: null,
      oc_response: null,
      oc_credential_id: null,
      minted_at: null,
      error_message: null,
      retry_count: 0,
      granted_by: null,
      granted_reason: null,
    }).select("id").maybeSingle();

    if (insErr) {
      if (/duplicate key|unique constraint/i.test(insErr.message)) {
        skipped.push(String(template.id));
        continue;
      }
      throw new Error(insErr.message);
    }

    const issuanceId = inserted?.id != null ? String(inserted.id) : null;
    if (!issuanceId) continue;

    const mintResult = await mintCredentialOnce(db, issuanceId);
    if (!mintResult.ok) {
      skipped.push(String(template.id));
      continue;
    }
    awarded.push(issuanceId);
  }

  return { awarded, skipped };
}

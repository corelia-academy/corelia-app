import { canManageCourse, isAuthFailure } from "../lib/authz.ts";
import { json, nowIso } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";
import { runActivityMilestoneCheck } from "./check_activity.ts";
import { issuerReferenceId } from "./ids.ts";
import { mintCredentialOnce } from "./mint.ts";
import { extractOcCredentialId } from "./oc_response.ts";
import { getDefaultMintNetwork, type MintNetwork } from "./settings.ts";
import { resolveMintNetwork } from "./oc_payload.ts";

type CourseTriggerRule = {
  completion_pct?: number;
  require_assignment_pass?: boolean;
  min_assignment_score?: number;
};

export type CourseCredentialEligibility =
  | { eligible: true }
  | {
    eligible: false;
    reason: string;
    completionPct?: number;
    needPct?: number;
  };

/**
 * Evaluate the same enrollment, payment, completion, and assignment rules
 * used for issuing a course credential without creating an issuance. The
 * achievements endpoint uses this to avoid advertising an OCA before it can
 * actually be claimed.
 */
export async function evaluateCourseCredentialEligibility(
  db: SupabaseClient,
  courseId: string,
  targetUserId: string,
  triggerRule: unknown,
): Promise<CourseCredentialEligibility> {
  const enrollmentId = `${targetUserId}_${courseId}`;
  const [{ data: courseRow, error: courseErr }, { data: enrollment, error: enrErr }] = await Promise.all([
    db.from("courses").select("data").eq("id", courseId).maybeSingle(),
    db.from("enrollments").select("id").eq("id", enrollmentId).maybeSingle(),
  ]);
  if (courseErr) throw new Error(courseErr.message);
  if (enrErr) throw new Error(enrErr.message);
  if (!courseRow || !enrollment) {
    return { eligible: false, reason: "no_enrollment" };
  }

  const course = (courseRow.data ?? {}) as {
    access_model?: string | null;
  };

  if (course.access_model === "free_with_paid_certificate") {
    const accessId = `${targetUserId}_${courseId}`;
    const { data: payAccess, error: payErr } = await db.from("course_payment_access").select(
      "certificate_fee_paid",
    ).eq("id", accessId).maybeSingle();
    if (payErr) throw new Error(payErr.message);
    if (payAccess?.certificate_fee_paid !== true) {
      return { eligible: false, reason: "certificate_fee_unpaid" };
    }
  }

  const { data: readinessRaw, error: readyErr } = await db.rpc("corelia_certificate_readiness", {
    p_course_id: courseId,
    p_user_id: targetUserId,
  });
  if (readyErr) throw new Error(readyErr.message);
  const readiness = readinessRaw as {
    lesson_total?: number;
    completed_distinct?: number;
    final_assignment_required?: boolean;
    final_submission_status?: string | null;
  } | null;

  const lessonTotal = Number(readiness?.lesson_total ?? 0);
  const completedDistinct = Number(readiness?.completed_distinct ?? 0);
  const completionPct =
    lessonTotal > 0 ? Math.min(100, Math.round((completedDistinct / lessonTotal) * 100)) : 0;

  const rule = (triggerRule ?? {}) as CourseTriggerRule;
  const needPct = Number(rule.completion_pct ?? 100);
  if (completionPct < needPct) {
    return { eligible: false, reason: "completion_pct_not_met", completionPct, needPct };
  }

  if (rule.require_assignment_pass === true) {
    const finalAssignmentRequired = readiness?.final_assignment_required === true;
    const status = readiness?.final_submission_status ?? null;
    if (finalAssignmentRequired && status !== "approved") {
      return { eligible: false, reason: "assignment_not_approved" };
    }
    void rule.min_assignment_score;
  }

  return { eligible: true };
}

export async function handleCheckCourseCompletion(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const courseId = String(body.courseId ?? "").trim();
    const targetUserId = String(body.userId ?? user.id).trim();
    const autoIssue = body.autoIssue === true;
    if (!courseId) return json({ ok: false, message: "Thiếu courseId" }, 400);

    if (user.id !== targetUserId) {
      if (!await canManageCourse(db, user.id, courseId)) {
        return json({ ok: false, message: "Không đủ quyền." }, 403);
      }
    }

    const result = await runCourseCredentialCheck(db, courseId, targetUserId, { autoIssue });
    return json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ ok: false, message: "Chưa đăng nhập" }, 401);
    console.error("[corelia-api] credentials.checkCourseCompletion", e);
    return json({ ok: false, message: "Không thể xử lý." }, 500);
  }
}

export async function runCourseCredentialCheck(
  db: SupabaseClient,
  courseId: string,
  targetUserId: string,
  opts?: {
    /** When true (auto-issue on certificate issuance), skip OCA credentials.
     *  OCA must be claimed manually so the learner reviews their name/OCID and
     *  the name-rendered certificate image is generated first. OCB still auto-mints. */
    autoIssue?: boolean;
  },
): Promise<
  Record<string, unknown>
> {
  const { data: template, error: tplErr } = await db.from("credential_templates").select("*").eq(
    "scope_type",
    "course",
  ).eq("course_id", courseId).eq("is_active", true).maybeSingle();
  if (tplErr) throw new Error(tplErr.message);
  if (!template) {
    return { ok: true, skipped: true, reason: "no_active_template" };
  }

  // OCA is never auto-minted. OCB is auto-minted after the learner satisfies
  // the course rules, including when the course also issues a PDF certificate.
  const isOCA = !template.collection_symbol;
  if (opts?.autoIssue && isOCA) {
    return { ok: true, skipped: true, reason: "oca_requires_manual_claim" };
  }

  const eligibility = await evaluateCourseCredentialEligibility(
    db,
    courseId,
    targetUserId,
    template.trigger_rule,
  );
  if (!eligibility.eligible) {
    return { ok: true, skipped: true, ...eligibility };
  }

  const identifierPrefix = String(template.identifier_prefix ?? "").trim();
  const defaultNet = await getDefaultMintNetwork(db);
  const network = resolveMintNetwork(
    template.network_override as string | null | undefined,
    defaultNet as MintNetwork,
  );
  const issuerRef = issuerReferenceId(identifierPrefix, targetUserId);

  const { data: existing } = await db.from("credential_issuances").select(
    "id, status, retry_count, oc_credential_id, oc_response",
  ).eq(
    "issuer_reference_id",
    issuerRef,
  ).eq("network", network).maybeSingle();
  if (existing) {
    if (existing.status === "minted" || existing.status === "pending") {
      // Backfill oc_credential_id for already-minted records that never captured
      // it (e.g. minted before the id-extraction fix). Re-parse the stored response
      // instead of re-calling OC (which would just return a duplicate).
      if (existing.status === "minted" && !existing.oc_credential_id && existing.oc_response) {
        const backfilled = extractOcCredentialId(existing.oc_response);
        if (backfilled) {
          await db.from("credential_issuances").update({ oc_credential_id: backfilled }).eq("id", existing.id);
          return { ok: true, issuanceId: existing.id, status: "minted", minted: true, skipped: false };
        }
      }
      return { ok: true, skipped: true, reason: "already_issued_or_pending", issuanceId: existing.id };
    }
    // status === "failed" or "awaiting_holder_id" — reset and retry
    const { error: resetErr } = await db.from("credential_issuances").update({
      status: "pending",
      error_message: null,
      oc_request_payload: null,
      oc_response: null,
      retry_count: Number(existing.retry_count ?? 0) + 1,
    }).eq("id", existing.id);
    if (resetErr) throw new Error(resetErr.message);
    await mintCredentialOnce(db, existing.id);
    const { data: after } = await db.from("credential_issuances").select("status").eq("id", existing.id).maybeSingle();
    return {
      ok: true,
      issuanceId: existing.id,
      status: after?.status ?? "unknown",
      minted: after?.status === "minted",
      skipped: false,
    };
  }

  const { data: inserted, error: insErr } = await db.from("credential_issuances").insert({
    template_id: template.id,
    user_id: targetUserId,
    course_id: courseId,
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
      return { ok: true, skipped: true, reason: "duplicate_issuance" };
    }
    throw new Error(insErr.message);
  }
  const issuanceId = inserted?.id != null ? String(inserted.id) : null;
  if (!issuanceId) {
    return { ok: false, message: "Không tạo được issuance." };
  }

  await mintCredentialOnce(db, issuanceId);

  try {
    await runActivityMilestoneCheck(db, targetUserId, "courses_completed", { course_id: courseId });
  } catch (actErr) {
    console.error("[corelia-api] activity milestone after course credential", actErr);
  }

  const { data: after } = await db.from("credential_issuances").select("status").eq("id", issuanceId).maybeSingle();
  return {
    ok: true,
    issuanceId,
    status: after?.status ?? "unknown",
    minted: after?.status === "minted",
    skipped: false,
    evaluatedAt: nowIso(),
  };
}

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

type Readiness = {
  lesson_total?: number;
  completed_distinct?: number;
  all_lessons_complete?: boolean;
  final_assignment_required?: boolean;
  final_submission_status?: string | null;
} | null;

type CredentialTemplateRow = {
  id: string;
  collection_symbol: string | null;
  trigger_rule: unknown;
  network_override: string | null;
  identifier_prefix: string | null;
};

/** Evaluate + (if eligible) issue a single active template. A course can have
 *  both an OCA and an OCB template active at once (separate partial unique
 *  indexes per kind), so this runs once per template instead of assuming one
 *  template per course. */
async function evaluateTemplate(
  db: SupabaseClient,
  template: CredentialTemplateRow,
  ctx: {
    courseId: string;
    targetUserId: string;
    completionPct: number;
    readiness: Readiness;
    autoIssue?: boolean;
  },
): Promise<Record<string, unknown>> {
  const { courseId, targetUserId, completionPct, readiness } = ctx;

  // OCA (collection_symbol null) is never auto-minted — it requires a manual
  // claim so the learner-name-rendered certificate is produced and reviewed.
  const isOCA = !template.collection_symbol;
  if (ctx.autoIssue && isOCA) {
    return { ok: true, skipped: true, reason: "oca_requires_manual_claim", templateId: template.id };
  }

  const rule = (template.trigger_rule ?? {}) as CourseTriggerRule;
  const needPct = Number(rule.completion_pct ?? 100);
  if (completionPct < needPct) {
    return {
      ok: true,
      skipped: true,
      reason: "completion_pct_not_met",
      completionPct,
      needPct,
      templateId: template.id,
    };
  }

  if (rule.require_assignment_pass === true) {
    const faRequired = readiness?.final_assignment_required === true;
    const status = readiness?.final_submission_status ?? null;
    if (faRequired && status !== "approved") {
      return { ok: true, skipped: true, reason: "assignment_not_approved", templateId: template.id };
    }
    void rule.min_assignment_score;
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
          return {
            ok: true,
            issuanceId: existing.id,
            status: "minted",
            minted: true,
            skipped: false,
            templateId: template.id,
          };
        }
      }
      return {
        ok: true,
        skipped: true,
        reason: "already_issued_or_pending",
        issuanceId: existing.id,
        templateId: template.id,
      };
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
      templateId: template.id,
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
      return { ok: true, skipped: true, reason: "duplicate_issuance", templateId: template.id };
    }
    throw new Error(insErr.message);
  }
  const issuanceId = inserted?.id != null ? String(inserted.id) : null;
  if (!issuanceId) {
    return { ok: false, message: "Không tạo được issuance.", templateId: template.id };
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
    templateId: template.id,
    evaluatedAt: nowIso(),
  };
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
  // A course can have an active OCA template and an active OCB template at
  // the same time (see credential_templates_unique_active_course_{oca,ocb}_idx),
  // so this fetches every active row rather than assuming a single template.
  const { data: templates, error: tplErr } = await db.from("credential_templates").select("*").eq(
    "scope_type",
    "course",
  ).eq("course_id", courseId).eq("is_active", true);
  if (tplErr) throw new Error(tplErr.message);
  if (!templates || templates.length === 0) {
    return { ok: true, skipped: true, reason: "no_active_template" };
  }

  const enrollmentId = `${targetUserId}_${courseId}`;
  const [{ data: courseRow, error: courseErr }, { data: enrollment, error: enrErr }] = await Promise.all([
    db.from("courses").select("data").eq("id", courseId).maybeSingle(),
    db.from("enrollments").select("*").eq("id", enrollmentId).maybeSingle(),
  ]);
  if (courseErr) throw new Error(courseErr.message);
  if (enrErr) throw new Error(enrErr.message);
  if (!courseRow || !enrollment) {
    return { ok: true, skipped: true, reason: "no_enrollment" };
  }

  const course = (courseRow.data ?? {}) as {
    access_model?: string | null;
    final_assignment_title?: string | null;
  };

  if (course.access_model === "free_with_paid_certificate") {
    const accessId = `${targetUserId}_${courseId}`;
    const { data: payAccess, error: payErr } = await db.from("course_payment_access").select(
      "certificate_fee_paid",
    ).eq("id", accessId).maybeSingle();
    if (payErr) throw new Error(payErr.message);
    if (payAccess?.certificate_fee_paid !== true) {
      return { ok: true, skipped: true, reason: "certificate_fee_unpaid" };
    }
  }

  const { data: readinessRaw, error: readyErr } = await db.rpc("corelia_certificate_readiness", {
    p_course_id: courseId,
    p_user_id: targetUserId,
  });
  if (readyErr) throw new Error(readyErr.message);
  const readiness = readinessRaw as Readiness;

  const lessonTotal = Number(readiness?.lesson_total ?? 0);
  const completedDistinct = Number(readiness?.completed_distinct ?? 0);
  const completionPct =
    lessonTotal > 0 ? Math.min(100, Math.round((completedDistinct / lessonTotal) * 100)) : 0;

  const results: Record<string, unknown>[] = [];
  for (const template of templates) {
    results.push(
      await evaluateTemplate(db, template, {
        courseId,
        targetUserId,
        completionPct,
        readiness,
        autoIssue: opts?.autoIssue,
      }),
    );
  }

  return { ok: true, results };
}

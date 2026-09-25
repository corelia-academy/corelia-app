import { isAuthFailure, canManageCourse, getUserRole } from "../lib/authz.ts";
import { json, nowIso } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";
import { runCourseCredentialCheck } from "../credentials/check_course.ts";
import { getAppBaseUrl } from "../credentials/settings.ts";
import { sendTransactionalEmailViaResend } from "../lib/mail/resend.ts";
import { syncCourseCompletionIfReady } from "../courses/completion.ts";
import { buildCertificateIssuedEmail } from "./certificate_emails.ts";
import { resolveRecipientEmailLocale } from "../lib/mail/locale.ts";

type CertificateIssueReason =
  | "no_certificate"
  | "already_issued"
  | "no_course"
  | "no_enrollment"
  | "lessons_incomplete"
  | "assignment_not_approved"
  | "issued";

type CourseCertificateData = {
  final_assignment_title?: string | null;
  has_certificate?: boolean;
  title?: string | null;
  certificate_template_url?: string | null;
};

type CertificateIssueResult = {
  issued: boolean;
  reason: CertificateIssueReason;
  certificate_issued_at?: string | null;
  course_title?: string | null;
};

function courseHasCertificate(course: CourseCertificateData): boolean {
  return course.has_certificate === true || !!course.certificate_template_url?.trim();
}

async function insertCertificateIssuedNotification(
  db: SupabaseClient,
  params: {
    userId: string;
    courseId: string;
    courseTitle: string;
    certificateTemplateUrl?: string | null;
    targetPath: string;
  },
): Promise<void> {
  const { error } = await db.from("user_notifications").insert({
    user_id: params.userId,
    type: "course_certificate_issued",
    payload: {
      course_id: params.courseId,
      course_title: params.courseTitle,
      certificate_template_url: params.certificateTemplateUrl ?? null,
      requires_ocid: true,
      target_path: params.targetPath,
    },
  });
  if (error) throw new Error(error.message);
}

async function runCertificateIssuedSideEffects(
  db: SupabaseClient,
  params: {
    courseId: string;
    targetUserId: string;
    course: CourseCertificateData;
  },
): Promise<void> {
  const { courseId, targetUserId, course } = params;

  // Send congratulatory email (non-fatal).
  try {
    const [{ data: authUser }, { data: profileRow }, { data: certificateRecord }, baseUrl] = await Promise.all([
      db.auth.admin.getUserById(targetUserId),
      db.from("profiles").select("locale").eq("id", targetUserId).maybeSingle(),
      db.from("certificate_records").select("id, code").eq("user_id", targetUserId).eq("course_id", courseId).maybeSingle(),
      getAppBaseUrl(db),
    ]);
    const email = (authUser?.user?.email ?? "").trim();
    const courseTitle = (course.title ?? "").trim();
    const { locale } = resolveRecipientEmailLocale({ recipientKind: "account", profileLocale: profileRow?.locale, authMetadataLocale: authUser?.user?.user_metadata?.locale });
    const certificateUrl = certificateRecord?.code
      ? `${baseUrl}/verify/${encodeURIComponent(String(certificateRecord.code))}`
      : `${baseUrl}/achievements`;
    if (email && courseTitle) {
      const { subject, html } = buildCertificateIssuedEmail({
        courseTitle,
        certificateUrl,
        locale,
      });
      await sendTransactionalEmailViaResend({
        db,
        mailType: "certificate_issued",
        to: [email],
        subject,
        html,
        idempotencyKey: `certificate-issued-${targetUserId}-${courseId}`,
        context: certificateRecord?.id ? { type: "corelia_certificate", id: certificateRecord.id } : undefined,
      });
    }
  } catch (mailErr) {
    console.error("[corelia-api] certificate → email failed (non-fatal)", mailErr);
  }

  // Let learners know the certificate is ready even when OCID minting needs a manual claim.
  // Non-fatal: notification failure must never block certificate issuance.
  try {
    const courseTitle = (course.title ?? "").trim();
    if (courseTitle) {
      const { data: profileRow, error: profileErr } = await db.from("profiles")
        .select("username")
        .eq("id", targetUserId)
        .maybeSingle();
      if (profileErr) throw new Error(profileErr.message);
      const username = typeof profileRow?.username === "string" ? profileRow.username.trim() : "";
      await insertCertificateIssuedNotification(db, {
        userId: targetUserId,
        courseId,
        courseTitle,
        certificateTemplateUrl: course.certificate_template_url ?? null,
        targetPath: username ? `/@${encodeURIComponent(username)}` : "/achievements",
      });
    }
  } catch (notificationErr) {
    console.error("[corelia-api] certificate → notification failed (non-fatal)", notificationErr);
  }

  // Auto-mint OC credential if there's an active credential_template for this course.
  // Non-fatal: OC mint failure must never block certificate issuance.
  try {
    await runCourseCredentialCheck(db, courseId, targetUserId, { autoIssue: true });
  } catch (ocErr) {
    console.error("[corelia-api] certificate → OC mint failed (non-fatal)", ocErr);
  }
}

export async function issueCourseCertificateIfReady(
  db: SupabaseClient,
  params: {
    courseId: string;
    targetUserId: string;
  },
): Promise<CertificateIssueResult> {
  const { courseId, targetUserId } = params;
  const enrollmentId = `${targetUserId}_${courseId}`;
  const [{ data: courseRow, error: courseErr }, { data: enrollment, error: enrErr }] = await Promise.all([
    db.from("courses").select("data").eq("id", courseId).maybeSingle(),
    db.from("enrollments").select("*").eq("id", enrollmentId).maybeSingle(),
  ]);
  if (courseErr) throw new Error(courseErr.message);
  if (enrErr) throw new Error(enrErr.message);
  if (!courseRow) return { issued: false, reason: "no_course" };
  if (!enrollment) return { issued: false, reason: "no_enrollment" };

  const course = (courseRow.data ?? {}) as CourseCertificateData;
  if (!courseHasCertificate(course)) {
    return { issued: false, reason: "no_certificate", course_title: course.title ?? null };
  }
  if (enrollment.certificate_issued_at) {
    return {
      issued: true,
      reason: "already_issued",
      certificate_issued_at: enrollment.certificate_issued_at,
      course_title: course.title ?? null,
    };
  }

  const { data: readinessRaw, error: readyErr } = await db.rpc("corelia_certificate_readiness", {
    p_course_id: courseId,
    p_user_id: targetUserId,
  });
  if (readyErr) throw new Error(readyErr.message);
  const readiness = readinessRaw as {
    all_lessons_complete?: boolean;
    final_assignment_required?: boolean;
    final_submission_status?: string | null;
  } | null;
  if (!readiness?.all_lessons_complete) {
    return { issued: false, reason: "lessons_incomplete", course_title: course.title ?? null };
  }
  try {
    await syncCourseCompletionIfReady(db, { courseId, targetUserId });
  } catch (completionErr) {
    console.error("[corelia-api] certificate → completion sync failed (non-fatal)", completionErr);
  }
  if (readiness.final_assignment_required && readiness.final_submission_status !== "approved") {
    return { issued: false, reason: "assignment_not_approved", course_title: course.title ?? null };
  }

  const issuedAt = nowIso();
  const { data: updatedRows, error: upErr } = await db.from("enrollments")
    .update({ certificate_issued_at: issuedAt })
    .eq("id", enrollmentId)
    .is("certificate_issued_at", null)
    .select("certificate_issued_at");
  if (upErr) throw new Error(upErr.message);

  // Only the request that actually changed the enrollment may send mail and
  // notifications. A second request can have read the same stale null value.
  if (!updatedRows?.length) {
    const { data: latest, error: latestErr } = await db.from("enrollments")
      .select("certificate_issued_at")
      .eq("id", enrollmentId)
      .maybeSingle();
    if (latestErr) throw new Error(latestErr.message);
    return {
      issued: Boolean(latest?.certificate_issued_at),
      reason: latest?.certificate_issued_at ? "already_issued" : "no_enrollment",
      certificate_issued_at: latest?.certificate_issued_at ?? null,
      course_title: course.title ?? null,
    };
  }

  await runCertificateIssuedSideEffects(db, { courseId, targetUserId, course });

  return {
    issued: true,
    reason: "issued",
    certificate_issued_at: updatedRows[0].certificate_issued_at,
    course_title: course.title ?? null,
  };
}

export async function handleIssueCertificate(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const courseId = String(body.courseId ?? "").trim();
    const targetUserId = String(body.userId ?? user.id).trim();
    if (!courseId) return json({ message: "Thiếu courseId", issued: false }, 400);
    if (!targetUserId) return json({ message: "Thiếu userId", issued: false }, 400);
    if (user.id !== targetUserId) {
      if (!await canManageCourse(db, user.id, courseId)) {
        return json({ message: "Không đủ quyền cấp chứng nhận.", issued: false }, 403);
      }
    }
    const result = await issueCourseCertificateIfReady(db, { courseId, targetUserId });
    if (result.reason === "no_course") {
      return json({ message: "Không tìm thấy khoá học.", ...result }, 404);
    }
    if (result.reason === "no_enrollment") {
      return json({ message: "Học viên chưa ghi danh.", ...result }, 400);
    }
    return json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ message: "Chưa đăng nhập", issued: false }, 401);
    console.error("[corelia-api] certificate", e);
    return json({ message: "Không thể cấp chứng nhận.", issued: false }, 500);
  }
}

export async function handleBackfillEligibleCertificates(
  req: Request,
  db: SupabaseClient,
): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const role = await getUserRole(db, user.id);
    if (role !== "admin" && role !== "support_staff") {
      return json({ message: "Không đủ quyền backfill chứng nhận.", ok: false }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const courseId = String(body.courseId ?? "").trim();
    const targetUserId = String(body.userId ?? "").trim();
    const rawLimit = Number(body.limit ?? 50);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 200) : 50;
    const dryRun = body.dryRun !== false;

    let query = db.from("enrollments")
      .select("id,user_id,course_id")
      .is("certificate_issued_at", null)
      .order("last_accessed_at", { ascending: false })
      .limit(limit);
    if (courseId) query = query.eq("course_id", courseId);
    if (targetUserId) query = query.eq("user_id", targetUserId);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const skippedByReason: Record<string, number> = {};
    const errors: Array<{ enrollment_id: string; user_id: string; course_id: string; message: string }> = [];
    let issued = 0;

    for (const row of rows ?? []) {
      const rowUserId = String(row.user_id ?? "");
      const rowCourseId = String(row.course_id ?? "");
      const enrollmentId = String(row.id ?? `${rowUserId}_${rowCourseId}`);
      try {
        if (dryRun) {
          const result = await issueCourseCertificateIfReadyDryRun(db, {
            courseId: rowCourseId,
            targetUserId: rowUserId,
          });
          skippedByReason[result.reason] = (skippedByReason[result.reason] ?? 0) + 1;
          continue;
        }
        const result = await issueCourseCertificateIfReady(db, {
          courseId: rowCourseId,
          targetUserId: rowUserId,
        });
        if (result.reason === "issued") issued++;
        else skippedByReason[result.reason] = (skippedByReason[result.reason] ?? 0) + 1;
      } catch (e) {
        errors.push({
          enrollment_id: enrollmentId,
          user_id: rowUserId,
          course_id: rowCourseId,
          message: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    return json({
      ok: true,
      dryRun,
      scanned: rows?.length ?? 0,
      issued,
      skippedByReason,
      errors,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ message: "Chưa đăng nhập", ok: false }, 401);
    console.error("[corelia-api] certificate backfill", e);
    return json({ message: "Không thể backfill chứng nhận.", ok: false }, 500);
  }
}

async function issueCourseCertificateIfReadyDryRun(
  db: SupabaseClient,
  params: {
    courseId: string;
    targetUserId: string;
  },
): Promise<CertificateIssueResult> {
  const { courseId, targetUserId } = params;
  const enrollmentId = `${targetUserId}_${courseId}`;
  const [{ data: courseRow, error: courseErr }, { data: enrollment, error: enrErr }] = await Promise.all([
    db.from("courses").select("data").eq("id", courseId).maybeSingle(),
    db.from("enrollments").select("*").eq("id", enrollmentId).maybeSingle(),
  ]);
  if (courseErr) throw new Error(courseErr.message);
  if (enrErr) throw new Error(enrErr.message);
  if (!courseRow) return { issued: false, reason: "no_course" };
  if (!enrollment) return { issued: false, reason: "no_enrollment" };

  const course = (courseRow.data ?? {}) as CourseCertificateData;
  if (!courseHasCertificate(course)) return { issued: false, reason: "no_certificate" };
  if (enrollment.certificate_issued_at) {
    return { issued: true, reason: "already_issued", certificate_issued_at: enrollment.certificate_issued_at };
  }
  const { data: readinessRaw, error: readyErr } = await db.rpc("corelia_certificate_readiness", {
    p_course_id: courseId,
    p_user_id: targetUserId,
  });
  if (readyErr) throw new Error(readyErr.message);
  const readiness = readinessRaw as {
    all_lessons_complete?: boolean;
    final_assignment_required?: boolean;
    final_submission_status?: string | null;
  } | null;
  if (!readiness?.all_lessons_complete) return { issued: false, reason: "lessons_incomplete" };
  if (readiness.final_assignment_required && readiness.final_submission_status !== "approved") {
    return { issued: false, reason: "assignment_not_approved" };
  }
  return { issued: true, reason: "issued" };
}

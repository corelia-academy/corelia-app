import { isAuthFailure, canManageCourse } from "../lib/authz.ts";
import { json, nowIso } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";
import { runCourseCredentialCheck } from "../credentials/check_course.ts";
import { getAppBaseUrl } from "../credentials/settings.ts";
import { sendTransactionalEmailViaResend } from "../lib/mail/resend.ts";
import { buildCertificateIssuedEmail } from "./certificate_emails.ts";

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
    const enrollmentId = `${targetUserId}_${courseId}`;
    const [{ data: courseRow, error: courseErr }, { data: enrollment, error: enrErr }] = await Promise.all([
      db.from("courses").select("data").eq("id", courseId).maybeSingle(),
      db.from("enrollments").select("*").eq("id", enrollmentId).maybeSingle(),
    ]);
    if (courseErr) throw new Error(courseErr.message);
    if (enrErr) throw new Error(enrErr.message);
    if (!courseRow) return json({ message: "Không tìm thấy khoá học.", issued: false }, 404);
    if (!enrollment) return json({ message: "Học viên chưa ghi danh.", issued: false }, 400);
    const course = (courseRow.data ?? {}) as {
      access_model?: string | null;
      final_assignment_title?: string | null;
      has_certificate?: boolean;
      title?: string | null;
      certificate_template_url?: string | null;
    };
    if (!course.has_certificate) return json({ issued: false });
    if (enrollment.certificate_issued_at) {
      return json({ issued: true, certificate_issued_at: enrollment.certificate_issued_at });
    }
    if (course.access_model === "free_with_paid_certificate") {
      const accessId = `${targetUserId}_${courseId}`;
      const { data: payAccess, error: payErr } = await db.from("course_payment_access").select(
        "certificate_fee_paid",
      ).eq("id", accessId).maybeSingle();
      if (payErr) throw new Error(payErr.message);
      if (payAccess?.certificate_fee_paid !== true) return json({ issued: false });
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
    if (!readiness?.all_lessons_complete) return json({ issued: false });
    if (readiness.final_assignment_required && readiness.final_submission_status !== "approved") {
      return json({ issued: false });
    }
    const issuedAt = nowIso();
    const { error: upErr } = await db.from("enrollments").update({ certificate_issued_at: issuedAt }).eq(
      "id",
      enrollmentId,
    );
    if (upErr) throw new Error(upErr.message);

    // Send congratulatory email (non-fatal).
    try {
      const [{ data: authUser }, { data: profileRow }, baseUrl] = await Promise.all([
        db.auth.admin.getUserById(targetUserId),
        db.from("profiles").select("full_name, username").eq("id", targetUserId).maybeSingle(),
        getAppBaseUrl(db),
      ]);
      const email = (authUser?.user?.email ?? "").trim();
      const courseTitle = (course.title ?? "").trim();
      const locale = (authUser?.user?.user_metadata?.locale as string | undefined) ?? "vi";
      const profilePath = profileRow?.username
        ? `/u/${encodeURIComponent(String(profileRow.username))}`
        : `/account`;
      const profileUrl = `${baseUrl}${profilePath}`;
      if (email && courseTitle) {
        const { subject, html } = buildCertificateIssuedEmail({
          courseTitle,
          certImageUrl: course.certificate_template_url ?? null,
          profileUrl,
          locale,
        });
        await sendTransactionalEmailViaResend({ to: [email], subject, html });
      }
    } catch (mailErr) {
      console.error("[corelia-api] certificate → email failed (non-fatal)", mailErr);
    }

    // Auto-mint OC credential if there's an active credential_template for this course.
    // Non-fatal: OC mint failure must never block certificate issuance.
    try {
      await runCourseCredentialCheck(db, courseId, targetUserId);
    } catch (ocErr) {
      console.error("[corelia-api] certificate → OC mint failed (non-fatal)", ocErr);
    }

    return json({ issued: true, certificate_issued_at: issuedAt });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ message: "Chưa đăng nhập", issued: false }, 401);
    console.error("[corelia-api] certificate", e);
    return json({ message: "Không thể cấp chứng nhận.", issued: false }, 500);
  }
}

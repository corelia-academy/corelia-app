import { canManageCourse, isAuthFailure } from "../lib/authz.ts";
import { json, nowIso } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";

type CourseCompletionReason =
  | "completed"
  | "already_completed"
  | "no_course"
  | "no_enrollment"
  | "lessons_incomplete";

type CourseCompletionResult = {
  ok: boolean;
  completed: boolean;
  reason: CourseCompletionReason;
  completed_at?: string | null;
  course_title?: string | null;
  has_certificate?: boolean;
  lesson_total?: number;
  completed_distinct?: number;
};

type CourseCompletionData = {
  has_certificate?: boolean;
  title?: string | null;
  certificate_template_url?: string | null;
};

function courseHasCertificate(course: CourseCompletionData): boolean {
  return course.has_certificate === true || !!course.certificate_template_url?.trim();
}

async function insertCourseCompletedNotification(
  db: SupabaseClient,
  params: {
    userId: string;
    courseId: string;
    courseTitle: string;
    hasCertificate: boolean;
    targetPath: string;
  },
): Promise<void> {
  const { error } = await db.from("user_notifications").insert({
    user_id: params.userId,
    type: "course_completed",
    payload: {
      course_id: params.courseId,
      course_title: params.courseTitle,
      has_certificate: params.hasCertificate,
      target_path: params.targetPath,
    },
  });
  if (error) throw new Error(error.message);
}

export async function syncCourseCompletionIfReady(
  db: SupabaseClient,
  params: {
    courseId: string;
    targetUserId: string;
  },
): Promise<CourseCompletionResult> {
  const { courseId, targetUserId } = params;
  const enrollmentId = `${targetUserId}_${courseId}`;
  const [{ data: courseRow, error: courseErr }, { data: enrollment, error: enrErr }] = await Promise.all([
    db.from("courses").select("data").eq("id", courseId).maybeSingle(),
    db.from("enrollments").select("*").eq("id", enrollmentId).maybeSingle(),
  ]);
  if (courseErr) throw new Error(courseErr.message);
  if (enrErr) throw new Error(enrErr.message);
  if (!courseRow) return { ok: true, completed: false, reason: "no_course" };
  if (!enrollment) return { ok: true, completed: false, reason: "no_enrollment" };

  const course = (courseRow.data ?? {}) as CourseCompletionData;
  const courseTitle = course.title ?? null;
  const hasCertificate = courseHasCertificate(course);

  if (enrollment.completed_at) {
    return {
      ok: true,
      completed: true,
      reason: "already_completed",
      completed_at: enrollment.completed_at,
      course_title: courseTitle,
      has_certificate: hasCertificate,
    };
  }

  const { data: readinessRaw, error: readyErr } = await db.rpc("corelia_certificate_readiness", {
    p_course_id: courseId,
    p_user_id: targetUserId,
  });
  if (readyErr) throw new Error(readyErr.message);
  const readiness = readinessRaw as {
    lesson_total?: number;
    completed_distinct?: number;
    all_lessons_complete?: boolean;
  } | null;
  const lessonTotal = Number(readiness?.lesson_total ?? 0);
  const completedDistinct = Number(readiness?.completed_distinct ?? 0);
  if (lessonTotal <= 0 || !readiness?.all_lessons_complete) {
    return {
      ok: true,
      completed: false,
      reason: "lessons_incomplete",
      course_title: courseTitle,
      has_certificate: hasCertificate,
      lesson_total: lessonTotal,
      completed_distinct: completedDistinct,
    };
  }

  const completedAt = nowIso();
  const { data: updatedRows, error: updateErr } = await db.from("enrollments")
    .update({ completed_at: completedAt })
    .eq("id", enrollmentId)
    .is("completed_at", null)
    .select("completed_at");
  if (updateErr) throw new Error(updateErr.message);

  const updatedAt = updatedRows?.[0]?.completed_at ?? null;
  if (!updatedAt) {
    const { data: latest, error: latestErr } = await db.from("enrollments")
      .select("completed_at")
      .eq("id", enrollmentId)
      .maybeSingle();
    if (latestErr) throw new Error(latestErr.message);
    return {
      ok: true,
      completed: Boolean(latest?.completed_at),
      reason: latest?.completed_at ? "already_completed" : "lessons_incomplete",
      completed_at: latest?.completed_at ?? null,
      course_title: courseTitle,
      has_certificate: hasCertificate,
      lesson_total: lessonTotal,
      completed_distinct: completedDistinct,
    };
  }

  try {
    const { data: profileRow, error: profileErr } = await db.from("profiles")
      .select("username")
      .eq("id", targetUserId)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);
    const username = typeof profileRow?.username === "string" ? profileRow.username.trim() : "";
    const title = (courseTitle ?? "").trim();
    if (title) {
      await insertCourseCompletedNotification(db, {
        userId: targetUserId,
        courseId,
        courseTitle: title,
        hasCertificate,
        targetPath: username ? `/@${encodeURIComponent(username)}` : "/achievements",
      });
    }
  } catch (notificationErr) {
    console.error("[corelia-api] completion → notification failed (non-fatal)", notificationErr);
  }

  return {
    ok: true,
    completed: true,
    reason: "completed",
    completed_at: updatedAt,
    course_title: courseTitle,
    has_certificate: hasCertificate,
    lesson_total: lessonTotal,
    completed_distinct: completedDistinct,
  };
}

export async function handleSyncCourseCompletion(req: Request, db: SupabaseClient): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const courseId = String(body.courseId ?? "").trim();
    const targetUserId = String(body.userId ?? user.id).trim();
    if (!courseId) return json({ ok: false, completed: false, message: "Thiếu courseId" }, 400);
    if (!targetUserId) return json({ ok: false, completed: false, message: "Thiếu userId" }, 400);

    if (user.id !== targetUserId) {
      if (!await canManageCourse(db, user.id, courseId)) {
        return json({ ok: false, completed: false, message: "Không đủ quyền." }, 403);
      }
    }

    const result = await syncCourseCompletionIfReady(db, { courseId, targetUserId });
    if (result.reason === "no_course") {
      return json({ message: "Không tìm thấy khoá học.", ...result }, 404);
    }
    if (result.reason === "no_enrollment") {
      return json({ message: "Học viên chưa ghi danh.", ...result }, 400);
    }
    return json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ message: "Chưa đăng nhập", ok: false, completed: false }, 401);
    console.error("[corelia-api] courses.syncCompletion", e);
    return json({ message: "Không thể đồng bộ hoàn thành khoá học.", ok: false, completed: false }, 500);
  }
}

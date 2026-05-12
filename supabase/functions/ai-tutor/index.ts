import { corsHeadersForRequest, json, withCors } from "./lib/http.ts";
import { encodeSse, sseHeaders } from "./lib/sse.ts";
import { streamProviderText } from "./provider.ts";
import { createServiceClient, type SupabaseClient, verifyBearerUser } from "./lib/supabase.ts";
import type { QuotaResult } from "./types.ts";

type BackendContextType =
  | "lesson"
  | "dashboard"
  | "course_discovery"
  | "career"
  | "activity"
  | "profile_review"
  | "global";

type Tier = "free" | "student" | "pro" | "bootcamp";

type TutorRequest = {
  message?: unknown;
  assistantContext?: unknown;
  sessionId?: unknown;
  lessonId?: unknown;
  stream?: unknown;
};

type ProfileRow = {
  full_name: string | null;
  tier: Tier | null;
  user_level: string | null;
  user_goal: string | null;
  streak_days: number | null;
  track_interest: string | null;
  category_interests: string[] | null;
};

type LessonContextData = {
  courseTitle: string;
  lessonTitle: string;
  lessonDescription: string | null;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
};

type CourseDiscoveryContextData = {
  enrolledCount: number;
  recentCourseTitles: string[];
  goal: string | null;
  trackInterest: string | null;
  categoryInterests: string[];
};

type CareerContextData = {
  trackTitles: string[];
  currentLevel: string | null;
  trackInterest: string | null;
};

type ActivityContextData = {
  hackathonTitles: string[];
  projectTitles: string[];
};

type ProfileReviewContextData = {
  enrolledCoursesCount: number;
  completedCoursesCount: number;
  credentialCount: number;
  aiQuestionCount: number;
  publicProjectCount: number;
};

function mapAssistantContext(assistantContext: string): BackendContextType {
  switch (assistantContext) {
    case "home":
      return "dashboard";
    case "courses":
    case "search":
      return "course_discovery";
    case "career":
      return "career";
    case "hackathons":
    case "projects":
      return "activity";
    case "achievements":
    case "profile":
    case "account":
      return "profile_review";
    case "lesson":
      return "lesson";
    default:
      return "global";
  }
}

function parseRequest(body: TutorRequest): {
  message: string;
  assistantContext: string;
  lessonId: string | null;
  sessionId: string | null;
  stream: boolean;
} {
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const assistantContext =
    typeof body.assistantContext === "string" ? body.assistantContext.trim() : "default";
  const lessonId = typeof body.lessonId === "string" && body.lessonId.trim() ? body.lessonId.trim() : null;
  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.trim() ? body.sessionId.trim() : null;
  const stream = body.stream !== false;
  return { message, assistantContext, lessonId, sessionId, stream };
}

function monthKey(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function getProfile(db: SupabaseClient, userId: string): Promise<ProfileRow | null> {
  const { data, error } = await db
    .from("profiles")
    .select("full_name,tier,user_level,user_goal,streak_days,track_interest,category_interests")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

async function ensureSession(
  db: SupabaseClient,
  userId: string,
  contextType: BackendContextType,
  sessionId: string | null,
): Promise<string | null> {
  if (contextType === "lesson") return null;
  if (sessionId) {
    const { data, error } = await db
      .from("ai_chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .eq("context_type", contextType)
      .maybeSingle<{ id: string }>();
    if (error) throw new Error(error.message);
    if (!data?.id) throw new Error("Invalid AI session");
    return data.id;
  }
  const { data, error } = await db
    .from("ai_chat_sessions")
    .insert({ user_id: userId, context_type: contextType, title: null })
    .select("id")
    .single<{ id: string }>();
  if (error || !data?.id) throw new Error(error?.message ?? "Could not create AI session");
  return data.id;
}

async function checkQuota(
  db: SupabaseClient,
  userId: string,
  tier: Tier,
): Promise<QuotaResult> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const month = monthKey(now);

  const [{ data: daily }, { data: monthly }, { data: limits, error: limitsError }] = await Promise.all([
    db.from("ai_usage_daily").select("message_count").eq("user_id", userId).eq("date", today).maybeSingle(),
    db.from("ai_usage_monthly").select("message_count").eq("user_id", userId).eq("month", month).maybeSingle(),
    db
      .from("tier_limits")
      .select("monthly_messages,daily_soft_cap,haiku_only")
      .eq("tier", tier)
      .maybeSingle<{ monthly_messages: number | null; daily_soft_cap: number | null; haiku_only: boolean | null }>(),
  ]);

  if (limitsError) throw new Error(limitsError.message);

  const monthlyUsed = Number(monthly?.message_count ?? 0);
  const dailyUsed = Number(daily?.message_count ?? 0);
  const monthlyLimit = limits?.monthly_messages ?? null;
  const dailySoftCap = limits?.daily_soft_cap ?? null;
  const allowed = monthlyLimit == null ? true : monthlyUsed < monthlyLimit;
  const throttled = dailySoftCap == null ? false : dailyUsed >= dailySoftCap;

  return {
    allowed,
    throttled,
    haikuOnly: limits?.haiku_only ?? true,
    monthlyUsed,
    monthlyLimit,
    dailyUsed,
    dailySoftCap,
    tier,
  };
}

async function enforceAbuseChecks(
  db: SupabaseClient,
  userId: string,
  message: string,
  contextType: BackendContextType,
  lessonId: string | null,
  sessionId: string | null,
): Promise<{ cachedResponse?: { content: string; sessionId: string | null } }> {
  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: burstCount, error: burstError } = await db
    .from("ai_conversations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "user")
    .gte("created_at", minuteAgo);
  if (burstError) throw new Error(burstError.message);
  if ((burstCount ?? 0) >= 10) throw new Error("Rate limit exceeded");

  const { count: pendingCount, error: pendingError } = await db
    .from("ai_conversations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "assistant")
    .eq("status", "pending");
  if (pendingError) throw new Error(pendingError.message);
  if ((pendingCount ?? 0) >= 2) throw new Error("Too many concurrent AI requests");

  const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
  let query = db
    .from("ai_conversations")
    .select("id,content,created_at")
    .eq("user_id", userId)
    .eq("role", "user")
    .eq("context_type", contextType)
    .eq("content", message)
    .gte("created_at", tenSecondsAgo)
    .order("created_at", { ascending: false })
    .limit(1);
  query = lessonId ? query.eq("lesson_id", lessonId) : query.eq("session_id", sessionId ?? "");
  const { data: recentMessage, error: dedupeError } = await query.maybeSingle<{
    id: string;
    content: string;
    created_at: string;
  }>();
  if (dedupeError) throw new Error(dedupeError.message);

  if (!recentMessage) return {};

  let replyQuery = db
    .from("ai_conversations")
    .select("content,session_id")
    .eq("user_id", userId)
    .eq("role", "assistant")
    .eq("context_type", contextType)
    .gt("created_at", recentMessage.created_at)
    .order("created_at", { ascending: true })
    .limit(1);
  replyQuery = lessonId ? replyQuery.eq("lesson_id", lessonId) : replyQuery.eq("session_id", sessionId ?? "");
  const { data: cachedReply, error: cachedReplyError } = await replyQuery.maybeSingle<{
    content: string;
    session_id: string | null;
  }>();
  if (cachedReplyError) throw new Error(cachedReplyError.message);
  if (!cachedReply?.content) return {};

  return { cachedResponse: { content: cachedReply.content, sessionId: cachedReply.session_id ?? sessionId } };
}

async function loadDashboardContext(db: SupabaseClient, userId: string) {
  const { data: enrollments, error: enrollmentsError } = await db
    .from("enrollments")
    .select("course_id,last_accessed_at")
    .eq("user_id", userId)
    .order("last_accessed_at", { ascending: false })
    .limit(3);
  if (enrollmentsError) throw new Error(enrollmentsError.message);

  const courseIds = Array.from(new Set((enrollments ?? []).map((row) => String(row.course_id ?? ""))).values()).filter(Boolean);
  const [{ data: courses, error: coursesError }, { data: progressRows, error: progressError }, { count: lessonCount, error: lessonCountError }] =
    await Promise.all([
      courseIds.length
        ? db.from("courses").select("id,data").in("id", courseIds)
        : Promise.resolve({ data: [], error: null }),
      courseIds.length
        ? db.from("lesson_progress").select("course_id,completed_at").eq("user_id", userId).in("course_id", courseIds)
        : Promise.resolve({ data: [], error: null }),
      courseIds.length
        ? db.from("course_lessons").select("id", { count: "exact", head: true }).in("course_id", courseIds)
        : Promise.resolve({ count: 0, error: null }),
    ]);
  if (coursesError) throw new Error(coursesError.message);
  if (progressError) throw new Error(progressError.message);
  if (lessonCountError) throw new Error(lessonCountError.message);

  const courseTitles = new Map<string, string>();
  for (const course of courses ?? []) {
    const title = typeof course.data?.title === "string" ? course.data.title : "Course";
    courseTitles.set(String(course.id), title);
  }

  const completedByCourse = new Map<string, number>();
  for (const row of progressRows ?? []) {
    if (!row.completed_at) continue;
    const courseId = String(row.course_id ?? "");
    completedByCourse.set(courseId, (completedByCourse.get(courseId) ?? 0) + 1);
  }

  const activeCourses = (enrollments ?? []).map((row) => {
    const courseId = String(row.course_id ?? "");
    return {
      courseId,
      title: courseTitles.get(courseId) ?? "Course",
      completedLessons: completedByCourse.get(courseId) ?? 0,
    };
  });

  return {
    activeCourses,
    totalLessons: Number(lessonCount ?? 0),
    completedLessons: Array.from(completedByCourse.values()).reduce((sum, value) => sum + value, 0),
  };
}

async function loadLessonContext(
  db: SupabaseClient,
  userId: string,
  lessonId: string,
): Promise<LessonContextData> {
  const { data: lessonRow, error: lessonError } = await db
    .from("course_lessons")
    .select("course_id,data")
    .eq("id", lessonId)
    .maybeSingle<{ course_id: string; data: Record<string, unknown> | null }>();
  if (lessonError) throw new Error(lessonError.message);
  if (!lessonRow?.course_id) throw new Error("Lesson not found");

  const courseId = String(lessonRow.course_id);
  const [{ data: courseRow, error: courseError }, { count: totalLessons, error: lessonCountError }, { data: progressRows, error: progressError }] =
    await Promise.all([
      db.from("courses").select("data").eq("id", courseId).maybeSingle<{ data: Record<string, unknown> | null }>(),
      db.from("course_lessons").select("id", { count: "exact", head: true }).eq("course_id", courseId),
      db.from("lesson_progress").select("lesson_id,completed_at").eq("user_id", userId).eq("course_id", courseId),
    ]);
  if (courseError) throw new Error(courseError.message);
  if (lessonCountError) throw new Error(lessonCountError.message);
  if (progressError) throw new Error(progressError.message);

  const completedLessons = (progressRows ?? []).filter((row) => Boolean(row.completed_at)).length;
  const total = Number(totalLessons ?? 0);
  const progressPercent = total > 0 ? Math.min(100, Math.round((completedLessons / total) * 100)) : 0;

  return {
    courseTitle:
      typeof courseRow?.data?.title === "string" && courseRow.data.title.trim()
        ? courseRow.data.title
        : "Course",
    lessonTitle:
      typeof lessonRow.data?.title === "string" && lessonRow.data.title.trim()
        ? lessonRow.data.title
        : "Lesson",
    lessonDescription:
      typeof lessonRow.data?.description_markdown === "string"
        ? lessonRow.data.description_markdown
        : typeof lessonRow.data?.short_description === "string"
          ? lessonRow.data.short_description
          : null,
    totalLessons: total,
    completedLessons,
    progressPercent,
  };
}

async function loadCourseDiscoveryContext(
  db: SupabaseClient,
  userId: string,
  profile: ProfileRow | null,
): Promise<CourseDiscoveryContextData> {
  const [{ data: enrollments, error: enrollmentsError }, { data: courses, error: coursesError }] =
    await Promise.all([
      db
        .from("enrollments")
        .select("course_id,last_accessed_at")
        .eq("user_id", userId)
        .order("last_accessed_at", { ascending: false })
        .limit(5),
      db
        .from("courses")
        .select("id,data")
        .eq("published", true)
        .order("updated_at", { ascending: false })
        .limit(5),
    ]);
  if (enrollmentsError) throw new Error(enrollmentsError.message);
  if (coursesError) throw new Error(coursesError.message);

  const titles = (courses ?? [])
    .map((row) => (typeof row.data?.title === "string" ? row.data.title.trim() : ""))
    .filter(Boolean);

  return {
    enrolledCount: Number(enrollments?.length ?? 0),
    recentCourseTitles: titles,
    goal: profile?.user_goal?.trim() || null,
    trackInterest: profile?.track_interest?.trim() || null,
    categoryInterests: Array.isArray(profile?.category_interests) ? profile!.category_interests : [],
  };
}

async function loadCareerContext(
  db: SupabaseClient,
  profile: ProfileRow | null,
): Promise<CareerContextData> {
  const { data, error } = await db
    .from("career_tracks")
    .select("title")
    .eq("published", true)
    .order("updated_at", { ascending: false })
    .limit(4);
  if (error) throw new Error(error.message);

  return {
    trackTitles: (data ?? [])
      .map((row) => (typeof row.title === "string" ? row.title.trim() : ""))
      .filter(Boolean),
    currentLevel: profile?.user_level?.trim() || null,
    trackInterest: profile?.track_interest?.trim() || null,
  };
}

async function loadActivityContext(db: SupabaseClient): Promise<ActivityContextData> {
  const [{ data: hackathons, error: hackathonsError }, { data: projects, error: projectsError }] =
    await Promise.all([
      db
        .from("hackathons")
        .select("document")
        .in("status", ["published", "running", "ended"])
        .order("updated_at", { ascending: false })
        .limit(3),
      db
        .from("projects")
        .select("title")
        .eq("visibility", "public")
        .order("updated_at", { ascending: false })
        .limit(3),
    ]);
  if (hackathonsError) throw new Error(hackathonsError.message);
  if (projectsError) throw new Error(projectsError.message);

  return {
    hackathonTitles: (hackathons ?? [])
      .map((row) => (typeof row.document?.title === "string" ? row.document.title.trim() : ""))
      .filter(Boolean),
    projectTitles: (projects ?? [])
      .map((row) => (typeof row.title === "string" ? row.title.trim() : ""))
      .filter(Boolean),
  };
}

async function loadProfileReviewContext(
  db: SupabaseClient,
  userId: string,
): Promise<ProfileReviewContextData> {
  const [
    { data: enrollments, error: enrollmentsError },
    { data: progressRows, error: progressError },
    { count: credentialCount, error: credentialError },
    { count: aiQuestionCount, error: aiQuestionError },
    { count: publicProjectCount, error: projectCountError },
  ] = await Promise.all([
    db.from("enrollments").select("course_id").eq("user_id", userId),
    db.from("lesson_progress").select("course_id,lesson_id,completed_at").eq("user_id", userId),
    db
      .from("credential_issuances")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    db
      .from("ai_conversations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "user"),
    db
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("visibility", "public"),
  ]);
  if (enrollmentsError) throw new Error(enrollmentsError.message);
  if (progressError) throw new Error(progressError.message);
  if (credentialError) throw new Error(credentialError.message);
  if (aiQuestionError) throw new Error(aiQuestionError.message);
  if (projectCountError) throw new Error(projectCountError.message);

  const enrolledCourseIds = Array.from(
    new Set((enrollments ?? []).map((row) => String(row.course_id ?? "")).filter(Boolean)),
  );

  let completedCoursesCount = 0;
  if (enrolledCourseIds.length > 0) {
    const { data: lessons, error: lessonsError } = await db
      .from("course_lessons")
      .select("course_id,id")
      .in("course_id", enrolledCourseIds);
    if (lessonsError) throw new Error(lessonsError.message);

    const totalByCourse = new Map<string, number>();
    for (const row of lessons ?? []) {
      const courseId = String(row.course_id ?? "");
      if (!courseId) continue;
      totalByCourse.set(courseId, (totalByCourse.get(courseId) ?? 0) + 1);
    }

    const completedByCourse = new Map<string, Set<string>>();
    for (const row of progressRows ?? []) {
      if (!row.completed_at) continue;
      const courseId = String(row.course_id ?? "");
      const lessonId = String(row.lesson_id ?? "");
      if (!courseId || !lessonId) continue;
      if (!completedByCourse.has(courseId)) completedByCourse.set(courseId, new Set());
      completedByCourse.get(courseId)!.add(lessonId);
    }

    completedCoursesCount = enrolledCourseIds.filter((courseId) => {
      const total = totalByCourse.get(courseId) ?? 0;
      const completed = completedByCourse.get(courseId)?.size ?? 0;
      return total > 0 && completed >= total;
    }).length;
  }

  return {
    enrolledCoursesCount: enrolledCourseIds.length,
    completedCoursesCount,
    credentialCount: Number(credentialCount ?? 0),
    aiQuestionCount: Number(aiQuestionCount ?? 0),
    publicProjectCount: Number(publicProjectCount ?? 0),
  };
}

async function loadContextData(
  db: SupabaseClient,
  userId: string,
  contextType: BackendContextType,
  profile: ProfileRow | null,
  extras: { lessonId: string | null },
): Promise<Record<string, unknown>> {
  if (contextType === "lesson") {
    if (!extras.lessonId) throw new Error("lessonId is required for lesson context");
    return loadLessonContext(db, userId, extras.lessonId);
  }
  if (contextType === "dashboard") {
    return loadDashboardContext(db, userId);
  }
  if (contextType === "course_discovery") {
    return loadCourseDiscoveryContext(db, userId, profile);
  }
  if (contextType === "career") {
    return loadCareerContext(db, profile);
  }
  if (contextType === "activity") {
    return loadActivityContext(db);
  }
  if (contextType === "profile_review") {
    return loadProfileReviewContext(db, userId);
  }
  return {
    trackInterest: profile?.track_interest ?? null,
    userGoal: profile?.user_goal ?? null,
    categoryInterests: profile?.category_interests ?? [],
  };
}

function buildStubReply(args: {
  profile: ProfileRow | null;
  message: string;
  contextType: BackendContextType;
  contextData: Record<string, unknown>;
  quota: QuotaResult;
}): string {
  const name = args.profile?.full_name?.trim() || "bạn";
  const goal = args.profile?.user_goal?.trim();

  if (args.contextType === "dashboard") {
    const activeCourses = Array.isArray(args.contextData.activeCourses)
      ? (args.contextData.activeCourses as { title: string; completedLessons: number }[])
      : [];
    const lead = activeCourses[0];
    const summary = lead
      ? `Bạn đang học nổi bật ở ${lead.title} với ${lead.completedLessons} bài đã hoàn thành.`
      : "Mình chưa thấy khóa học đang học nổi bật nào trong dashboard của bạn.";
    return [
      `Chào ${name}, mình đã nhận câu hỏi: "${args.message}".`,
      summary,
      goal ? `Mục tiêu hiện tại mình đang bám theo là: ${goal}.` : "Bạn chưa đặt mục tiêu học tập rõ trong hồ sơ, nên mình sẽ ưu tiên gợi ý theo tiến độ gần nhất.",
      args.quota.throttled
        ? "Hôm nay bạn đã chạm ngưỡng nhịp hỏi mềm, nên mình sẽ giữ câu trả lời ngắn và tập trung."
        : "Bước tiếp theo hợp lý là chốt 1 mục tiêu học cho tuần này rồi ưu tiên đúng 1 khóa đang dang dở.",
    ].join("\n\n");
  }

  if (args.contextType === "lesson") {
    const lesson = args.contextData as Partial<LessonContextData>;
    const progressLine =
      typeof lesson.completedLessons === "number" && typeof lesson.totalLessons === "number"
        ? `Bạn đã hoàn thành ${lesson.completedLessons}/${lesson.totalLessons} bài, tương đương khoảng ${lesson.progressPercent ?? 0}% của khoá.`
        : "Mình đang đọc progress hiện tại của bạn trong khoá học này.";
    const lessonDescription =
      typeof lesson.lessonDescription === "string" && lesson.lessonDescription.trim()
        ? `Ngữ cảnh bài học hiện tại: ${lesson.lessonDescription.trim().slice(0, 240)}`
        : "Bài học hiện tại chưa có mô tả dài, nên mình sẽ bám vào tên bài và tiến độ để hỗ trợ.";
    return [
      `Mình đang hỗ trợ bạn ngay trong bài "${lesson.lessonTitle ?? "Bài học hiện tại"}" của khoá "${lesson.courseTitle ?? "khoá học này"}".`,
      progressLine,
      lessonDescription,
      `Câu hỏi bạn vừa gửi là: "${args.message}". Ở lát cắt hiện tại, mình sẽ ưu tiên giải thích sát bài học và gợi ý bước luyện tập tiếp theo thay vì trả lời quá rộng.`,
    ].join("\n\n");
  }

  if (args.contextType === "course_discovery") {
    const context = args.contextData as Partial<CourseDiscoveryContextData>;
    const trackInterest = typeof context.trackInterest === "string" ? context.trackInterest : null;
    const recent = Array.isArray(context.recentCourseTitles) ? context.recentCourseTitles.slice(0, 3) : [];
    return [
      `Mình đã nhận yêu cầu tìm hướng học phù hợp cho ${name}.`,
      trackInterest
        ? `Hiện mình đang ưu tiên theo track bạn quan tâm: ${trackInterest}.`
        : "Bạn chưa chốt track cụ thể, nên mình sẽ giữ lời khuyên theo hướng khám phá an toàn.",
      recent.length > 0
        ? `Trong catalog gần nhất mình đang nhìn thấy các course như: ${recent.join(", ")}.`
        : "Catalog course sẽ được mình dùng rõ hơn khi nối thêm RAG ở bước sau.",
      `Câu hỏi bạn vừa gửi là: "${args.message}". Ở lát cắt đầu này, mình đã lưu được hội thoại và ngữ cảnh; bước tiếp theo sẽ là nối thêm catalog + RAG để gợi ý course cụ thể hơn.`,
    ].join("\n\n");
  }

  if (args.contextType === "career") {
    const context = args.contextData as Partial<CareerContextData>;
    const tracks = Array.isArray(context.trackTitles) ? context.trackTitles.slice(0, 4) : [];
    return [
      `Mình đang hỗ trợ ${name} ở ngữ cảnh định hướng nghề nghiệp.`,
      context.trackInterest
        ? `Track bạn đang quan tâm là: ${context.trackInterest}.`
        : "Bạn vẫn đang ở giai đoạn khám phá track phù hợp.",
      tracks.length > 0
        ? `Các track hiện mình đang thấy trên platform gồm: ${tracks.join(", ")}.`
        : "Mình chưa đọc được danh sách track ở thời điểm này.",
      `Câu hỏi bạn vừa gửi là: "${args.message}". Với lát cắt hiện tại, mình sẽ ưu tiên giúp bạn chọn hướng đi và thứ tự học hợp lý hơn.`,
    ].join("\n\n");
  }

  if (args.contextType === "activity") {
    const context = args.contextData as Partial<ActivityContextData>;
    const hackathons = Array.isArray(context.hackathonTitles) ? context.hackathonTitles.slice(0, 3) : [];
    const projects = Array.isArray(context.projectTitles) ? context.projectTitles.slice(0, 3) : [];
    return [
      `Mình đang hỗ trợ ${name} ở ngữ cảnh hoạt động thực chiến.`,
      hackathons.length > 0
        ? `Một vài hackathon gần đây là: ${hackathons.join(", ")}.`
        : "Mình chưa kéo được danh sách hackathon gần đây.",
      projects.length > 0
        ? `Một vài project public đang nổi bật là: ${projects.join(", ")}.`
        : "Mình chưa kéo được danh sách project public gần đây.",
      `Câu hỏi bạn vừa gửi là: "${args.message}". Trong lát cắt này, mình sẽ ưu tiên ghép hoạt động phù hợp với giai đoạn học hiện tại của bạn.`,
    ].join("\n\n");
  }

  if (args.contextType === "profile_review") {
    const context = args.contextData as Partial<ProfileReviewContextData>;
    return [
      `Mình đang đọc hồ sơ học tập hiện tại của ${name}.`,
      `Bạn đang có khoảng ${context.enrolledCoursesCount ?? 0} khoá đã ghi danh, ${context.completedCoursesCount ?? 0} khoá hoàn thành, ${context.credentialCount ?? 0} credential, và ${context.publicProjectCount ?? 0} project public.`,
      `Bạn đã hỏi Cora khoảng ${context.aiQuestionCount ?? 0} câu cho đến lúc này.`,
      `Câu hỏi bạn vừa gửi là: "${args.message}". Trong lát cắt này, mình sẽ ưu tiên giải thích khoảng trống hồ sơ và bước tiếp theo để profile mạnh hơn.`,
    ].join("\n\n");
  }

  return [
    `Mình đã nhận câu hỏi của ${name}: "${args.message}".`,
    "Phiên bản đầu tiên của Cora hiện đã lưu session, nhận đúng context theo trang, và trả phản hồi theo hồ sơ học tập cơ bản.",
    "Bước tiếp theo trong roadmap là nối provider thật, stream câu trả lời, và thêm RAG theo loại ngữ cảnh.",
  ].join("\n\n");
}

function buildSystemPrompt(
  profile: ProfileRow | null,
  contextType: BackendContextType,
  contextData: Record<string, unknown>,
): string {
  const learnerName = profile?.full_name?.trim() || "Learner";
  const goal = profile?.user_goal?.trim() || "Not specified";
  const level = profile?.user_level?.trim() || "beginner";
  const streak = Number(profile?.streak_days ?? 0);

  return [
    "You are Cora, the AI tutor for Corelia Academy.",
    "Reply in the same language as the user. Be practical, warm, and concise.",
    "Prefer actionable next steps over long theory dumps.",
    `Learner name: ${learnerName}`,
    `Learner level: ${level}`,
    `Learner goal: ${goal}`,
    `Learner streak days: ${streak}`,
    `Context type: ${contextType}`,
    `Context data: ${JSON.stringify(contextData)}`,
  ].join("\n");
}

async function getRecentConversationHistory(
  db: SupabaseClient,
  userId: string,
  contextType: BackendContextType,
  lessonId: string | null,
  sessionId: string | null,
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  let query = db
    .from("ai_conversations")
    .select("role,content,created_at")
    .eq("user_id", userId)
    .eq("context_type", contextType)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(8);
  query = lessonId ? query.eq("lesson_id", lessonId) : query.eq("session_id", sessionId ?? "");

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? [])
    .reverse()
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: String(row.content ?? ""),
    }))
    .filter((row) => row.content.trim().length > 0);
}

async function upsertUsage(db: SupabaseClient, userId: string): Promise<void> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const month = monthKey(now);

  const { data: dailyRow } = await db
    .from("ai_usage_daily")
    .select("id,message_count")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle<{ id: string; message_count: number }>();
  if (dailyRow?.id) {
    const { error } = await db
      .from("ai_usage_daily")
      .update({ message_count: Number(dailyRow.message_count ?? 0) + 1, updated_at: now.toISOString() })
      .eq("id", dailyRow.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db
      .from("ai_usage_daily")
      .insert({ user_id: userId, date: today, message_count: 1 });
    if (error) throw new Error(error.message);
  }

  const { data: monthlyRow } = await db
    .from("ai_usage_monthly")
    .select("id,message_count")
    .eq("user_id", userId)
    .eq("month", month)
    .maybeSingle<{ id: string; message_count: number }>();
  if (monthlyRow?.id) {
    const { error } = await db
      .from("ai_usage_monthly")
      .update({ message_count: Number(monthlyRow.message_count ?? 0) + 1, updated_at: now.toISOString() })
      .eq("id", monthlyRow.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db
      .from("ai_usage_monthly")
      .insert({ user_id: userId, month, message_count: 1 });
    if (error) throw new Error(error.message);
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = corsHeadersForRequest(req);
  if (req.method === "OPTIONS") {
    if (!cors) return json({ message: "Origin not allowed" }, 403);
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return withCors(req, json({ message: "Method not allowed" }, 405));
  }

  try {
    const db = createServiceClient();
    const user = await verifyBearerUser(req, db);
    const body = parseRequest((await req.json().catch(() => ({}))) as TutorRequest);

    if (!body.message) {
      return withCors(req, json({ message: "Message is required" }, 400));
    }
    if (body.message.length > 2000) {
      return withCors(req, json({ message: "Message is too long" }, 400));
    }

    const contextType = mapAssistantContext(body.assistantContext);
    if (contextType === "lesson" && !body.lessonId) {
      return withCors(req, json({ message: "lessonId is required for lesson context" }, 400));
    }

    const profile = await getProfile(db, user.id);
    const tier = profile?.tier ?? "free";
    const quota = await checkQuota(db, user.id, tier);
    if (!quota.allowed) {
      return withCors(
        req,
        json(
          {
            message: "Monthly quota exceeded",
            used: quota.monthlyUsed,
            limit: quota.monthlyLimit,
            tier: quota.tier,
          },
          429,
        ),
      );
    }

    const sessionId = await ensureSession(db, user.id, contextType, body.sessionId);
    const abuseCheck = await enforceAbuseChecks(db, user.id, body.message, contextType, body.lessonId, sessionId);
    if (abuseCheck.cachedResponse) {
      return withCors(
        req,
        json({
          ok: true,
          cached: true,
          sessionId: abuseCheck.cachedResponse.sessionId,
          assistantMessage: {
            role: "assistant",
            content: abuseCheck.cachedResponse.content,
            createdAt: new Date().toISOString(),
          },
          quota,
        }),
      );
    }

    const userInsert = {
      user_id: user.id,
      lesson_id: body.lessonId,
      session_id: sessionId,
      context_type: contextType,
      role: "user",
      content: body.message,
      status: "completed",
    };
    const { error: userMessageError } = await db.from("ai_conversations").insert(userInsert);
    if (userMessageError) throw new Error(userMessageError.message);

    const { data: placeholder, error: placeholderError } = await db
      .from("ai_conversations")
      .insert({
        user_id: user.id,
        lesson_id: body.lessonId,
        session_id: sessionId,
        context_type: contextType,
        role: "assistant",
        content: "",
        status: "pending",
        model_used: quota.haikuOnly || quota.throttled ? "stub-haiku" : "stub-sonnet",
      })
      .select("id")
      .single<{ id: string }>();
    if (placeholderError || !placeholder?.id) throw new Error(placeholderError?.message ?? "Could not create placeholder");

    const contextData = await loadContextData(db, user.id, contextType, profile, {
      lessonId: body.lessonId,
    });
    const fallbackReply = buildStubReply({
      profile,
      message: body.message,
      contextType,
      contextData,
      quota,
    });

    const history = await getRecentConversationHistory(
      db,
      user.id,
      contextType,
      body.lessonId,
      sessionId,
    );
    const systemPrompt = buildSystemPrompt(profile, contextType, contextData);

    if (body.stream) {
      const headers = sseHeaders(req);
      const responseStream = new ReadableStream<Uint8Array>({
        start: async (controller) => {
          const encoder = new TextEncoder();
          const send = (event: "meta" | "delta" | "done" | "error", data: unknown) => {
            controller.enqueue(encoder.encode(encodeSse(event, data)));
          };

          let outputText = "";
          try {
            send("meta", {
              sessionId,
              quota,
              placeholderId: placeholder.id,
            });

            const result = await streamProviderText(
              {
                messages: [
                  { role: "system", content: systemPrompt },
                  ...history.map((message) => ({
                    role: message.role,
                    content: message.content,
                  })),
                ],
                quota,
                fallbackText: fallbackReply,
                contextType,
              },
              {
                onTextDelta: async (delta) => {
                  outputText += delta;
                  send("delta", { text: delta });
                },
              },
            );

            const finalText = outputText.trim() || fallbackReply;
            const nowIso = new Date().toISOString();

            const { error: assistantError } = await db
              .from("ai_conversations")
              .update({
                content: finalText,
                status: "completed",
                complexity: "simple",
                model_used: result.model,
                updated_at: nowIso,
              })
              .eq("id", placeholder.id);
            if (assistantError) throw new Error(assistantError.message);

            if (sessionId) {
              const { data: sessionRow } = await db
                .from("ai_chat_sessions")
                .select("message_count")
                .eq("id", sessionId)
                .maybeSingle<{ message_count: number }>();
              const { error: sessionUpdateError } = await db
                .from("ai_chat_sessions")
                .update({
                  message_count: Number(sessionRow?.message_count ?? 0) + 2,
                  last_message_at: nowIso,
                  updated_at: nowIso,
                })
                .eq("id", sessionId);
              if (sessionUpdateError) throw new Error(sessionUpdateError.message);
            }

            await upsertUsage(db, user.id);

            send("done", {
              sessionId,
              quota,
              model: result.model,
              provider: result.provider,
              createdAt: nowIso,
              fullText: finalText,
            });
            controller.close();
          } catch (streamError) {
            console.error("[ai-tutor] stream failure", streamError);
            await db
              .from("ai_conversations")
              .update({
                content: outputText || fallbackReply,
                status: outputText ? "completed" : "error",
                updated_at: new Date().toISOString(),
              })
              .eq("id", placeholder.id);
            send("error", {
              message:
                streamError instanceof Error ? streamError.message : "Streaming failed",
            });
            controller.close();
          }
        },
      });

      return new Response(responseStream, { status: 200, headers });
    }

    const { error: assistantError } = await db
      .from("ai_conversations")
      .update({
        content: fallbackReply,
        status: "completed",
        complexity: "simple",
        model_used: quota.haikuOnly || quota.throttled ? "stub-haiku" : "stub-sonnet",
        updated_at: new Date().toISOString(),
      })
      .eq("id", placeholder.id);
    if (assistantError) throw new Error(assistantError.message);

    if (sessionId) {
      const { data: sessionRow } = await db
        .from("ai_chat_sessions")
        .select("message_count")
        .eq("id", sessionId)
        .maybeSingle<{ message_count: number }>();
      const { error: sessionUpdateError } = await db
        .from("ai_chat_sessions")
        .update({
          message_count: Number(sessionRow?.message_count ?? 0) + 2,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
      if (sessionUpdateError) throw new Error(sessionUpdateError.message);
    }

    await upsertUsage(db, user.id);

    return withCors(
      req,
      json({
        ok: true,
        cached: false,
        sessionId,
        assistantMessage: {
          role: "assistant",
          content: fallbackReply,
          createdAt: new Date().toISOString(),
        },
        quota,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unhandled server error";
    const status =
      message === "Missing Authorization header" ||
      message === "Invalid Authorization header" ||
      message === "Invalid or expired session" ||
      message === "Email confirmation required"
        ? 401
        : message === "Rate limit exceeded" || message === "Too many concurrent AI requests"
          ? 429
          : 500;
    console.error("[ai-tutor] unhandled", error);
    return withCors(req, json({ message }, status));
  }
});

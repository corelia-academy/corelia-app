import { invokeCheckCourseCredential } from "@/lib/credentialsEdge";
import { coreliaEdgeUrl, supabaseFunctionHeaders } from "@/lib/coreliaEdgeApi";
import { supabase } from "@/lib/supabase";
import { removeUndefinedFields, makeTTLCache } from "@/lib/utils";
import type {
  Course,
  CourseSection,
  CourseLesson,
  Enrollment,
  LessonProgress,
  CourseInsert,
  CourseUpdate,
  CourseSectionInsert,
  CourseLessonInsert,
  CourseLocaleContent,
  CourseSectionLocaleContent,
  CourseLessonLocaleContent,
  SupportedCourseLocale,
  CourseCoInstructorPermissions,
  CourseCoInstructorSnapshot,
} from "@/types/courses";
import type { User } from "@supabase/supabase-js";

const CERTIFICATE_API =
  import.meta.env.VITE_CERTIFICATE_ISSUE_API || coreliaEdgeUrl("certificates.issue");

const LOCALE_CACHE_TTL = 5 * 60 * 1000;
const courseLocaleCache = makeTTLCache<CourseLocaleContent | null>(LOCALE_CACHE_TTL);
const sectionLocaleCache = makeTTLCache<CourseSectionLocaleContent | null>(LOCALE_CACHE_TTL);
const lessonLocaleCache = makeTTLCache<CourseLessonLocaleContent | null>(LOCALE_CACHE_TTL);
const lessonLocaleMapCache = makeTTLCache<Map<string, CourseLessonLocaleContent>>(LOCALE_CACHE_TTL);
const sectionLocaleMapCache = makeTTLCache<Map<string, CourseSectionLocaleContent>>(LOCALE_CACHE_TTL);

const CATALOG_CACHE_TTL = 3 * 60 * 1000;
const publishedCoursesCache = makeTTLCache<Course[]>(CATALOG_CACHE_TTL);
const courseByIdCache = makeTTLCache<Course | null>(CATALOG_CACHE_TTL);
const enrollmentsCache = makeTTLCache<Enrollment[]>(30_000);
const sectionsCache = makeTTLCache<CourseSection[]>(2 * 60 * 1000);
const lessonsCache = makeTTLCache<CourseLesson[]>(2 * 60 * 1000);
const lessonProgressCache = makeTTLCache<LessonProgress[]>(30_000);

type CourseRow = {
  id: string;
  instructor_id: string;
  published: boolean;
  slug: string;
  updated_at: string;
  created_at: string;
  data: Record<string, unknown> | null;
};

/** Columns needed for `rowToCourse` (avoid `select("*")` on hot list paths). */
const COURSE_ROW_SELECT =
  "id,instructor_id,published,slug,updated_at,created_at,data" as const;

function rowToCourse(row: CourseRow): Course {
  return {
    ...(row.data ?? {}),
    id: row.id,
    instructor_id: row.instructor_id,
    published: row.published,
    slug: row.slug,
    updated_at: row.updated_at,
    created_at: row.created_at,
  } as Course;
}

function sectionRowToSection(
  _courseId: string,
  row: { id: string; sort_order: number; data: Record<string, unknown> | null },
): CourseSection {
  const d = row.data ?? {};
  return {
    ...d,
    id: row.id,
    order: row.sort_order,
    title: (d.title as string) ?? "",
  } as CourseSection;
}

function lessonRowToLesson(
  row: {
    id: string;
    section_id: string;
    sort_order: number;
    data: Record<string, unknown> | null;
  },
): CourseLesson {
  const d = row.data ?? {};
  return {
    ...d,
    id: row.id,
    section_id: row.section_id,
    order: row.sort_order,
    title: (d.title as string) ?? "",
  } as CourseLesson;
}

export function normalizeCourseLocale(input?: string | null): SupportedCourseLocale {
  return input === "en" ? "en" : "vi";
}

export function clearCourseLocaleCaches(courseId?: string): void {
  if (!courseId) {
    courseLocaleCache.clear();
    sectionLocaleCache.clear();
    lessonLocaleCache.clear();
    return;
  }
  for (const key of Array.from(courseLocaleCache.keys())) {
    if (key.startsWith(`${courseId}:`)) courseLocaleCache.delete(key);
  }
  for (const key of Array.from(sectionLocaleCache.keys())) {
    if (key.startsWith(`${courseId}:`)) sectionLocaleCache.delete(key);
  }
  for (const key of Array.from(lessonLocaleCache.keys())) {
    if (key.startsWith(`${courseId}:`)) lessonLocaleCache.delete(key);
  }
}

export function getCoursePrimaryLocale(course?: Pick<Course, "i18n"> | null): SupportedCourseLocale {
  const primary = course?.i18n?.primary_content_locale;
  return normalizeCourseLocale(primary);
}

export function getCourseSupportedLocales(course?: Pick<Course, "i18n"> | null): SupportedCourseLocale[] {
  const list = course?.i18n?.supported_locales;
  const fallback: SupportedCourseLocale[] = ["vi", "en"];
  const supported: SupportedCourseLocale[] =
    Array.isArray(list) && list.length ? list.map(normalizeCourseLocale) : fallback;
  return Array.from(new Set<SupportedCourseLocale>(supported));
}

export function pickCourseContentLocale(
  course: Pick<Course, "i18n"> | null,
  uiLocale?: string | null,
): SupportedCourseLocale {
  const preferred = normalizeCourseLocale(uiLocale);
  const supported = getCourseSupportedLocales(course);
  if (supported.includes(preferred)) return preferred;
  return getCoursePrimaryLocale(course);
}

export function applyCourseLocaleContent(course: Course, localized: CourseLocaleContent | null): Course {
  if (!localized) return course;
  return {
    ...course,
    title: localized.title ?? course.title,
    slug: localized.slug ?? course.slug,
    description: localized.description ?? course.description,
    short_description: localized.short_description ?? course.short_description,
    learning_outcomes: localized.learning_outcomes ?? course.learning_outcomes,
    final_assignment_title: localized.final_assignment_title ?? course.final_assignment_title,
    final_assignment_description: localized.final_assignment_description ?? course.final_assignment_description,
    final_assignment_instructions: localized.final_assignment_instructions ?? course.final_assignment_instructions,
  };
}

export function applyCourseSectionLocaleContent(
  section: CourseSection,
  localized: CourseSectionLocaleContent | null,
): CourseSection {
  if (!localized) return section;
  return {
    ...section,
    title: localized.title ?? section.title,
    description: localized.description ?? section.description,
  };
}

export function applyCourseLessonLocaleContent(
  lesson: CourseLesson,
  localized: CourseLessonLocaleContent | null,
): CourseLesson {
  if (!localized) return lesson;
  return {
    ...lesson,
    title: localized.title ?? lesson.title,
    short_description: localized.short_description ?? lesson.short_description,
    description_markdown: localized.description_markdown ?? lesson.description_markdown,
    resources: localized.resources ?? lesson.resources,
    youtube_url: localized.youtube_url ?? lesson.youtube_url,
    video_primary_locale: localized.video_primary_locale ?? lesson.video_primary_locale,
    has_subtitle: localized.has_subtitle ?? lesson.has_subtitle,
    subtitle_locales: localized.subtitle_locales ?? lesson.subtitle_locales,
  };
}

export async function getCourseLocaleContent(
  courseId: string,
  locale: SupportedCourseLocale,
): Promise<CourseLocaleContent | null> {
  const key = `${courseId}:${locale}`;
  const existing = courseLocaleCache.get(key);
  if (existing) return existing;
  const promise = (async () => {
    const { data, error } = await supabase
      .from("course_locales")
      .select("data")
      .eq("course_id", courseId)
      .eq("locale", locale)
      .maybeSingle();
    if (error || !data?.data) return null;
    return { ...(data.data as Omit<CourseLocaleContent, "locale">), locale };
  })();
  courseLocaleCache.set(key, promise);
  try {
    return await promise;
  } catch (e) {
    courseLocaleCache.delete(key);
    throw e;
  }
}

export async function getBatchCourseLocaleContent(
  courseIds: string[],
  locale: SupportedCourseLocale,
): Promise<Map<string, CourseLocaleContent>> {
  const result = new Map<string, CourseLocaleContent>();
  if (courseIds.length === 0) return result;

  const uncachedIds: string[] = [];
  for (const id of courseIds) {
    const cached = courseLocaleCache.get(`${id}:${locale}`);
    if (cached) {
      const content = await cached;
      if (content) result.set(id, content);
    } else {
      uncachedIds.push(id);
    }
  }

  if (uncachedIds.length === 0) return result;

  const { data, error } = await supabase
    .from("course_locales")
    .select("course_id,data")
    .in("course_id", uncachedIds)
    .eq("locale", locale);

  if (!error && data) {
    for (const row of data) {
      if (!row.data) continue;
      const content = { ...(row.data as Omit<CourseLocaleContent, "locale">), locale };
      courseLocaleCache.set(`${row.course_id}:${locale}`, Promise.resolve(content));
      result.set(row.course_id, content);
    }
  }

  return result;
}

export async function setCourseLocaleContent(
  courseId: string,
  locale: SupportedCourseLocale,
  data: Partial<Omit<CourseLocaleContent, "locale">>,
): Promise<void> {
  const payload = removeUndefinedFields({
    ...data,
    updated_at: new Date().toISOString(),
  }) as Record<string, unknown>;
  const { error } = await supabase.from("course_locales").upsert(
    { course_id: courseId, locale, data: payload },
    { onConflict: "course_id,locale" },
  );
  if (error) throw new Error(error.message);
  courseLocaleCache.delete(`${courseId}:${locale}`);
}

export async function getCourseSectionLocaleContent(
  courseId: string,
  sectionId: string,
  locale: SupportedCourseLocale,
): Promise<CourseSectionLocaleContent | null> {
  const key = `${courseId}:${sectionId}:${locale}`;
  const existing = sectionLocaleCache.get(key);
  if (existing) return existing;
  const promise = (async () => {
    const { data, error } = await supabase
      .from("course_section_locales")
      .select("data")
      .eq("course_id", courseId)
      .eq("section_id", sectionId)
      .eq("locale", locale)
      .maybeSingle();
    if (error || !data?.data) return null;
    return { ...(data.data as Omit<CourseSectionLocaleContent, "locale">), locale };
  })();
  sectionLocaleCache.set(key, promise);
  try {
    return await promise;
  } catch (e) {
    sectionLocaleCache.delete(key);
    throw e;
  }
}

export async function setCourseSectionLocaleContent(
  courseId: string,
  sectionId: string,
  locale: SupportedCourseLocale,
  data: Partial<Omit<CourseSectionLocaleContent, "locale">>,
): Promise<void> {
  const payload = removeUndefinedFields({
    ...data,
    updated_at: new Date().toISOString(),
  }) as Record<string, unknown>;
  const { error } = await supabase.from("course_section_locales").upsert(
    { course_id: courseId, section_id: sectionId, locale, data: payload },
    { onConflict: "course_id,section_id,locale" },
  );
  if (error) throw new Error(error.message);
  sectionLocaleCache.delete(`${courseId}:${sectionId}:${locale}`);
  sectionLocaleMapCache.delete(`${courseId}:${locale}`);
}

export async function getCourseLessonLocaleContent(
  courseId: string,
  lessonId: string,
  locale: SupportedCourseLocale,
): Promise<CourseLessonLocaleContent | null> {
  const key = `${courseId}:${lessonId}:${locale}`;
  const existing = lessonLocaleCache.get(key);
  if (existing) return existing;
  const promise = (async () => {
    const { data, error } = await supabase
      .from("course_lesson_locales")
      .select("data")
      .eq("course_id", courseId)
      .eq("lesson_id", lessonId)
      .eq("locale", locale)
      .maybeSingle();
    if (error || !data?.data) return null;
    return { ...(data.data as Omit<CourseLessonLocaleContent, "locale">), locale };
  })();
  lessonLocaleCache.set(key, promise);
  try {
    return await promise;
  } catch (e) {
    lessonLocaleCache.delete(key);
    throw e;
  }
}

export async function setCourseLessonLocaleContent(
  courseId: string,
  lessonId: string,
  locale: SupportedCourseLocale,
  data: Partial<Omit<CourseLessonLocaleContent, "locale">>,
): Promise<void> {
  const payload = removeUndefinedFields({
    ...data,
    updated_at: new Date().toISOString(),
  }) as Record<string, unknown>;
  const { error } = await supabase.from("course_lesson_locales").upsert(
    { course_id: courseId, lesson_id: lessonId, locale, data: payload },
    { onConflict: "course_id,lesson_id,locale" },
  );
  if (error) throw new Error(error.message);
  lessonLocaleCache.delete(`${courseId}:${lessonId}:${locale}`);
  lessonLocaleMapCache.delete(`${courseId}:${locale}`);
}

export async function getCourseLessonLocaleContentMap(
  courseId: string,
  locale: SupportedCourseLocale,
): Promise<Map<string, CourseLessonLocaleContent>> {
  const key = `${courseId}:${locale}`;
  const existing = lessonLocaleMapCache.get(key);
  if (existing) return existing;
  const promise = (async () => {
    const { data, error } = await supabase
      .from("course_lesson_locales")
      .select("lesson_id, data")
      .eq("course_id", courseId)
      .eq("locale", locale);
    if (error) throw new Error(error.message);
    const map = new Map<string, CourseLessonLocaleContent>();
    for (const row of data ?? []) {
      const raw = row.data as Partial<CourseLessonLocaleContent> & { lesson_id?: string };
      const lessonId = String(row.lesson_id ?? raw.lesson_id ?? "").trim();
      if (!lessonId) continue;
      map.set(lessonId, { ...(raw as CourseLessonLocaleContent), locale });
    }
    return map;
  })();
  lessonLocaleMapCache.set(key, promise);
  try {
    return await promise;
  } catch (e) {
    lessonLocaleMapCache.delete(key);
    throw e;
  }
}

export async function getCourseSectionLocaleContentMap(
  courseId: string,
  locale: SupportedCourseLocale,
): Promise<Map<string, CourseSectionLocaleContent>> {
  const key = `${courseId}:${locale}`;
  const existing = sectionLocaleMapCache.get(key);
  if (existing) return existing;
  const promise = (async () => {
    const { data, error } = await supabase
      .from("course_section_locales")
      .select("section_id, data")
      .eq("course_id", courseId)
      .eq("locale", locale);
    if (error) throw new Error(error.message);
    const map = new Map<string, CourseSectionLocaleContent>();
    for (const row of data ?? []) {
      const raw = row.data as Partial<CourseSectionLocaleContent> & { section_id?: string };
      const sectionId = String(row.section_id ?? raw.section_id ?? "").trim();
      if (!sectionId) continue;
      map.set(sectionId, { ...(raw as CourseSectionLocaleContent), locale });
    }
    return map;
  })();
  sectionLocaleMapCache.set(key, promise);
  try {
    return await promise;
  } catch (e) {
    sectionLocaleMapCache.delete(key);
    throw e;
  }
}

export async function getPublishedCourses(): Promise<Course[]> {
  const cached = publishedCoursesCache.get("all");
  if (cached) return cached;
  const promise = (async () => {
    const { data, error } = await supabase
      .from("courses")
      .select(COURSE_ROW_SELECT)
      .eq("published", true)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToCourse(r as CourseRow));
  })();
  publishedCoursesCache.set("all", promise);
  promise.catch(() => publishedCoursesCache.delete("all"));
  return promise;
}

export async function getPublishedCoursesByInstructor(instructorId: string): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select(COURSE_ROW_SELECT)
    .eq("published", true)
    .eq("instructor_id", instructorId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToCourse(r as CourseRow));
}

export async function getCourse(courseId: string): Promise<Course | null> {
  const cached = courseByIdCache.get(courseId);
  if (cached) return cached;
  const promise = (async () => {
    const { data, error } = await supabase
      .from("courses")
      .select(COURSE_ROW_SELECT)
      .eq("id", courseId)
      .maybeSingle();
    if (error || !data) return null;
    return rowToCourse(data as CourseRow);
  })();
  courseByIdCache.set(courseId, promise);
  promise.catch(() => courseByIdCache.delete(courseId));
  return promise;
}

export function invalidateCourseCache(courseId?: string) {
  publishedCoursesCache.delete("all");
  if (courseId) courseByIdCache.delete(courseId);
}

export async function getCourseBySlug(slug: string, viewer?: User | null): Promise<Course | null> {
  const normalized = slug.trim();
  if (!normalized) return null;

  const { data: pub } = await supabase
    .from("courses")
    .select(COURSE_ROW_SELECT)
    .eq("slug", normalized)
    .eq("published", true)
    .maybeSingle();
  if (pub) return rowToCourse(pub as CourseRow);

  let resolvedViewer = viewer ?? null;
  if (!resolvedViewer) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    resolvedViewer = user;
  }
  if (!resolvedViewer) return null;

  const { data: draft, error } = await supabase
    .from("courses")
    .select(COURSE_ROW_SELECT)
    .eq("slug", normalized)
    .maybeSingle();
  if (error || !draft) return null;
  return rowToCourse(draft as CourseRow);
}

export async function getCourseSections(courseId: string): Promise<CourseSection[]> {
  const cached = sectionsCache.get(courseId);
  if (cached) return cached;
  const promise = (async () => {
    const { data, error } = await supabase
      .from("course_sections")
      .select("*")
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => sectionRowToSection(courseId, r as CourseRow & { sort_order: number }));
  })();
  sectionsCache.set(courseId, promise);
  promise.catch(() => sectionsCache.delete(courseId));
  return promise;
}

export async function getCourseLessons(
  courseId: string,
  options?: { previewOnly?: boolean },
): Promise<CourseLesson[]> {
  const cached = lessonsCache.get(courseId);
  if (cached) return cached;
  const promise = (async () => {
    const { data, error } = await supabase
      .from("course_lessons")
      .select("*")
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => lessonRowToLesson(r as CourseRow & { section_id: string; sort_order: number }));
  })();
  lessonsCache.set(courseId, promise);
  promise.catch(() => lessonsCache.delete(courseId));
  const rows = await promise;
  if (options?.previewOnly) return rows.filter((l) => l.is_preview_free === true);
  return rows;
}

export async function getEnrollment(userId: string, courseId: string): Promise<Enrollment | null> {
  const id = `${userId}_${courseId}`;
  const { data, error } = await supabase.from("enrollments").select("*").eq("id", id).maybeSingle();
  if (!error && data) {
    return { id: data.id, ...(data as Omit<Enrollment, "id">) } as Enrollment;
  }
  const { data: rows } = await supabase
    .from("enrollments")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .limit(1);
  const row = rows?.[0];
  if (!row) return null;
  return { id: row.id, ...(row as Omit<Enrollment, "id">) } as Enrollment;
}

export async function getMyEnrollments(userId: string): Promise<Enrollment[]> {
  const cached = enrollmentsCache.get(userId);
  if (cached) return cached;
  const promise = (async () => {
    const { data, error } = await supabase
      .from("enrollments")
      .select("*")
      .eq("user_id", userId)
      .order("last_accessed_at", { ascending: false });
    if (error) throw new Error(error.message);
    const list = (data ?? []).map((d) => ({ id: d.id, ...d } as Enrollment));
    const seen = new Set<string>();
    return list.filter((e) => {
      if (!e.course_id) return false;
      if (seen.has(e.course_id)) return false;
      seen.add(e.course_id);
      return true;
    });
  })();
  enrollmentsCache.set(userId, promise);
  promise.catch(() => enrollmentsCache.delete(userId));
  return promise;
}

export function invalidateEnrollmentsCache(userId: string) {
  enrollmentsCache.delete(userId);
}

export async function getEnrollmentsForCourse(courseId: string): Promise<Enrollment[]> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("*")
    .eq("course_id", courseId)
    .order("enrolled_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => ({ id: d.id, ...d } as Enrollment));
}

export async function enrollCourse(courseId: string, viewer?: User | null): Promise<Enrollment> {
  const user =
    viewer ??
    (
      await supabase.auth.getUser()
    ).data.user;
  if (!user) throw new Error("Chưa đăng nhập");
  const course = await getCourse(courseId);
  if (!course) throw new Error("Không tìm thấy khoá học");
  if (course.access_model === "paid_upfront") {
    throw new Error("Khoá học này yêu cầu thanh toán trước khi mở toàn bộ nội dung.");
  }

  const existing = await getEnrollment(user.id, courseId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const enrollmentId = `${user.id}_${courseId}`;
  const { data, error } = await supabase
    .from("enrollments")
    .insert({
      id: enrollmentId,
      user_id: user.id,
      course_id: courseId,
      enrolled_at: now,
      last_accessed_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, ...data } as Enrollment;
}

export async function touchEnrollment(courseId: string, viewer?: User | null): Promise<void> {
  const user =
    viewer ??
    (
      await supabase.auth.getUser()
    ).data.user;
  if (!user) return;
  const enr = await getEnrollment(user.id, courseId);
  if (!enr) return;
  await supabase
    .from("enrollments")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", enr.id);
}

export async function getLessonProgressForCourse(
  userId: string,
  courseId: string,
): Promise<LessonProgress[]> {
  const key = `${userId}_${courseId}`;
  const cached = lessonProgressCache.get(key);
  if (cached) return cached;
  const promise = (async () => {
    const { data, error } = await supabase
      .from("lesson_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("course_id", courseId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((d) => ({ id: d.id, ...d } as LessonProgress));
  })();
  lessonProgressCache.set(key, promise);
  promise.catch(() => lessonProgressCache.delete(key));
  return promise;
}

export function invalidateLessonProgressCache(userId: string, courseId: string) {
  lessonProgressCache.delete(`${userId}_${courseId}`);
}

export function invalidateSectionsCache(courseId: string) {
  sectionsCache.delete(courseId);
  lessonsCache.delete(courseId);
}

export function sortLessonsByCurriculum(lessons: CourseLesson[], sections: CourseSection[]): CourseLesson[] {
  const sectionOrderMap = new Map(sections.map((section, index) => [section.id, Number(section.order ?? index)]));
  return [...lessons].sort((a, b) => {
    const sectionDiff =
      (sectionOrderMap.get(a.section_id) ?? Number.MAX_SAFE_INTEGER) -
      (sectionOrderMap.get(b.section_id) ?? Number.MAX_SAFE_INTEGER);
    if (sectionDiff !== 0) return sectionDiff;
    const lessonDiff = Number(a.order ?? 0) - Number(b.order ?? 0);
    if (lessonDiff !== 0) return lessonDiff;
    return a.id.localeCompare(b.id);
  });
}

export function getCompletedLessonIds(lessons: CourseLesson[], progressList: LessonProgress[]): Set<string> {
  const lessonIds = new Set(lessons.map((lesson) => lesson.id));
  return new Set(
    progressList
      .filter((progress) => progress.completed_at && lessonIds.has(progress.lesson_id))
      .map((progress) => progress.lesson_id),
  );
}

export async function checkAndIssueCertificate(userId: string, courseId: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Chưa đăng nhập");

  const res = await fetch(CERTIFICATE_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...supabaseFunctionHeaders(token),
    },
    credentials: "include",
    body: JSON.stringify({ userId, courseId }),
  });

  const body = (await res.json().catch(() => ({}))) as Partial<{ issued: boolean; message: string }>;
  if (!res.ok) throw new Error(body.message || "Không thể cấp chứng nhận lúc này.");
  return body.issued === true;
}

export async function setLessonProgress(
  lessonId: string,
  courseId: string,
  completed: boolean,
  watchSeconds?: number,
  viewer?: User | null,
): Promise<void> {
  const user =
    viewer ??
    (
      await supabase.auth.getUser()
    ).data.user;
  if (!user) throw new Error("Chưa đăng nhập");

  const progressId = `${user.id}_${courseId}_${lessonId}`;
  const now = new Date().toISOString();
  const row = removeUndefinedFields({
    id: progressId,
    user_id: user.id,
    lesson_id: lessonId,
    course_id: courseId,
    completed_at: completed ? now : null,
    watch_seconds: watchSeconds,
  }) as Record<string, unknown>;

  const { error } = await supabase.from("lesson_progress").upsert(row, { onConflict: "id" });
  if (error) throw new Error(error.message);

  invalidateLessonProgressCache(user.id, courseId);

  if (completed) {
    checkAndIssueCertificate(user.id, courseId).catch(() => {});
    invokeCheckCourseCredential(courseId).catch(() => {});
  }
}

export function computeProgressPercent(lessons: CourseLesson[], progressList: LessonProgress[]): number {
  if (lessons.length === 0) return 0;
  const completedIds = getCompletedLessonIds(lessons, progressList);
  const completed = lessons.filter((l) => completedIds.has(l.id)).length;
  return Math.round((completed / lessons.length) * 100);
}

export function getNextLesson(lessons: CourseLesson[], progressList: LessonProgress[]): CourseLesson | null {
  const completedIds = getCompletedLessonIds(lessons, progressList);
  return lessons.find((l) => !completedIds.has(l.id)) ?? null;
}

export async function createCourse(data: CourseInsert, viewer?: User | null): Promise<Course> {
  const user =
    viewer ??
    (
      await supabase.auth.getUser()
    ).data.user;
  if (!user) throw new Error("Chưa đăng nhập");

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const instructorId = data.instructor_id || user.id;

  const dataDoc = removeUndefinedFields({
    title: data.title,
    description: data.description,
    learning_outcomes: data.learning_outcomes ?? [],
    short_description: data.short_description ?? "",
    thumbnail_url: data.thumbnail_url,
    thumbnail_path: data.thumbnail_path,
    instructor_name: data.instructor_name,
    level: data.level ?? "all",
    total_duration_seconds: data.total_duration_seconds ?? 0,
    i18n: data.i18n,
    access_model: data.access_model ?? "free",
    is_updating: data.is_updating ?? false,
    price_vnd: data.price_vnd ?? null,
    certificate_fee_vnd: data.certificate_fee_vnd ?? null,
    owner_type: data.owner_type ?? "corelia",
    platform_revenue_share_percent: data.platform_revenue_share_percent ?? 100,
    partner_contract_docs: data.partner_contract_docs ?? [],
    partner_invoice_docs: data.partner_invoice_docs ?? [],
    partner_transfer_info: data.partner_transfer_info ?? null,
    co_instructors: data.co_instructors ?? [],
    co_instructor_permissions: data.co_instructor_permissions ?? {},
  }) as Record<string, unknown>;

  const { data: inserted, error } = await supabase
    .from("courses")
    .insert({
      id,
      instructor_id: instructorId,
      published: data.published ?? false,
      slug: data.slug,
      created_at: now,
      updated_at: now,
      data: dataDoc,
    })
    .select("*")
    .single();
  if (error || !inserted) throw new Error(error?.message ?? "Tạo khoá học thất bại");
  return rowToCourse(inserted as CourseRow);
}

export function isCourseCoInstructorWithAnyPermission(
  course: Pick<Course, "co_instructor_permissions"> | null | undefined,
  uid: string | null | undefined,
): boolean {
  if (!course || !uid) return false;
  const perms = course.co_instructor_permissions?.[uid] as CourseCoInstructorPermissions | undefined;
  if (!perms) return false;
  return Object.values(perms).some(Boolean);
}

export function toCoInstructorSnapshot(profile: {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  instructor_headline?: string | null;
  instructor_bio?: string | null;
  instructor_organization?: string | null;
  instructor_website?: string | null;
}): CourseCoInstructorSnapshot {
  return removeUndefinedFields({
    id: profile.id,
    name: profile.full_name ?? "",
    avatar_url: profile.avatar_url ?? null,
    headline: profile.instructor_headline ?? null,
    organization: profile.instructor_organization ?? null,
    website: profile.instructor_website ?? null,
    bio: profile.instructor_bio ?? null,
  });
}

export async function addSection(courseId: string, data: CourseSectionInsert): Promise<CourseSection> {
  const payload = removeUndefinedFields(data as unknown as Record<string, unknown>) as unknown as CourseSectionInsert;
  const id = crypto.randomUUID();
  const sortOrder = Number(payload.order ?? 0);
  const sectionRest = { ...(payload as CourseSectionInsert & { id?: string }) };
  delete (sectionRest as { order?: unknown }).order;
  delete (sectionRest as { id?: unknown }).id;
  const dataDoc = removeUndefinedFields(sectionRest as unknown as Record<string, unknown>);
  const { error } = await supabase.from("course_sections").insert({
    course_id: courseId,
    id,
    sort_order: sortOrder,
    data: dataDoc,
  });
  if (error) throw new Error(error.message);
  return { id, ...payload } as CourseSection;
}

export async function addLesson(courseId: string, data: CourseLessonInsert): Promise<CourseLesson> {
  const payload = removeUndefinedFields(data as unknown as Record<string, unknown>) as unknown as CourseLessonInsert;
  const id = crypto.randomUUID();
  const sortOrder = Number(payload.order ?? 0);
  const lessonRest = { ...(payload as CourseLessonInsert & { id?: string }) };
  const { section_id } = lessonRest;
  delete (lessonRest as { order?: unknown }).order;
  delete (lessonRest as { id?: unknown }).id;
  delete (lessonRest as { section_id?: unknown }).section_id;
  const dataDoc = removeUndefinedFields(lessonRest as unknown as Record<string, unknown>);
  const { error } = await supabase.from("course_lessons").insert({
    course_id: courseId,
    id,
    section_id,
    sort_order: sortOrder,
    data: dataDoc,
  });
  if (error) throw new Error(error.message);
  return { id, ...payload } as CourseLesson;
}

export async function getCoursesForManagement(userId: string, isAdmin: boolean): Promise<Course[]> {
  if (isAdmin) {
    const { data, error } = await supabase.from("courses").select("*").order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToCourse(r as CourseRow));
  }
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("instructor_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToCourse(r as CourseRow));
}

function splitCourseUpdate(updates: CourseUpdate): {
  top: { slug?: string; published?: boolean; updated_at: string };
  dataPatch: Record<string, unknown>;
} {
  const top: { slug?: string; published?: boolean; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };
  const dataPatch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined) continue;
    if (k === "slug") top.slug = v as string;
    else if (k === "published") top.published = v as boolean;
    else dataPatch[k] = v;
  }
  return { top, dataPatch };
}

export async function updateCourse(courseId: string, data: CourseUpdate): Promise<void> {
  const { data: row, error: fetchErr } = await supabase.from("courses").select("*").eq("id", courseId).single();
  if (fetchErr || !row) throw new Error(fetchErr?.message ?? "Không tìm thấy khoá học");
  const prevData = ((row as CourseRow).data ?? {}) as Record<string, unknown>;
  const { top, dataPatch } = splitCourseUpdate(data);
  const nextData = { ...prevData, ...dataPatch };
  const { error } = await supabase
    .from("courses")
    .update({ ...top, data: nextData })
    .eq("id", courseId);
  if (error) throw new Error(error.message);
}

export async function refreshCourseTotalDuration(courseId: string): Promise<void> {
  const lessons = await getCourseLessons(courseId);
  const total = lessons.reduce((s, l) => s + (l.duration_seconds || 0), 0);
  await updateCourse(courseId, { total_duration_seconds: total });
}

export async function updateSection(
  courseId: string,
  sectionId: string,
  data: Partial<Pick<CourseSection, "title" | "order" | "description">>,
): Promise<void> {
  const { data: row, error } = await supabase
    .from("course_sections")
    .select("*")
    .eq("course_id", courseId)
    .eq("id", sectionId)
    .single();
  if (error || !row) throw new Error(error?.message ?? "Không tìm thấy section");
  const prev = (row.data ?? {}) as Record<string, unknown>;
  const next = { ...prev, ...removeUndefinedFields(data as Record<string, unknown>) };
  const sortOrder = data.order != null ? Number(data.order) : row.sort_order;
  const { error: upErr } = await supabase
    .from("course_sections")
    .update({ data: next, sort_order: sortOrder })
    .eq("course_id", courseId)
    .eq("id", sectionId);
  if (upErr) throw new Error(upErr.message);
}

export async function updateLesson(
  courseId: string,
  lessonId: string,
  data: Partial<CourseLessonInsert>,
): Promise<void> {
  const { data: row, error } = await supabase
    .from("course_lessons")
    .select("*")
    .eq("course_id", courseId)
    .eq("id", lessonId)
    .single();
  if (error || !row) throw new Error(error?.message ?? "Không tìm thấy lesson");
  const prev = (row.data ?? {}) as Record<string, unknown>;
  const patch = removeUndefinedFields(data as Record<string, unknown>);
  delete patch.order;
  delete patch.section_id;
  const next = { ...prev, ...patch };
  const updates: Record<string, unknown> = { data: next };
  if (data.order != null) updates.sort_order = Number(data.order);
  if (data.section_id != null) updates.section_id = data.section_id;
  const { error: upErr } = await supabase
    .from("course_lessons")
    .update(updates)
    .eq("course_id", courseId)
    .eq("id", lessonId);
  if (upErr) throw new Error(upErr.message);
}

export async function reorderCourseLessons(
  courseId: string,
  lessons: Array<Pick<CourseLesson, "id" | "order" | "section_id">>,
): Promise<void> {
  if (lessons.length === 0) return;
  const { error } = await supabase.rpc("batch_update_lesson_orders", {
    p_course_id: courseId,
    p_updates: lessons.map((l) => ({ id: l.id, sort_order: l.order, section_id: l.section_id })),
  });
  if (error) throw new Error(error.message);
}

export async function deleteSection(
  courseId: string,
  sectionId: string,
  lessonIdsInSection: string[],
): Promise<void> {
  await supabase.from("course_sections").delete().eq("course_id", courseId).eq("id", sectionId);
  if (lessonIdsInSection.length > 0) {
    await supabase
      .from("course_lessons")
      .delete()
      .eq("course_id", courseId)
      .in("id", lessonIdsInSection);
  }
}

export async function deleteLesson(courseId: string, lessonId: string): Promise<void> {
  const { error } = await supabase.from("course_lessons").delete().eq("course_id", courseId).eq("id", lessonId);
  if (error) throw new Error(error.message);
}

export async function deleteCourse(courseId: string): Promise<void> {
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) throw new Error(error.message);
}

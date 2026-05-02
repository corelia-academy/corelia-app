import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
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

const COURSES = "courses";
const ENROLLMENTS = "enrollments";
const LESSON_PROGRESS = "lesson_progress";
const CERTIFICATE_API =
  import.meta.env.VITE_CERTIFICATE_ISSUE_API || "/api/certificates/issue";

type CacheKey = string;
const courseLocaleCache = new Map<CacheKey, Promise<CourseLocaleContent | null>>();
const sectionLocaleCache = new Map<
  CacheKey,
  Promise<CourseSectionLocaleContent | null>
>();
const lessonLocaleCache = new Map<CacheKey, Promise<CourseLessonLocaleContent | null>>();
const lessonLocaleMapCache = new Map<
  CacheKey,
  Promise<Map<string, CourseLessonLocaleContent>>
>();
const sectionLocaleMapCache = new Map<
  CacheKey,
  Promise<Map<string, CourseSectionLocaleContent>>
>();

function removeUndefinedFields<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  ) as T;
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
    final_assignment_title:
      localized.final_assignment_title ?? course.final_assignment_title,
    final_assignment_description:
      localized.final_assignment_description ?? course.final_assignment_description,
    final_assignment_instructions:
      localized.final_assignment_instructions ?? course.final_assignment_instructions,
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
  const key: CacheKey = `${courseId}:${locale}`;
  const existing = courseLocaleCache.get(key);
  if (existing) return existing;
  const promise = (async () => {
    const ref = doc(db, COURSES, courseId, "locales", locale);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { ...(snap.data() as Omit<CourseLocaleContent, "locale">), locale };
  })();
  courseLocaleCache.set(key, promise);
  try {
    return await promise;
  } catch (e) {
    courseLocaleCache.delete(key);
    throw e;
  }
}

export async function setCourseLocaleContent(
  courseId: string,
  locale: SupportedCourseLocale,
  data: Partial<Omit<CourseLocaleContent, "locale">>,
): Promise<void> {
  const ref = doc(db, COURSES, courseId, "locales", locale);
  await setDoc(ref, removeUndefinedFields({
    ...data,
    entity: "course",
    course_id: courseId,
    locale,
    updated_at: new Date().toISOString(),
  }) as Record<string, unknown>, { merge: true });
  courseLocaleCache.delete(`${courseId}:${locale}`);
}

export async function getCourseSectionLocaleContent(
  courseId: string,
  sectionId: string,
  locale: SupportedCourseLocale,
): Promise<CourseSectionLocaleContent | null> {
  const key: CacheKey = `${courseId}:${sectionId}:${locale}`;
  const existing = sectionLocaleCache.get(key);
  if (existing) return existing;
  const promise = (async () => {
    const ref = doc(db, COURSES, courseId, "sections", sectionId, "locales", locale);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { ...(snap.data() as Omit<CourseSectionLocaleContent, "locale">), locale };
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
  const ref = doc(db, COURSES, courseId, "sections", sectionId, "locales", locale);
  await setDoc(ref, removeUndefinedFields({
    ...data,
    entity: "section",
    course_id: courseId,
    section_id: sectionId,
    locale,
    updated_at: new Date().toISOString(),
  }) as Record<string, unknown>, { merge: true });
  sectionLocaleCache.delete(`${courseId}:${sectionId}:${locale}`);
  sectionLocaleMapCache.delete(`${courseId}:${locale}`);
}

export async function getCourseLessonLocaleContent(
  courseId: string,
  lessonId: string,
  locale: SupportedCourseLocale,
): Promise<CourseLessonLocaleContent | null> {
  const key: CacheKey = `${courseId}:${lessonId}:${locale}`;
  const existing = lessonLocaleCache.get(key);
  if (existing) return existing;
  const promise = (async () => {
    const ref = doc(db, COURSES, courseId, "lessons", lessonId, "locales", locale);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { ...(snap.data() as Omit<CourseLessonLocaleContent, "locale">), locale };
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
  const ref = doc(db, COURSES, courseId, "lessons", lessonId, "locales", locale);
  await setDoc(ref, removeUndefinedFields({
    ...data,
    entity: "lesson",
    course_id: courseId,
    lesson_id: lessonId,
    locale,
    updated_at: new Date().toISOString(),
  }) as Record<string, unknown>, { merge: true });
  lessonLocaleCache.delete(`${courseId}:${lessonId}:${locale}`);
  lessonLocaleMapCache.delete(`${courseId}:${locale}`);
}

export async function getCourseLessonLocaleContentMap(
  courseId: string,
  locale: SupportedCourseLocale,
): Promise<Map<string, CourseLessonLocaleContent>> {
  const key: CacheKey = `${courseId}:${locale}`;
  const existing = lessonLocaleMapCache.get(key);
  if (existing) return existing;
  const promise = (async () => {
    const q = query(
      collectionGroup(db, "locales"),
      where("entity", "==", "lesson"),
      where("course_id", "==", courseId),
      where("locale", "==", locale),
    );
    const snap = await getDocs(q);
    const map = new Map<string, CourseLessonLocaleContent>();
    for (const d of snap.docs) {
      const raw = d.data() as Partial<CourseLessonLocaleContent> & {
        lesson_id?: string;
      };
      const lessonId = String(raw.lesson_id ?? "").trim();
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
  const key: CacheKey = `${courseId}:${locale}`;
  const existing = sectionLocaleMapCache.get(key);
  if (existing) return existing;
  const promise = (async () => {
    const q = query(
      collectionGroup(db, "locales"),
      where("entity", "==", "section"),
      where("course_id", "==", courseId),
      where("locale", "==", locale),
    );
    const snap = await getDocs(q);
    const map = new Map<string, CourseSectionLocaleContent>();
    for (const d of snap.docs) {
      const raw = d.data() as Partial<CourseSectionLocaleContent> & {
        section_id?: string;
      };
      const sectionId = String(raw.section_id ?? "").trim();
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

export async function backfillCourseLocaleIndex(
  courseId: string,
  locales: SupportedCourseLocale[] = ["vi", "en"],
): Promise<{ updated: number }> {
  const normalizedLocales = Array.from(
    new Set(locales.map((l) => normalizeCourseLocale(l))),
  );
  const [sections, lessons] = await Promise.all([
    getCourseSections(courseId).catch(() => [] as CourseSection[]),
    getCourseLessons(courseId).catch(() => [] as CourseLesson[]),
  ]);

  let updated = 0;
  let batch = writeBatch(db);
  let ops = 0;
  const commitIfNeeded = async (force = false) => {
    if (ops === 0) return;
    if (!force && ops < 400) return;
    await batch.commit();
    batch = writeBatch(db);
    ops = 0;
  };

  // courses/{courseId}/locales/{locale}
  for (const locale of normalizedLocales) {
    const ref = doc(db, COURSES, courseId, "locales", locale);
    const snap = await getDoc(ref).catch(() => null);
    if (!snap?.exists()) continue;
    const data = snap.data() as Record<string, unknown>;
    const needs =
      data.entity !== "course" || data.course_id !== courseId || data.locale !== locale;
    if (!needs) continue;
    batch.set(
      ref,
      { entity: "course", course_id: courseId, locale },
      { merge: true },
    );
    updated += 1;
    ops += 1;
    await commitIfNeeded();
  }

  // sections/{sectionId}/locales/{locale}
  for (const section of sections) {
    for (const locale of normalizedLocales) {
      const ref = doc(db, COURSES, courseId, "sections", section.id, "locales", locale);
      const snap = await getDoc(ref).catch(() => null);
      if (!snap?.exists()) continue;
      const data = snap.data() as Record<string, unknown>;
      const needs =
        data.entity !== "section" ||
        data.course_id !== courseId ||
        data.section_id !== section.id ||
        data.locale !== locale;
      if (!needs) continue;
      batch.set(
        ref,
        { entity: "section", course_id: courseId, section_id: section.id, locale },
        { merge: true },
      );
      updated += 1;
      ops += 1;
      await commitIfNeeded();
    }
  }

  // lessons/{lessonId}/locales/{locale}
  for (const lesson of lessons) {
    for (const locale of normalizedLocales) {
      const ref = doc(db, COURSES, courseId, "lessons", lesson.id, "locales", locale);
      const snap = await getDoc(ref).catch(() => null);
      if (!snap?.exists()) continue;
      const data = snap.data() as Record<string, unknown>;
      const needs =
        data.entity !== "lesson" ||
        data.course_id !== courseId ||
        data.lesson_id !== lesson.id ||
        data.locale !== locale;
      if (!needs) continue;
      batch.set(
        ref,
        { entity: "lesson", course_id: courseId, lesson_id: lesson.id, locale },
        { merge: true },
      );
      updated += 1;
      ops += 1;
      await commitIfNeeded();
    }
  }

  await commitIfNeeded(true);

  // Invalidate caches so UI uses bulk-query immediately.
  clearCourseLocaleCaches(courseId);
  lessonLocaleMapCache.delete(`${courseId}:vi`);
  lessonLocaleMapCache.delete(`${courseId}:en`);
  sectionLocaleMapCache.delete(`${courseId}:vi`);
  sectionLocaleMapCache.delete(`${courseId}:en`);

  return { updated };
}

/** Lấy tất cả khoá học (đã publish) */
export async function getPublishedCourses(): Promise<Course[]> {
  const q = query(
    collection(db, COURSES),
    where("published", "==", true),
    orderBy("updated_at", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Course));
}

/** Lấy các khoá học (đã publish) của một giảng viên cụ thể */
export async function getPublishedCoursesByInstructor(
  instructorId: string,
): Promise<Course[]> {
  const q = query(
    collection(db, COURSES),
    where("published", "==", true),
    where("instructor_id", "==", instructorId),
    orderBy("updated_at", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Course));
}

/** Lấy một khoá theo id */
export async function getCourse(courseId: string): Promise<Course | null> {
  const ref = doc(db, COURSES, courseId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Course;
}

/** Lấy một khoá theo slug */
export async function getCourseBySlug(slug: string): Promise<Course | null> {
  const normalized = slug.trim();
  if (!normalized) return null;
  // Always prefer a "published-only" query first.
  // This avoids Firestore Rules rejecting the whole query when a signed-in student
  // hits a draft course slug (permission-denied -> UI shows "not found").
  const publishedQ = query(
    collection(db, COURSES),
    where("slug", "==", normalized),
    where("published", "==", true),
  );
  const publishedSnap = await getDocs(publishedQ);
  if (!publishedSnap.empty) {
    const d = publishedSnap.docs[0];
    return { id: d.id, ...d.data() } as Course;
  }

  // If signed in, allow privileged users (admin/support/instructor) to resolve drafts.
  // Students will still be denied by rules; we surface it as null ("not found").
  if (!auth.currentUser) return null;
  try {
    const draftQ = query(collection(db, COURSES), where("slug", "==", normalized));
    const draftSnap = await getDocs(draftQ);
    if (draftSnap.empty) return null;
    const d = draftSnap.docs[0];
    return { id: d.id, ...d.data() } as Course;
  } catch {
    return null;
  }
}

/** Lấy các section của khoá */
export async function getCourseSections(courseId: string): Promise<CourseSection[]> {
  const q = query(
    collection(db, COURSES, courseId, "sections"),
    orderBy("order", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CourseSection));
}

/** Lấy tất cả lesson của khoá (theo section) */
export async function getCourseLessons(
  courseId: string,
  options?: { previewOnly?: boolean },
): Promise<CourseLesson[]> {
  const constraints = options?.previewOnly
    ? [where("is_preview_free", "==", true), orderBy("order", "asc")]
    : [orderBy("order", "asc")];
  const q = query(
    collection(db, COURSES, courseId, "lessons"),
    ...constraints,
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CourseLesson));
}

/** Lấy enrollment của user cho một khoá */
export async function getEnrollment(
  userId: string,
  courseId: string
): Promise<Enrollment | null> {
  const enrollmentId = `${userId}_${courseId}`;
  const directRef = doc(db, ENROLLMENTS, `${userId}_${courseId}`);
  const directSnap = await getDoc(directRef);
  if (directSnap.exists()) {
    return { id: directSnap.id, ...directSnap.data() } as Enrollment;
  }

  const q = query(
    collection(db, ENROLLMENTS),
    where("user_id", "==", userId),
    where("course_id", "==", courseId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data() as Enrollment;

  if (d.id !== enrollmentId) {
    try {
      await setDoc(doc(db, ENROLLMENTS, enrollmentId), {
        ...data,
        user_id: userId,
        course_id: courseId,
      }, { merge: true });
      return { ...data, id: enrollmentId, user_id: userId, course_id: courseId } as Enrollment;
    } catch {
      // Keep serving the legacy document if migration cannot run yet.
    }
  }

  return { ...data, id: d.id } as Enrollment;
}

/** Lấy tất cả enrollment của user (khoá đang học) */
export async function getMyEnrollments(userId: string): Promise<Enrollment[]> {
  const q = query(
    collection(db, ENROLLMENTS),
    where("user_id", "==", userId),
    orderBy("last_accessed_at", "desc")
  );
  const snap = await getDocs(q);
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Enrollment));
  // Defensive: legacy/migrated data can produce duplicates for same course_id.
  // Keep the most recently accessed one (query is already desc by last_accessed_at).
  const seen = new Set<string>();
  return rows.filter((e) => {
    if (!e.course_id) return false;
    if (seen.has(e.course_id)) return false;
    seen.add(e.course_id);
    return true;
  });
}

/** Lấy tất cả enrollment của một khoá (instructor/admin quản lý học viên) */
export async function getEnrollmentsForCourse(
  courseId: string
): Promise<Enrollment[]> {
  const q = query(
    collection(db, ENROLLMENTS),
    where("course_id", "==", courseId),
    orderBy("enrolled_at", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Enrollment));
}

/** Ghi danh vào khoá */
export async function enrollCourse(courseId: string): Promise<Enrollment> {
  const user = auth.currentUser;
  if (!user) throw new Error("Chưa đăng nhập");
  const course = await getCourse(courseId);
  if (!course) throw new Error("Không tìm thấy khoá học");
  if (course.access_model === "paid_upfront") {
    throw new Error(
      "Khoá học này yêu cầu thanh toán trước khi mở toàn bộ nội dung.",
    );
  }

  const existing = await getEnrollment(user.uid, courseId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const enrollmentId = `${user.uid}_${courseId}`;
  await setDoc(doc(db, ENROLLMENTS, enrollmentId), {
    user_id: user.uid,
    course_id: courseId,
    enrolled_at: now,
    last_accessed_at: now,
  });
  return {
    id: enrollmentId,
    user_id: user.uid,
    course_id: courseId,
    enrolled_at: now,
    last_accessed_at: now,
  };
}

/** Cập nhật last_accessed khi vào trang học */
export async function touchEnrollment(courseId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const enr = await getEnrollment(user.uid, courseId);
  if (!enr) return;

  await updateDoc(doc(db, ENROLLMENTS, enr.id), {
    last_accessed_at: new Date().toISOString(),
  });
}

/** Lấy tiến độ bài học của user trong một khoá */
export async function getLessonProgressForCourse(
  userId: string,
  courseId: string
): Promise<LessonProgress[]> {
  const q = query(
    collection(db, LESSON_PROGRESS),
    where("user_id", "==", userId),
    where("course_id", "==", courseId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LessonProgress));
}

export function sortLessonsByCurriculum(
  lessons: CourseLesson[],
  sections: CourseSection[],
): CourseLesson[] {
  const sectionOrderMap = new Map(
    sections.map((section, index) => [section.id, Number(section.order ?? index)]),
  );

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

export function getCompletedLessonIds(
  lessons: CourseLesson[],
  progressList: LessonProgress[],
): Set<string> {
  const lessonIds = new Set(lessons.map((lesson) => lesson.id));
  return new Set(
    progressList
      .filter((progress) => progress.completed_at && lessonIds.has(progress.lesson_id))
      .map((progress) => progress.lesson_id),
  );
}

/** Kiểm tra và cấp chứng nhận nếu đủ điều kiện: 100% bài học + (không có bài tập cuối HOẶC đã nộp và được duyệt) */
export async function checkAndIssueCertificate(
  userId: string,
  courseId: string
): Promise<boolean> {
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  if (!token) throw new Error("Chưa đăng nhập");

  const res = await fetch(CERTIFICATE_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
    body: JSON.stringify({ userId, courseId }),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<{
    issued: boolean;
    message: string;
  }>;

  if (!res.ok) {
    throw new Error(data.message || "Không thể cấp chứng nhận lúc này.");
  }

  return data.issued === true;
}

/** Đánh dấu bài học đã hoàn thành (hoặc cập nhật watch_seconds) */
export async function setLessonProgress(
  lessonId: string,
  courseId: string,
  completed: boolean,
  watchSeconds?: number
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Chưa đăng nhập");

  const q = query(
    collection(db, LESSON_PROGRESS),
    where("user_id", "==", user.uid),
    where("lesson_id", "==", lessonId),
    where("course_id", "==", courseId),
  );
  const snap = await getDocs(q);
  const now = new Date().toISOString();

  if (snap.empty) {
    await addDoc(collection(db, LESSON_PROGRESS), {
      user_id: user.uid,
      lesson_id: lessonId,
      course_id: courseId,
      completed_at: completed ? now : null,
      watch_seconds: watchSeconds ?? 0,
    });
  } else {
    const ref = snap.docs[0].ref;
    await updateDoc(ref, {
      completed_at: completed ? now : null,
      ...(watchSeconds != null && { watch_seconds: watchSeconds }),
    });
  }

  if (completed) {
    checkAndIssueCertificate(user.uid, courseId).catch(() => {});
  }
}

/** Tính % hoàn thành khoá (số bài đã completed / tổng số bài) */
export function computeProgressPercent(
  lessons: CourseLesson[],
  progressList: LessonProgress[]
): number {
  if (lessons.length === 0) return 0;
  const completedIds = getCompletedLessonIds(lessons, progressList);
  const completed = lessons.filter((l) => completedIds.has(l.id)).length;
  return Math.round((completed / lessons.length) * 100);
}

/** Bài tiếp theo chưa hoàn thành */
export function getNextLesson(
  lessons: CourseLesson[],
  progressList: LessonProgress[]
): CourseLesson | null {
  const completedIds = getCompletedLessonIds(lessons, progressList);
  return lessons.find((l) => !completedIds.has(l.id)) ?? null;
}

// --------------- Admin / Instructor: tạo khoá, section, lesson ---------------

/** Tạo khoá mới (instructor/admin) */
export async function createCourse(data: CourseInsert): Promise<Course> {
  const user = auth.currentUser;
  if (!user) throw new Error("Chưa đăng nhập");

  const now = new Date().toISOString();
  const ref = doc(collection(db, COURSES));
  const course: Omit<Course, "id"> = {
    title: data.title,
    slug: data.slug,
    description: data.description,
    learning_outcomes: data.learning_outcomes ?? [],
    short_description: data.short_description ?? "",
    thumbnail_url: data.thumbnail_url,
    thumbnail_path: data.thumbnail_path,
    instructor_id: data.instructor_id || user.uid,
    instructor_name: data.instructor_name,
    level: data.level ?? "all",
    total_duration_seconds: data.total_duration_seconds ?? 0,
    published: data.published ?? false,
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
    created_at: now,
    updated_at: now,
  };
  const payload = removeUndefinedFields(course);
  await setDoc(ref, payload);
  return { id: ref.id, ...payload };
}

export function isCourseCoInstructorWithAnyPermission(
  course: Pick<Course, "co_instructor_permissions"> | null | undefined,
  uid: string | null | undefined,
): boolean {
  if (!course || !uid) return false;
  const perms = course.co_instructor_permissions?.[uid] as
    | CourseCoInstructorPermissions
    | undefined;
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

/** Thêm section vào khoá */
export async function addSection(
  courseId: string,
  data: CourseSectionInsert
): Promise<CourseSection> {
  const payload = removeUndefinedFields(
    data as unknown as Record<string, unknown>,
  ) as unknown as CourseSectionInsert;
  const ref = await addDoc(
    collection(db, COURSES, courseId, "sections"),
    payload
  );
  return { id: ref.id, ...payload } as CourseSection;
}

/** Thêm lesson vào khoá */
export async function addLesson(
  courseId: string,
  data: CourseLessonInsert
): Promise<CourseLesson> {
  const payload = removeUndefinedFields(
    data as unknown as Record<string, unknown>,
  ) as unknown as CourseLessonInsert;
  const ref = await addDoc(
    collection(db, COURSES, courseId, "lessons"),
    payload
  );
  return { id: ref.id, ...payload } as CourseLesson;
}

/** Lấy khoá học do giảng viên tạo (instructor) hoặc tất cả (admin) */
export async function getCoursesForManagement(
  userId: string,
  isAdmin: boolean
): Promise<Course[]> {
  if (isAdmin) {
    const q = query(
      collection(db, COURSES),
      orderBy("updated_at", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Course));
  }
  const q = query(
    collection(db, COURSES),
    where("instructor_id", "==", userId),
    orderBy("updated_at", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Course));
}

/** Cập nhật khoá học (instructor/admin) */
export async function updateCourse(
  courseId: string,
  data: CourseUpdate
): Promise<void> {
  const ref = doc(db, COURSES, courseId);
  await updateDoc(ref, removeUndefinedFields({
    ...data,
    updated_at: new Date().toISOString(),
  }));
}

/** Cập nhật tổng thời lượng khoá = tổng duration_seconds của tất cả bài học (để hiển thị đúng bên ngoài trang khoá học). */
export async function refreshCourseTotalDuration(courseId: string): Promise<void> {
  const lessons = await getCourseLessons(courseId);
  const total = lessons.reduce((s, l) => s + (l.duration_seconds || 0), 0);
  await updateCourse(courseId, { total_duration_seconds: total });
}

/** Cập nhật section */
export async function updateSection(
  courseId: string,
  sectionId: string,
  data: Partial<Pick<CourseSection, "title" | "order" | "description">>
): Promise<void> {
  await updateDoc(
    doc(db, COURSES, courseId, "sections", sectionId),
    removeUndefinedFields(data)
  );
}

/** Cập nhật lesson */
export async function updateLesson(
  courseId: string,
  lessonId: string,
  data: Partial<CourseLessonInsert>
): Promise<void> {
  await updateDoc(
    doc(db, COURSES, courseId, "lessons", lessonId),
    removeUndefinedFields(data)
  );
}

/** Cập nhật lại thứ tự các lesson trong khoá */
export async function reorderCourseLessons(
  courseId: string,
  lessons: Array<Pick<CourseLesson, "id" | "order" | "section_id">>,
): Promise<void> {
  if (lessons.length === 0) return;

  const batch = writeBatch(db);
  for (const lesson of lessons) {
    batch.update(doc(db, COURSES, courseId, "lessons", lesson.id), {
      order: lesson.order,
      section_id: lesson.section_id,
    });
  }
  await batch.commit();
}

/** Xoá section và các lesson thuộc section đó */
export async function deleteSection(
  courseId: string,
  sectionId: string,
  lessonIdsInSection: string[]
): Promise<void> {
  const sectionRef = doc(db, COURSES, courseId, "sections", sectionId);
  await deleteDoc(sectionRef);
  for (const lid of lessonIdsInSection) {
    await deleteDoc(doc(db, COURSES, courseId, "lessons", lid));
  }
}

/** Xoá một lesson */
export async function deleteLesson(
  courseId: string,
  lessonId: string
): Promise<void> {
  await deleteDoc(doc(db, COURSES, courseId, "lessons", lessonId));
}

/** Xoá khoá học (admin/instructor chủ khoá) */
export async function deleteCourse(courseId: string): Promise<void> {
  const c = await getCourse(courseId);
  if (!c) return;
  const sections = await getCourseSections(courseId);
  const lessons = await getCourseLessons(courseId);
  for (const sec of sections) {
    await deleteDoc(doc(db, COURSES, courseId, "sections", sec.id));
  }
  for (const les of lessons) {
    await deleteDoc(doc(db, COURSES, courseId, "lessons", les.id));
  }
  await deleteDoc(doc(db, COURSES, courseId));
}

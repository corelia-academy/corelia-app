import {
  collection,
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
} from "@/types/courses";

const COURSES = "courses";
const ENROLLMENTS = "enrollments";
const LESSON_PROGRESS = "lesson_progress";
const CERTIFICATE_API =
  import.meta.env.VITE_CERTIFICATE_ISSUE_API || "/api/certificates/issue";

function removeUndefinedFields<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  ) as T;
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
  const q = query(collection(db, COURSES), where("slug", "==", normalized));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Course;
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
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Enrollment));
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
    short_description: data.short_description ?? "",
    thumbnail_url: data.thumbnail_url,
    thumbnail_path: data.thumbnail_path,
    instructor_id: data.instructor_id || user.uid,
    instructor_name: data.instructor_name,
    level: data.level ?? "all",
    total_duration_seconds: data.total_duration_seconds ?? 0,
    published: data.published ?? false,
    access_model: data.access_model ?? "free",
    price_vnd: data.price_vnd ?? null,
    certificate_fee_vnd: data.certificate_fee_vnd ?? null,
    owner_type: data.owner_type ?? "corelia",
    platform_revenue_share_percent: data.platform_revenue_share_percent ?? 100,
    partner_contract_docs: data.partner_contract_docs ?? [],
    partner_invoice_docs: data.partner_invoice_docs ?? [],
    partner_transfer_info: data.partner_transfer_info ?? null,
    created_at: now,
    updated_at: now,
  };
  const payload = removeUndefinedFields(course);
  await setDoc(ref, payload);
  return { id: ref.id, ...payload };
}

/** Thêm section vào khoá */
export async function addSection(
  courseId: string,
  data: CourseSectionInsert
): Promise<CourseSection> {
  const ref = await addDoc(
    collection(db, COURSES, courseId, "sections"),
    data
  );
  return { id: ref.id, ...data };
}

/** Thêm lesson vào khoá */
export async function addLesson(
  courseId: string,
  data: CourseLessonInsert
): Promise<CourseLesson> {
  const ref = await addDoc(
    collection(db, COURSES, courseId, "lessons"),
    data
  );
  return { id: ref.id, ...data };
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
  data: Partial<Pick<CourseSection, "title" | "order">>
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

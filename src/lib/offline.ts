import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { COL, SUB } from "@/lib/collections";
import { removeUndefinedFields } from "@/lib/utils";
import { getCurrentProfile } from "@/lib/profile";
import {
  canCoordinateOfflineRoster,
  canManageOfflineAcademy,
} from "@/lib/permissions";
import type {
  OfflineAssignmentSubmission,
  OfflineAssignmentSubmissionInsert,
  OfflineAssignmentSubmissionReviewInput,
  OfflineAttendanceRecord,
  OfflineAttendanceUpsertInput,
  OfflineCourse,
  OfflineCourseInsert,
  OfflineCourseMetricsSnapshot,
  OfflineCourseUpdate,
  OfflineCohort,
  OfflineCohortEnrollment,
  OfflineCohortInsert,
  OfflineCohortMetricsSnapshot,
  OfflineCohortSession,
  OfflineCohortUpdate,
  OfflineEnrollmentInsert,
  OfflineEnrollmentRoadmapUpdate,
  OfflineSessionInsert,
} from "@/types/offline";

const OFFLINE_MEET_CREATE_SPACE_API =
  import.meta.env.VITE_OFFLINE_MEET_CREATE_SPACE_API ||
  "/api/offline/meet/session/create-space";
const PUBLIC_COHORT_STATUSES: OfflineCohort["status"][] = [
  "published",
  "running",
  "completed",
];

function sessionCollection(cohortId: string) {
  return collection(db, COL.OFFLINE_COHORTS, cohortId, SUB.SESSIONS);
}

function emptyCourseMetricsSnapshot(): OfflineCourseMetricsSnapshot {
  return {
    cohorts_total: 0,
    active_cohorts: 0,
    enrolled_students: 0,
    published_recordings: 0,
    updated_at: null,
  };
}

function normalizeSession(data: OfflineCohortSession): OfflineCohortSession {
  return {
    ...data,
    zoom_meeting_uuid: data.zoom_meeting_uuid ?? null,
    meeting_status: data.meeting_status ?? "scheduled",
    attendance_source: data.attendance_source ?? "manual",
    recording_sync_status: data.recording_sync_status ?? "not_expected",
    recording_ready_at: data.recording_ready_at ?? null,
    zoom_recording_count: Number(data.zoom_recording_count ?? 0),
    last_zoom_sync_at: data.last_zoom_sync_at ?? null,
  };
}

function emptyMetricsSnapshot(): OfflineCohortMetricsSnapshot {
  return {
    sessions_total: 0,
    enrolled_students: 0,
    published_recordings: 0,
    assignments_total: 0,
    updated_at: null,
  };
}

function normalizeCohort(data: OfflineCohort): OfflineCohort {
  return {
    ...data,
    coordinator_ids: data.coordinator_ids ?? [],
    meeting_provider: data.meeting_provider ?? "google_meet",
    default_zoom_join_url: data.default_zoom_join_url ?? null,
    default_zoom_start_url: data.default_zoom_start_url ?? null,
    metrics_snapshot: data.metrics_snapshot ?? emptyMetricsSnapshot(),
  };
}

function normalizeCourse(data: OfflineCourse): OfflineCourse {
  return {
    ...data,
    instructor_ids: data.instructor_ids ?? [],
    instructor_names: data.instructor_names ?? [],
    metrics_snapshot: data.metrics_snapshot ?? emptyCourseMetricsSnapshot(),
  };
}

async function requireCurrentUser() {
  const user = auth.currentUser;
  if (!user) throw new Error("Chưa đăng nhập");
  return user;
}

async function requireOfflineManager() {
  const user = await requireCurrentUser();
  const profile = await getCurrentProfile();
  if (!canManageOfflineAcademy(profile)) {
    throw new Error("Bạn không có quyền quản lý lớp học trực tiếp.");
  }
  return { user, profile };
}

async function requireRosterCoordinator() {
  const user = await requireCurrentUser();
  const profile = await getCurrentProfile();
  if (!canCoordinateOfflineRoster(profile)) {
    throw new Error("Bạn không có quyền điều phối danh sách học viên.");
  }
  return { user, profile };
}

export async function listOfflineCohorts(): Promise<OfflineCohort[]> {
  const profile = await getCurrentProfile().catch(() => null);
  const isManager = canManageOfflineAcademy(profile);
  const cohortCollection = collection(db, COL.OFFLINE_COHORTS);
  const cohortsQuery = isManager
    ? query(cohortCollection, orderBy("updated_at", "desc"))
    : query(
        cohortCollection,
        where("status", "in", PUBLIC_COHORT_STATUSES),
        orderBy("updated_at", "desc"),
      );
  const snap = await getDocs(cohortsQuery);
  return snap.docs.map((item) =>
    normalizeCohort({
      id: item.id,
      metrics_snapshot: emptyMetricsSnapshot(),
      coordinator_ids: [],
      ...item.data(),
    } as unknown as OfflineCohort),
  );
}

export async function listOfflineCourses(): Promise<OfflineCourse[]> {
  const profile = await getCurrentProfile().catch(() => null);
  const isManager = canManageOfflineAcademy(profile);
  const base = collection(db, COL.OFFLINE_COURSES);
  const q = isManager
    ? query(base, orderBy("updated_at", "desc"))
    : query(base, where("published", "==", true), orderBy("updated_at", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((item) =>
    normalizeCourse({
      id: item.id,
      metrics_snapshot: emptyCourseMetricsSnapshot(),
      ...item.data(),
    } as OfflineCourse),
  );
}

export async function getOfflineCourse(courseId: string): Promise<OfflineCourse | null> {
  const ref = doc(db, COL.OFFLINE_COURSES, courseId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return normalizeCourse({
    id: snap.id,
    metrics_snapshot: emptyCourseMetricsSnapshot(),
    ...snap.data(),
  } as OfflineCourse);
}

export async function createOfflineCourse(
  data: OfflineCourseInsert,
): Promise<OfflineCourse> {
  const { user } = await requireOfflineManager();
  const ref = doc(collection(db, COL.OFFLINE_COURSES));
  const now = new Date().toISOString();
  const payload = removeUndefinedFields({
    title: data.title.trim(),
    tagline: data.tagline.trim(),
    description: data.description?.trim() || null,
    cover_image_url: data.cover_image_url?.trim() || null,
    level: data.level ?? "all",
    venue_city: data.venue_city?.trim() || null,
    instructor_ids: Array.from(new Set(data.instructor_ids ?? [])),
    instructor_names: Array.from(
      new Set((data.instructor_names ?? []).map((item) => item.trim()).filter(Boolean)),
    ),
    learning_outcomes: data.learning_outcomes?.trim() || null,
    certificate_title: data.certificate_title?.trim() || null,
    price_note: data.price_note?.trim() || null,
    published: data.published ?? false,
    created_by: user.uid,
    updated_by: user.uid,
    created_at: now,
    updated_at: now,
    metrics_snapshot: emptyCourseMetricsSnapshot(),
  });
  await setDoc(ref, payload);
  return normalizeCourse({ id: ref.id, ...payload } as OfflineCourse);
}

export async function updateOfflineCourse(
  courseId: string,
  updates: OfflineCourseUpdate,
): Promise<void> {
  const { user } = await requireOfflineManager();
  const ref = doc(db, COL.OFFLINE_COURSES, courseId);
  const payload = removeUndefinedFields({
    title: updates.title?.trim(),
    tagline: updates.tagline?.trim(),
    description:
      updates.description === undefined ? undefined : updates.description?.trim() || null,
    cover_image_url:
      updates.cover_image_url === undefined
        ? undefined
        : updates.cover_image_url?.trim() || null,
    level: updates.level,
    venue_city:
      updates.venue_city === undefined ? undefined : updates.venue_city?.trim() || null,
    instructor_ids: updates.instructor_ids
      ? Array.from(new Set(updates.instructor_ids))
      : undefined,
    instructor_names: updates.instructor_names
      ? Array.from(
          new Set(updates.instructor_names.map((item) => item.trim()).filter(Boolean)),
        )
      : undefined,
    learning_outcomes:
      updates.learning_outcomes === undefined
        ? undefined
        : updates.learning_outcomes?.trim() || null,
    certificate_title:
      updates.certificate_title === undefined
        ? undefined
        : updates.certificate_title?.trim() || null,
    price_note:
      updates.price_note === undefined ? undefined : updates.price_note?.trim() || null,
    published: updates.published,
    metrics_snapshot: updates.metrics_snapshot,
    updated_by: user.uid,
    updated_at: new Date().toISOString(),
  });
  await updateDoc(ref, payload);
}

export async function getOfflineCohort(cohortId: string): Promise<OfflineCohort | null> {
  const ref = doc(db, COL.OFFLINE_COHORTS, cohortId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return normalizeCohort({
    id: snap.id,
    metrics_snapshot: emptyMetricsSnapshot(),
    coordinator_ids: [],
    ...snap.data(),
  } as unknown as OfflineCohort);
}

export async function listOfflineCohortsForCourse(
  courseId: string,
): Promise<OfflineCohort[]> {
  const q = query(
    collection(db, COL.OFFLINE_COHORTS),
    where("offline_course_id", "==", courseId),
    orderBy("updated_at", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((item) =>
    normalizeCohort({
      id: item.id,
      metrics_snapshot: emptyMetricsSnapshot(),
      coordinator_ids: [],
      ...item.data(),
    } as unknown as OfflineCohort),
  );
}

export async function createOfflineCohort(
  data: OfflineCohortInsert,
): Promise<OfflineCohort> {
  const { user } = await requireOfflineManager();
  const ref = doc(collection(db, COL.OFFLINE_COHORTS));
  const now = new Date().toISOString();
  const payload = removeUndefinedFields({
    offline_course_id: data.offline_course_id,
    title: data.title.trim(),
    tagline: data.tagline.trim(),
    description: data.description?.trim() || null,
    status: data.status ?? "draft",
    delivery_mode: data.delivery_mode ?? "offline",
    meeting_provider: data.meeting_provider ?? "google_meet",
    venue_name: data.venue_name?.trim() || null,
    venue_address: data.venue_address?.trim() || null,
    city: data.city?.trim() || null,
    cover_image_url: data.cover_image_url?.trim() || null,
    instructor_id: data.instructor_id.trim(),
    instructor_name: data.instructor_name.trim(),
    coordinator_ids: Array.from(new Set(data.coordinator_ids ?? [])),
    zoom_host_email: data.zoom_host_email?.trim() || null,
    default_zoom_join_url: data.default_zoom_join_url?.trim() || null,
    default_zoom_start_url: data.default_zoom_start_url?.trim() || null,
    starts_at: data.starts_at ?? null,
    ends_at: data.ends_at ?? null,
    registration_notes: data.registration_notes?.trim() || null,
    created_by: user.uid,
    updated_by: user.uid,
    created_at: now,
    updated_at: now,
    metrics_snapshot: emptyMetricsSnapshot(),
  });

  await setDoc(ref, payload);
  await refreshOfflineCourseMetrics(data.offline_course_id).catch(() => undefined);
  return normalizeCohort({ id: ref.id, ...payload } as OfflineCohort);
}

export async function updateOfflineCohort(
  cohortId: string,
  updates: OfflineCohortUpdate,
): Promise<void> {
  const { user } = await requireOfflineManager();
  const ref = doc(db, COL.OFFLINE_COHORTS, cohortId);
  const payload = removeUndefinedFields({
    offline_course_id: updates.offline_course_id,
    title: updates.title?.trim(),
    tagline: updates.tagline?.trim(),
    description:
      updates.description === undefined ? undefined : updates.description?.trim() || null,
    status: updates.status,
    delivery_mode: updates.delivery_mode,
    meeting_provider: updates.meeting_provider,
    venue_name:
      updates.venue_name === undefined ? undefined : updates.venue_name?.trim() || null,
    venue_address:
      updates.venue_address === undefined
        ? undefined
        : updates.venue_address?.trim() || null,
    city: updates.city === undefined ? undefined : updates.city?.trim() || null,
    cover_image_url:
      updates.cover_image_url === undefined
        ? undefined
        : updates.cover_image_url?.trim() || null,
    instructor_id: updates.instructor_id,
    instructor_name: updates.instructor_name?.trim(),
    coordinator_ids: updates.coordinator_ids,
    zoom_host_email:
      updates.zoom_host_email === undefined
        ? undefined
        : updates.zoom_host_email?.trim() || null,
    default_zoom_join_url:
      updates.default_zoom_join_url === undefined
        ? undefined
        : updates.default_zoom_join_url?.trim() || null,
    default_zoom_start_url:
      updates.default_zoom_start_url === undefined
        ? undefined
        : updates.default_zoom_start_url?.trim() || null,
    starts_at: updates.starts_at,
    ends_at: updates.ends_at,
    registration_notes:
      updates.registration_notes === undefined
        ? undefined
        : updates.registration_notes?.trim() || null,
    metrics_snapshot: updates.metrics_snapshot,
    updated_by: user.uid,
    updated_at: new Date().toISOString(),
  });
  await updateDoc(ref, payload);
  const current = await getDoc(ref);
  const courseId =
    (updates.offline_course_id as string | undefined) ??
    (current.data()?.offline_course_id as string | undefined);
  if (courseId) {
    await refreshOfflineCourseMetrics(courseId).catch(() => undefined);
  }
}

export async function listOfflineSessions(
  cohortId: string,
): Promise<OfflineCohortSession[]> {
  const q = query(sessionCollection(cohortId), orderBy("starts_at", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((item) =>
    normalizeSession({
      id: item.id,
      ...item.data(),
    } as OfflineCohortSession),
  );
}

export async function saveOfflineSession(
  cohortId: string,
  input: OfflineSessionInsert,
  sessionId?: string,
): Promise<OfflineCohortSession> {
  await requireOfflineManager();
  const now = new Date().toISOString();
  const payload = removeUndefinedFields({
    cohort_id: cohortId,
    week_index: Math.max(1, Number(input.week_index) || 1),
    title: input.title.trim(),
    summary: input.summary?.trim() || null,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    location_label: input.location_label?.trim() || null,
    location_address: input.location_address?.trim() || null,
    zoom_meeting_id: input.zoom_meeting_id?.trim() || null,
    zoom_meeting_uuid: null,
    zoom_join_url: input.zoom_join_url?.trim() || null,
    zoom_start_url: input.zoom_start_url?.trim() || null,
    meeting_status: input.meeting_status ?? "scheduled",
    attendance_source: input.attendance_source ?? "manual",
    recording_sync_status: input.recording_sync_status ?? "not_expected",
    recording_ready_at: input.recording_ready_at ?? null,
    zoom_recording_count: Math.max(0, Number(input.zoom_recording_count ?? 0)),
    last_zoom_sync_at: input.last_zoom_sync_at ?? null,
    recording_url: input.recording_url?.trim() || null,
    transcript_url: input.transcript_url?.trim() || null,
    assignment_title: input.assignment_title?.trim() || null,
    assignment_description: input.assignment_description?.trim() || null,
    assignment_due_at: input.assignment_due_at ?? null,
    updated_at: now,
  });

  if (sessionId) {
    const ref = doc(db, COL.OFFLINE_COHORTS, cohortId, SUB.SESSIONS, sessionId);
    await updateDoc(ref, payload);
    await refreshOfflineCohortMetrics(cohortId).catch(() => undefined);
    const updated = await getDoc(ref);
    return normalizeSession({ id: updated.id, ...updated.data() } as OfflineCohortSession);
  }

  const ref = await addDoc(sessionCollection(cohortId), {
    ...payload,
    created_at: now,
  });
  await refreshOfflineCohortMetrics(cohortId).catch(() => undefined);
  const created = await getDoc(ref);
  return normalizeSession({ id: created.id, ...created.data() } as OfflineCohortSession);
}

type CreateOfflineSessionMeetSpaceResponse = {
  session_id: string;
  meeting_name: string;
  meeting_uri: string;
  meeting_code?: string | null;
  reused?: boolean;
  message?: string;
};

export async function createGoogleMeetSpaceForOfflineSession(input: {
  courseId: string;
  cohortId: string;
  sessionId: string;
}): Promise<CreateOfflineSessionMeetSpaceResponse> {
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  if (!token) throw new Error("Chưa đăng nhập");

  const res = await fetch(OFFLINE_MEET_CREATE_SPACE_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
    body: JSON.stringify(input),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<
    CreateOfflineSessionMeetSpaceResponse
  >;
  if (!res.ok || !data.session_id || !data.meeting_name || !data.meeting_uri) {
    throw new Error(data.message || "Không thể tạo Google Meet tự động.");
  }

  return {
    session_id: data.session_id,
    meeting_name: data.meeting_name,
    meeting_uri: data.meeting_uri,
    meeting_code: data.meeting_code ?? null,
    reused: data.reused ?? false,
  };
}

function offlineEnrollmentId(cohortId: string, userId: string): string {
  return `${cohortId}_${userId}`;
}

function offlineAttendanceId(sessionId: string, userId: string): string {
  return `${sessionId}_${userId}`;
}

function offlineAssignmentSubmissionId(sessionId: string, userId: string): string {
  return `${sessionId}_${userId}`;
}

export async function getMyOfflineEnrollment(
  cohortId: string,
): Promise<OfflineCohortEnrollment | null> {
  const user = await requireCurrentUser();
  const ref = doc(db, COL.OFFLINE_COHORT_ENROLLMENTS, offlineEnrollmentId(cohortId, user.uid));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as OfflineCohortEnrollment;
}

export async function listMyOfflineEnrollments(): Promise<OfflineCohortEnrollment[]> {
  const user = await requireCurrentUser();
  const q = query(
    collection(db, COL.OFFLINE_COHORT_ENROLLMENTS),
    where("user_id", "==", user.uid),
    orderBy("updated_at", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map(
    (item) => ({ id: item.id, ...item.data() }) as OfflineCohortEnrollment,
  );
}

export async function listOfflineEnrollments(
  cohortId: string,
): Promise<OfflineCohortEnrollment[]> {
  await requireOfflineManager();
  const q = query(
    collection(db, COL.OFFLINE_COHORT_ENROLLMENTS),
    where("cohort_id", "==", cohortId),
    orderBy("enrolled_at", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map(
    (item) => ({ id: item.id, ...item.data() }) as OfflineCohortEnrollment,
  );
}

export async function createOfflineEnrollment(
  cohortId: string,
  input: OfflineEnrollmentInsert,
): Promise<OfflineCohortEnrollment> {
  await requireRosterCoordinator();
  const ref = doc(
    db,
    COL.OFFLINE_COHORT_ENROLLMENTS,
    offlineEnrollmentId(cohortId, input.user_id.trim()),
  );
  const now = new Date().toISOString();
  const payload = {
    cohort_id: cohortId,
    user_id: input.user_id.trim(),
    student_name: input.student_name?.trim() || null,
    student_email: input.student_email?.trim() || null,
    status: input.status ?? "active",
    progress_percent: Math.max(0, Math.min(100, Number(input.progress_percent ?? 0))),
    completed_sessions: Math.max(0, Number(input.completed_sessions ?? 0)),
    assignment_completion_percent: Math.max(
      0,
      Math.min(100, Number(input.assignment_completion_percent ?? 0)),
    ),
    mentor_note: input.mentor_note?.trim() || null,
    enrolled_at: now,
    updated_at: now,
    last_reviewed_at: null,
  };
  await setDoc(ref, payload, { merge: true });
  await refreshOfflineCohortMetrics(cohortId).catch(() => undefined);
  return { id: ref.id, ...payload } as OfflineCohortEnrollment;
}

export async function updateOfflineEnrollmentRoadmap(
  cohortId: string,
  userId: string,
  updates: OfflineEnrollmentRoadmapUpdate,
): Promise<void> {
  await requireOfflineManager();
  const ref = doc(
    db,
    COL.OFFLINE_COHORT_ENROLLMENTS,
    offlineEnrollmentId(cohortId, userId),
  );
  const payload = removeUndefinedFields({
    status: updates.status,
    progress_percent:
      updates.progress_percent === undefined
        ? undefined
        : Math.max(0, Math.min(100, Number(updates.progress_percent))),
    completed_sessions:
      updates.completed_sessions === undefined
        ? undefined
        : Math.max(0, Number(updates.completed_sessions)),
    assignment_completion_percent:
      updates.assignment_completion_percent === undefined
        ? undefined
        : Math.max(
            0,
            Math.min(100, Number(updates.assignment_completion_percent)),
          ),
    mentor_note:
      updates.mentor_note === undefined ? undefined : updates.mentor_note?.trim() || null,
    last_reviewed_at:
      updates.last_reviewed_at === undefined
        ? new Date().toISOString()
        : updates.last_reviewed_at,
    updated_at: new Date().toISOString(),
  });
  await updateDoc(ref, payload);
  await refreshOfflineCohortMetrics(cohortId).catch(() => undefined);
}

export async function listOfflineAttendance(
  cohortId: string,
): Promise<OfflineAttendanceRecord[]> {
  await requireOfflineManager();
  const q = query(
    collection(db, COL.OFFLINE_ATTENDANCE),
    where("cohort_id", "==", cohortId),
    orderBy("updated_at", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map(
    (item) => ({ id: item.id, ...item.data() }) as OfflineAttendanceRecord,
  );
}

export async function listMyOfflineAttendance(
  cohortId: string,
): Promise<OfflineAttendanceRecord[]> {
  const user = await requireCurrentUser();
  const q = query(
    collection(db, COL.OFFLINE_ATTENDANCE),
    where("cohort_id", "==", cohortId),
    where("user_id", "==", user.uid),
  );
  const snap = await getDocs(q);
  return snap.docs.map(
    (item) => ({ id: item.id, ...item.data() }) as OfflineAttendanceRecord,
  );
}

export async function upsertOfflineAttendance(
  cohortId: string,
  sessionId: string,
  userId: string,
  studentName: string | null | undefined,
  input: OfflineAttendanceUpsertInput,
): Promise<void> {
  const { user } = await requireOfflineManager();
  const ref = doc(
    db,
    COL.OFFLINE_ATTENDANCE,
    offlineAttendanceId(sessionId, userId),
  );
  const now = new Date().toISOString();
  await setDoc(
    ref,
    {
      cohort_id: cohortId,
      session_id: sessionId,
      user_id: userId,
      student_name: studentName?.trim() || null,
      status: input.status,
      note: input.note?.trim() || null,
      marked_by: user.uid,
      marked_at: now,
      updated_at: now,
    },
    { merge: true },
  );
}

export async function listOfflineAssignmentSubmissions(
  cohortId: string,
): Promise<OfflineAssignmentSubmission[]> {
  await requireOfflineManager();
  const q = query(
    collection(db, COL.OFFLINE_ASSIGNMENT_SUBMISSIONS),
    where("cohort_id", "==", cohortId),
    orderBy("submitted_at", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map(
    (item) => ({ id: item.id, ...item.data() }) as OfflineAssignmentSubmission,
  );
}

export async function listMyOfflineAssignmentSubmissions(
  cohortId: string,
): Promise<OfflineAssignmentSubmission[]> {
  const user = await requireCurrentUser();
  const q = query(
    collection(db, COL.OFFLINE_ASSIGNMENT_SUBMISSIONS),
    where("cohort_id", "==", cohortId),
    where("user_id", "==", user.uid),
    orderBy("submitted_at", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map(
    (item) => ({ id: item.id, ...item.data() }) as OfflineAssignmentSubmission,
  );
}

export async function upsertOfflineAssignmentSubmission(
  cohortId: string,
  sessionId: string,
  input: OfflineAssignmentSubmissionInsert,
): Promise<OfflineAssignmentSubmission> {
  const user = await requireCurrentUser();
  const profile = await getCurrentProfile().catch(() => null);
  const ref = doc(
    db,
    COL.OFFLINE_ASSIGNMENT_SUBMISSIONS,
    offlineAssignmentSubmissionId(sessionId, user.uid),
  );
  const existing = await getDoc(ref);
  const now = new Date().toISOString();
  const base = {
    cohort_id: cohortId,
    session_id: sessionId,
    user_id: user.uid,
    student_name: profile?.full_name?.trim() || user.displayName || null,
    submission_text: input.submission_text?.trim() || null,
    proof_url: input.proof_url?.trim() || null,
    status: "pending" as const,
    review_note: null,
    reviewed_by: null,
    reviewed_at: null,
    updated_at: now,
  };

  if (existing.exists()) {
    await updateDoc(ref, base);
    return { id: ref.id, ...existing.data(), ...base } as OfflineAssignmentSubmission;
  }

  const payload = { ...base, submitted_at: now };
  await setDoc(ref, payload);
  return { id: ref.id, ...payload } as OfflineAssignmentSubmission;
}

export async function reviewOfflineAssignmentSubmission(
  cohortId: string,
  sessionId: string,
  userId: string,
  input: OfflineAssignmentSubmissionReviewInput,
): Promise<void> {
  const { user } = await requireOfflineManager();
  const ref = doc(
    db,
    COL.OFFLINE_ASSIGNMENT_SUBMISSIONS,
    offlineAssignmentSubmissionId(sessionId, userId),
  );
  await updateDoc(ref, {
    cohort_id: cohortId,
    session_id: sessionId,
    status: input.status,
    review_note: input.review_note?.trim() || null,
    reviewed_by: user.uid,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function refreshOfflineCohortMetrics(
  cohortId: string,
): Promise<OfflineCohortMetricsSnapshot> {
  await requireOfflineManager();
  const [sessions, enrollments] = await Promise.all([
    listOfflineSessions(cohortId),
    listOfflineEnrollments(cohortId),
  ]);
  const snapshot: OfflineCohortMetricsSnapshot = {
    sessions_total: sessions.length,
    enrolled_students: enrollments.filter((item) => item.status !== "withdrawn").length,
    published_recordings: sessions.filter((item) => !!item.recording_url).length,
    assignments_total: sessions.filter((item) => !!item.assignment_title).length,
    updated_at: new Date().toISOString(),
  };
  await updateOfflineCohort(cohortId, { metrics_snapshot: snapshot });
  return snapshot;
}

export async function refreshOfflineCourseMetrics(
  courseId: string,
): Promise<OfflineCourseMetricsSnapshot> {
  await requireOfflineManager();
  const cohorts = await listOfflineCohortsForCourse(courseId);
  const snapshot: OfflineCourseMetricsSnapshot = {
    cohorts_total: cohorts.length,
    active_cohorts: cohorts.filter((item) => item.status === "published" || item.status === "running")
      .length,
    enrolled_students: cohorts.reduce(
      (sum, item) => sum + item.metrics_snapshot.enrolled_students,
      0,
    ),
    published_recordings: cohorts.reduce(
      (sum, item) => sum + item.metrics_snapshot.published_recordings,
      0,
    ),
    updated_at: new Date().toISOString(),
  };
  await updateOfflineCourse(courseId, { metrics_snapshot: snapshot });
  return snapshot;
}

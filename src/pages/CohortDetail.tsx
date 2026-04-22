import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useParams } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReportIssueLink } from "@/components/feedback/ReportIssueLink";
import { ProfileCombobox } from "@/components/ui/profile-combobox";
import {
  createGoogleMeetSpaceForOfflineSession,
  createOfflineCohort,
  createOfflineEnrollment,
  getMyOfflineEnrollment,
  getOfflineCourse,
  listMyOfflineAssignmentSubmissions,
  listMyOfflineAttendance,
  listMyOfflineEnrollments,
  listOfflineAssignmentSubmissions,
  listOfflineAttendance,
  listOfflineCohortsForCourse,
  listOfflineEnrollments,
  listOfflineSessions,
  reviewOfflineAssignmentSubmission,
  saveOfflineSession,
  upsertOfflineAssignmentSubmission,
  upsertOfflineAttendance,
  updateOfflineCohort,
  updateOfflineCourse,
  updateOfflineEnrollmentRoadmap,
} from "@/lib/offline";
import { getAllProfiles, listCoreliaInstructorProfiles } from "@/lib/profile";
import {
  canCoordinateOfflineRoster,
  canManageOfflineAcademy,
  canManageOfflineCohort,
} from "@/lib/permissions";
import { useAuth } from "@/stores/authStore";
import type { Profile } from "@/types/database";
import {
  getOfflineAssignmentSubmissionStatusLabel,
  getOfflineAttendanceSourceLabel,
  getOfflineAttendanceStatusLabel,
  getOfflineCohortStatusLabel,
  getOfflineDeliveryModeLabel,
  getOfflineEnrollmentStatusLabel,
  getOfflineMeetingLifecycleStatusLabel,
  getOfflineMeetingProviderLabel,
  getOfflineRecordingSyncStatusLabel,
} from "@/types/offline";
import type {
  OfflineAssignmentSubmission,
  OfflineAssignmentSubmissionStatus,
  OfflineAttendanceRecord,
  OfflineAttendanceStatus,
  OfflineCourse,
  OfflineCohort,
  OfflineCohortEnrollment,
  OfflineCohortSession,
  OfflineEnrollmentStatus,
} from "@/types/offline";

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "Chưa lên lịch";
  const startText = new Date(start).toLocaleString("vi-VN");
  if (!end) return startText;
  return `${startText} - ${new Date(end).toLocaleString("vi-VN")}`;
}

function toIsoOrNull(value: string): string | null {
  if (!value.trim()) return null;
  return new Date(value).toISOString();
}

export default function CohortDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { profile } = useAuth();
  const isManageView = location.pathname.endsWith("/manage");

  const [course, setCourse] = useState<OfflineCourse | null>(null);
  const [cohorts, setCohorts] = useState<OfflineCohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [sessions, setSessions] = useState<OfflineCohortSession[]>([]);
  const [enrollments, setEnrollments] = useState<OfflineCohortEnrollment[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<OfflineAttendanceRecord[]>([]);
  const [submissionRows, setSubmissionRows] = useState<OfflineAssignmentSubmission[]>([]);
  const [myEnrollment, setMyEnrollment] = useState<OfflineCohortEnrollment | null>(null);
  const [studentProfiles, setStudentProfiles] = useState<Profile[]>([]);
  const [instructorProfiles, setInstructorProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [managerStatus, setManagerStatus] = useState<OfflineCohort["status"]>("draft");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [savingEnrollment, setSavingEnrollment] = useState(false);
  const [savingNewCohort, setSavingNewCohort] = useState(false);
  const [savingCourseSettings, setSavingCourseSettings] = useState(false);
  const [savingRoadmapId, setSavingRoadmapId] = useState<string | null>(null);
  const [savingAttendanceKey, setSavingAttendanceKey] = useState<string | null>(null);
  const [savingSubmissionSessionId, setSavingSubmissionSessionId] = useState<string | null>(
    null,
  );
  const [savingReviewSubmissionId, setSavingReviewSubmissionId] = useState<string | null>(
    null,
  );
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedAttendanceSessionId, setSelectedAttendanceSessionId] = useState("");
  const [selectedSubmissionSessionId, setSelectedSubmissionSessionId] = useState("");
  const [sessionForm, setSessionForm] = useState({
    week_index: "1",
    title: "",
    summary: "",
    starts_at: "",
    ends_at: "",
    location_label: "",
    location_address: "",
    zoom_join_url: "",
    zoom_start_url: "",
    meeting_status: "scheduled",
    attendance_source: "manual",
    recording_sync_status: "not_expected",
    recording_ready_at: "",
    zoom_recording_count: "0",
    last_zoom_sync_at: "",
    recording_url: "",
    assignment_title: "",
    assignment_description: "",
    assignment_due_at: "",
  });
  const [roadmapDrafts, setRoadmapDrafts] = useState<
    Record<
      string,
      {
        status: OfflineEnrollmentStatus;
        progress_percent: string;
        completed_sessions: string;
        assignment_completion_percent: string;
        mentor_note: string;
      }
    >
  >({});
  const [attendanceDrafts, setAttendanceDrafts] = useState<
    Record<string, { status: OfflineAttendanceStatus; note: string }>
  >({});
  const [submissionDrafts, setSubmissionDrafts] = useState<
    Record<string, { submission_text: string; proof_url: string }>
  >({});
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});
  const [newCohortForm, setNewCohortForm] = useState({
    title: "",
    tagline: "",
    status: "draft" as OfflineCohort["status"],
    delivery_mode: "offline" as OfflineCohort["delivery_mode"],
    meeting_provider: "google_meet" as OfflineCohort["meeting_provider"],
    venue_name: "",
    venue_address: "",
    city: "",
    instructor_id: "",
    instructor_name: "",
    zoom_host_email: "",
    default_zoom_join_url: "",
    default_zoom_start_url: "",
    starts_at: "",
    ends_at: "",
    registration_notes: "",
  });
  const [courseSettingsForm, setCourseSettingsForm] = useState({
    title: "",
    tagline: "",
    description: "",
    level: "all" as OfflineCourse["level"],
    venue_city: "",
    instructor_ids: [] as string[],
    certificate_title: "",
    price_note: "",
    learning_outcomes: "",
    published: false,
  });

  const selectedCohort = useMemo(
    () => cohorts.find((item) => item.id === selectedCohortId) ?? null,
    [cohorts, selectedCohortId],
  );
  const canManageCourse = canManageOfflineAcademy(profile);
  const canManage = canManageOfflineCohort(selectedCohort, profile);
  const canCoordinateRosterAccess = canCoordinateOfflineRoster(profile);
  const canSeePrivateOps = canManage || !!myEnrollment;
  const assignmentSessions = useMemo(
    () => sessions.filter((item) => !!item.assignment_title),
    [sessions],
  );
  const submissionsForSelectedSession = useMemo(
    () =>
      submissionRows.filter((item) => item.session_id === selectedSubmissionSessionId),
    [selectedSubmissionSessionId, submissionRows],
  );
  const canCreateCohort = useMemo(
    () =>
      newCohortForm.title.trim().length >= 3 &&
      newCohortForm.tagline.trim().length >= 12 &&
      newCohortForm.instructor_id.trim().length >= 3,
    [newCohortForm],
  );
  const instructorPickerOptions = useMemo(
    () =>
      instructorProfiles.map((item) => ({
        id: item.id,
        label: item.full_name || item.email || item.id,
        description: item.email || item.instructor_organization || item.id,
      })),
    [instructorProfiles],
  );
  const selectedNewCohortInstructor = useMemo(
    () =>
      instructorProfiles.find((item) => item.id === newCohortForm.instructor_id) ?? null,
    [instructorProfiles, newCohortForm.instructor_id],
  );
  const courseInstructorNames = useMemo(
    () =>
      courseSettingsForm.instructor_ids
        .map((id) => {
          const profileRow = instructorProfiles.find((item) => item.id === id);
          return profileRow?.full_name || profileRow?.email || profileRow?.id;
        })
        .filter(Boolean) as string[],
    [courseSettingsForm.instructor_ids, instructorProfiles],
  );

  useEffect(() => {
    let active = true;
    void listCoreliaInstructorProfiles()
      .then((rows) => {
        if (!active) return;
        setInstructorProfiles(rows);
      })
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : "Không thể tải danh sách giảng viên Corelia.",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedNewCohortInstructor) return;
    setNewCohortForm((prev) => ({
      ...prev,
      instructor_name:
        selectedNewCohortInstructor.full_name ||
        selectedNewCohortInstructor.email ||
        selectedNewCohortInstructor.id,
      zoom_host_email: prev.zoom_host_email || selectedNewCohortInstructor.email || "",
    }));
    setCourseSettingsForm((prev) =>
      prev.instructor_ids.includes(selectedNewCohortInstructor.id)
        ? prev
        : {
            ...prev,
            instructor_ids: [...prev.instructor_ids, selectedNewCohortInstructor.id],
          },
    );
  }, [selectedNewCohortInstructor]);

  useEffect(() => {
    if (!selectedCohort) return;
    setSessionForm((prev) => ({
      ...prev,
      zoom_join_url:
        !prev.zoom_join_url && selectedCohort.default_zoom_join_url
          ? selectedCohort.default_zoom_join_url
          : prev.zoom_join_url,
      zoom_start_url:
        !prev.zoom_start_url && selectedCohort.default_zoom_start_url
          ? selectedCohort.default_zoom_start_url
          : prev.zoom_start_url,
      attendance_source:
        prev.attendance_source === "manual" &&
        selectedCohort.meeting_provider === "google_meet"
          ? "zoom_import"
          : prev.attendance_source,
      recording_sync_status:
        prev.recording_sync_status === "not_expected" &&
        selectedCohort.meeting_provider === "google_meet"
          ? "pending"
          : prev.recording_sync_status,
    }));
  }, [selectedCohort]);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [courseRow, cohortRows] = await Promise.all([
        getOfflineCourse(id),
        listOfflineCohortsForCourse(id),
      ]);
      if (!courseRow) {
        setError("Không tìm thấy khoá học offline.");
        setCourse(null);
        return;
      }

      setCourse(courseRow);
      setCourseSettingsForm({
        title: courseRow.title,
        tagline: courseRow.tagline,
        description: courseRow.description ?? "",
        level: courseRow.level,
        venue_city: courseRow.venue_city ?? "",
        instructor_ids: courseRow.instructor_ids ?? [],
        certificate_title: courseRow.certificate_title ?? "",
        price_note: courseRow.price_note ?? "",
        learning_outcomes: courseRow.learning_outcomes ?? "",
        published: courseRow.published,
      });
      setCohorts(cohortRows);
      setNewCohortForm((prev) => ({
        ...prev,
        tagline: prev.tagline || courseRow.tagline,
        city: prev.city || courseRow.venue_city || "",
        zoom_host_email: prev.zoom_host_email || profile?.email || "",
      }));

      const manageableCohort = cohortRows.find((item) => canManageOfflineCohort(item, profile));
      const myEnrollments = manageableCohort
        ? []
        : await listMyOfflineEnrollments().catch(() => []);
      const myCourseEnrollments = myEnrollments.filter((enrollment) =>
        cohortRows.some((item) => item.id === enrollment.cohort_id),
      );

      const nextSelected =
        (selectedCohortId && cohortRows.some((item) => item.id === selectedCohortId)
          ? selectedCohortId
          : "") ||
        manageableCohort?.id ||
        myCourseEnrollments[0]?.cohort_id ||
        cohortRows[0]?.id ||
        "";

      if (nextSelected && nextSelected !== selectedCohortId) {
        setSelectedCohortId(nextSelected);
      }

      const activeCohort = cohortRows.find((item) => item.id === nextSelected) ?? null;
      if (!activeCohort) {
        setSessions([]);
        setEnrollments([]);
        setAttendanceRows([]);
        setSubmissionRows([]);
        setMyEnrollment(null);
        setManagerStatus("draft");
        return;
      }

      setManagerStatus(activeCohort.status);
      const managerView = canManageOfflineCohort(activeCohort, profile);

      const [sessionRows, myEnrollmentRow] = await Promise.all([
        listOfflineSessions(activeCohort.id),
        managerView
          ? Promise.resolve(null)
          : getMyOfflineEnrollment(activeCohort.id).catch(() => null),
      ]);

      setSessions(sessionRows);
      setMyEnrollment(myEnrollmentRow);

      if (!selectedAttendanceSessionId && sessionRows[0]?.id) {
        setSelectedAttendanceSessionId(sessionRows[0].id);
      }
      const firstAssignmentSession = sessionRows.find((item) => !!item.assignment_title);
      if (!selectedSubmissionSessionId && firstAssignmentSession?.id) {
        setSelectedSubmissionSessionId(firstAssignmentSession.id);
      }

      if (managerView) {
        const [roster, attendance, submissions] = await Promise.all([
          listOfflineEnrollments(activeCohort.id),
          listOfflineAttendance(activeCohort.id),
          listOfflineAssignmentSubmissions(activeCohort.id),
        ]);
        setEnrollments(roster);
        setAttendanceRows(attendance);
        setSubmissionRows(submissions);
        setRoadmapDrafts(
          Object.fromEntries(
            roster.map((item) => [
              item.user_id,
              {
                status: item.status,
                progress_percent: String(item.progress_percent ?? 0),
                completed_sessions: String(item.completed_sessions ?? 0),
                assignment_completion_percent: String(
                  item.assignment_completion_percent ?? 0,
                ),
                mentor_note: item.mentor_note ?? "",
              },
            ]),
          ),
        );
        setAttendanceDrafts(
          Object.fromEntries(
            attendance.map((item) => [
              `${item.session_id}:${item.user_id}`,
              { status: item.status, note: item.note ?? "" },
            ]),
          ),
        );
        setReviewDrafts(
          Object.fromEntries(submissions.map((item) => [item.id, item.review_note ?? ""])),
        );

        if (canCoordinateOfflineRoster(profile)) {
          const profiles = await getAllProfiles();
          setStudentProfiles(profiles.filter((item) => item.role === "student"));
        }
      } else {
        setEnrollments([]);
        const [attendance, submissions] = myEnrollmentRow
          ? await Promise.all([
              listMyOfflineAttendance(activeCohort.id),
              listMyOfflineAssignmentSubmissions(activeCohort.id),
            ])
          : [[], []];
        setAttendanceRows(attendance);
        setSubmissionRows(submissions);
        setSubmissionDrafts(
          Object.fromEntries(
            submissions.map((item) => [
              item.session_id,
              {
                submission_text: item.submission_text ?? "",
                proof_url: item.proof_url ?? "",
              },
            ]),
          ),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải khoá học offline.");
    } finally {
      setLoading(false);
    }
  }, [
    id,
    profile,
    selectedAttendanceSessionId,
    selectedCohortId,
    selectedSubmissionSessionId,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const availableStudents = useMemo(
    () =>
      studentProfiles.filter(
        (item) => !enrollments.some((enrollment) => enrollment.user_id === item.id),
      ),
    [enrollments, studentProfiles],
  );

  async function handleSaveStatus() {
    if (!selectedCohort || !canManage || managerStatus === selectedCohort.status || savingStatus) {
      return;
    }
    setSavingStatus(true);
    try {
      await updateOfflineCohort(selectedCohort.id, { status: managerStatus });
      toast.success("Đã cập nhật trạng thái cohort.");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể cập nhật trạng thái.");
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleAddSession() {
    if (
      !selectedCohort ||
      !canManage ||
      savingSession ||
      sessionForm.title.trim().length < 3 ||
      !sessionForm.starts_at ||
      !sessionForm.ends_at
    ) {
      return;
    }
    setSavingSession(true);
    try {
      const createdSession = await saveOfflineSession(selectedCohort.id, {
        week_index: Number(sessionForm.week_index) || 1,
        title: sessionForm.title,
        summary: sessionForm.summary,
        starts_at: new Date(sessionForm.starts_at).toISOString(),
        ends_at: new Date(sessionForm.ends_at).toISOString(),
        location_label: sessionForm.location_label,
        location_address: sessionForm.location_address,
        zoom_join_url: sessionForm.zoom_join_url,
        zoom_start_url: sessionForm.zoom_start_url,
        meeting_status: sessionForm.meeting_status as OfflineCohortSession["meeting_status"],
        attendance_source:
          sessionForm.attendance_source as OfflineCohortSession["attendance_source"],
        recording_sync_status:
          sessionForm.recording_sync_status as OfflineCohortSession["recording_sync_status"],
        recording_ready_at: sessionForm.recording_ready_at
          ? new Date(sessionForm.recording_ready_at).toISOString()
          : null,
        zoom_recording_count: Number(sessionForm.zoom_recording_count) || 0,
        last_zoom_sync_at: sessionForm.last_zoom_sync_at
          ? new Date(sessionForm.last_zoom_sync_at).toISOString()
          : null,
        recording_url: sessionForm.recording_url,
        assignment_title: sessionForm.assignment_title,
        assignment_description: sessionForm.assignment_description,
        assignment_due_at: sessionForm.assignment_due_at
          ? new Date(sessionForm.assignment_due_at).toISOString()
          : null,
      });

      let sessionCreatedWithMeet = false;
      if (
        course &&
        selectedCohort.meeting_provider === "google_meet" &&
        selectedCohort.zoom_host_email?.trim()
      ) {
        try {
          await createGoogleMeetSpaceForOfflineSession({
            courseId: course.id,
            cohortId: selectedCohort.id,
            sessionId: createdSession.id,
          });
          sessionCreatedWithMeet = true;
        } catch (meetErr) {
          toast.error(
            meetErr instanceof Error
              ? meetErr.message
              : "Đã tạo buổi học nhưng không thể tạo Google Meet tự động.",
          );
        }
      }

      setSessionForm({
        week_index: String(sessions.length + 2),
        title: "",
        summary: "",
        starts_at: "",
        ends_at: "",
        location_label: "",
        location_address: "",
        zoom_join_url: selectedCohort.default_zoom_join_url ?? "",
        zoom_start_url: selectedCohort.default_zoom_start_url ?? "",
        meeting_status: "scheduled",
        attendance_source:
          selectedCohort.meeting_provider === "google_meet" ? "zoom_import" : "manual",
        recording_sync_status:
          selectedCohort.meeting_provider === "google_meet" ? "pending" : "not_expected",
        recording_ready_at: "",
        zoom_recording_count: "0",
        last_zoom_sync_at: "",
        recording_url: "",
        assignment_title: "",
        assignment_description: "",
        assignment_due_at: "",
      });
      toast.success(
        sessionCreatedWithMeet
          ? "Đã thêm buổi học và tạo Google Meet tự động."
          : "Đã thêm buổi học.",
      );
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể thêm buổi học.");
    } finally {
      setSavingSession(false);
    }
  }

  async function handleAddStudent() {
    if (!selectedCohort || !canCoordinateRosterAccess || !selectedStudentId || savingEnrollment) return;
    const selectedProfile = studentProfiles.find((item) => item.id === selectedStudentId);
    if (!selectedProfile) return;
    setSavingEnrollment(true);
    try {
      await createOfflineEnrollment(selectedCohort.id, {
        user_id: selectedProfile.id,
        student_name: selectedProfile.full_name,
        student_email: selectedProfile.email,
      });
      setSelectedStudentId("");
      toast.success("Đã thêm học viên vào cohort.");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể thêm học viên.");
    } finally {
      setSavingEnrollment(false);
    }
  }

  async function handleCreateCohort() {
    if (!id || !canManageCourse || savingNewCohort || !canCreateCohort) return;
    setSavingNewCohort(true);
    try {
      const created = await createOfflineCohort({
        offline_course_id: id,
        title: newCohortForm.title,
        tagline: newCohortForm.tagline,
        status: newCohortForm.status,
        delivery_mode: newCohortForm.delivery_mode,
        meeting_provider: newCohortForm.meeting_provider,
        venue_name: newCohortForm.venue_name,
        venue_address: newCohortForm.venue_address,
        city: newCohortForm.city,
        instructor_id: newCohortForm.instructor_id,
        instructor_name: newCohortForm.instructor_name,
        zoom_host_email: newCohortForm.zoom_host_email,
        default_zoom_join_url: newCohortForm.default_zoom_join_url,
        default_zoom_start_url: newCohortForm.default_zoom_start_url,
        starts_at: toIsoOrNull(newCohortForm.starts_at),
        ends_at: toIsoOrNull(newCohortForm.ends_at),
        registration_notes: newCohortForm.registration_notes,
      });
      setSelectedCohortId(created.id);
      setNewCohortForm({
        title: "",
        tagline: course?.tagline || "",
        status: "draft",
        delivery_mode: "offline",
        meeting_provider: "google_meet",
        venue_name: "",
        venue_address: "",
        city: course?.venue_city || "",
        instructor_id: "",
        instructor_name: "",
        zoom_host_email: "",
        default_zoom_join_url: "",
        default_zoom_start_url: "",
        starts_at: "",
        ends_at: "",
        registration_notes: "",
      });
      toast.success("Đã tạo cohort mới cho khoá học.");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể tạo cohort mới.");
    } finally {
      setSavingNewCohort(false);
    }
  }

  async function handleSaveCourseSettings() {
    if (!id || !canManageCourse || savingCourseSettings) return;
    if (
      courseSettingsForm.title.trim().length < 3 ||
      courseSettingsForm.tagline.trim().length < 12
    ) {
      toast.error("Tên khoá học và tagline chưa đủ rõ.");
      return;
    }
    if (courseSettingsForm.instructor_ids.length === 0) {
      toast.error("Hãy chọn ít nhất một giảng viên phụ trách cho khoá.");
      return;
    }
    setSavingCourseSettings(true);
    try {
      await updateOfflineCourse(id, {
        title: courseSettingsForm.title,
        tagline: courseSettingsForm.tagline,
        description: courseSettingsForm.description,
        level: courseSettingsForm.level,
        venue_city: courseSettingsForm.venue_city,
        instructor_ids: courseSettingsForm.instructor_ids,
        instructor_names: courseInstructorNames,
        certificate_title: courseSettingsForm.certificate_title,
        price_note: courseSettingsForm.price_note,
        learning_outcomes: courseSettingsForm.learning_outcomes,
        published: courseSettingsForm.published,
      });
      toast.success("Đã cập nhật thông tin khoá offline.");
      await loadData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không thể cập nhật khoá học offline.",
      );
    } finally {
      setSavingCourseSettings(false);
    }
  }

  async function handleSaveRoadmap(userId: string) {
    if (!selectedCohort || !canManage || savingRoadmapId) return;
    const draft = roadmapDrafts[userId];
    if (!draft) return;
    setSavingRoadmapId(userId);
    try {
      await updateOfflineEnrollmentRoadmap(selectedCohort.id, userId, {
        status: draft.status,
        progress_percent: Number(draft.progress_percent) || 0,
        completed_sessions: Number(draft.completed_sessions) || 0,
        assignment_completion_percent: Number(draft.assignment_completion_percent) || 0,
        mentor_note: draft.mentor_note,
      });
      toast.success("Đã cập nhật roadmap học viên.");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể cập nhật roadmap.");
    } finally {
      setSavingRoadmapId(null);
    }
  }

  async function handleSaveAttendance(sessionId: string, userId: string, studentName: string | null) {
    if (!selectedCohort || !canManage || savingAttendanceKey) return;
    const key = `${sessionId}:${userId}`;
    const draft = attendanceDrafts[key];
    if (!draft) return;
    setSavingAttendanceKey(key);
    try {
      await upsertOfflineAttendance(selectedCohort.id, sessionId, userId, studentName, draft);
      toast.success("Đã cập nhật điểm danh.");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể lưu điểm danh.");
    } finally {
      setSavingAttendanceKey(null);
    }
  }

  async function handleSaveAssignmentSubmission(sessionId: string) {
    if (!selectedCohort || !myEnrollment || savingSubmissionSessionId) return;
    const draft = submissionDrafts[sessionId];
    if (!draft) return;
    setSavingSubmissionSessionId(sessionId);
    try {
      await upsertOfflineAssignmentSubmission(selectedCohort.id, sessionId, draft);
      toast.success("Đã lưu bài nộp.");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể lưu bài nộp.");
    } finally {
      setSavingSubmissionSessionId(null);
    }
  }

  async function handleReviewSubmission(
    submissionId: string,
    sessionId: string,
    userId: string,
    status: Exclude<OfflineAssignmentSubmissionStatus, "pending">,
  ) {
    if (!selectedCohort || !canManage || savingReviewSubmissionId) return;
    setSavingReviewSubmissionId(submissionId);
    try {
      await reviewOfflineAssignmentSubmission(selectedCohort.id, sessionId, userId, {
        status,
        review_note: reviewDrafts[submissionId] ?? "",
      });
      toast.success("Đã cập nhật kết quả bài tập.");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể review bài nộp.");
    } finally {
      setSavingReviewSubmissionId(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1990px] px-4 py-10 text-center text-muted-foreground">
        Đang tải khoá học offline...
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="mx-auto max-w-[1990px] px-4 py-10 text-center">
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-5 shadow-card">
          <p className="text-[15px] font-medium text-destructive">
            {error || "Không tìm thấy khoá học offline."}
          </p>
          <div className="mt-3 flex justify-center">
            <ReportIssueLink className="h-8 rounded-full px-3 text-xs text-destructive hover:text-destructive" />
          </div>
        </div>
      </div>
    );
  }

  if (isManageView && selectedCohort && !canManage) {
    return (
      <div className="mx-auto max-w-[1990px] px-4 py-10 text-center text-muted-foreground">
        Bạn không có quyền vào workspace của khoá học này.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mb-4">
        <Button
          render={<NavLink to={isManageView ? "/instructor/cohorts" : "/cohorts"} />}
          nativeButton={false}
          variant="ghost"
        >
          Quay lại
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <Card>
            <CardContent className="p-5 sm:p-6">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {isManageView ? "Workspace khoá học offline" : "Khoá học offline"}
              </div>
              <h1 className="mt-2 text-3xl font-normal tracking-tight text-foreground">
                {course.title}
              </h1>
              <p className="mt-2 text-[15px] leading-7 text-muted-foreground">
                {course.tagline}
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-border-subtle bg-background p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Thành phố
                  </div>
                  <div className="mt-2 text-sm text-foreground">
                    {course.venue_city || "Cập nhật sau"}
                  </div>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-background p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Cohorts
                  </div>
                  <div className="mt-2 text-sm text-foreground">
                    {course.metrics_snapshot.cohorts_total}
                  </div>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-background p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Học viên active
                  </div>
                  <div className="mt-2 text-sm text-foreground">
                    {course.metrics_snapshot.enrolled_students}
                  </div>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-background p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Recording
                  </div>
                  <div className="mt-2 text-sm text-foreground">
                    {course.metrics_snapshot.published_recordings}
                  </div>
                </div>
              </div>

              {cohorts.length > 0 ? (
                <div className="mt-5">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Chọn cohort để xem chi tiết
                  </div>
                  <select
                    value={selectedCohortId}
                    onChange={(e) => setSelectedCohortId(e.target.value)}
                    className="mt-3 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    {cohorts.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title} · {getOfflineCohortStatusLabel(item.status)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {course.description ? (
            <Card>
              <CardContent className="p-5 sm:p-6">
                <h2 className="text-lg font-medium text-foreground">Tổng quan khoá học</h2>
                <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-muted-foreground">
                  {course.description}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {isManageView && canManageCourse ? (
            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-foreground">
                      Thông tin khoá học offline
                    </h2>
                    <p className="mt-1.5 text-[14px] leading-6 text-muted-foreground">
                      Đây là lớp thông tin gốc của khoá. Mọi cohort bên dưới sẽ dùng chung ngữ
                      cảnh chương trình, chứng nhận và thông tin công khai này.
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1.5 text-[12px] font-medium text-foreground">
                    {courseSettingsForm.published ? "Đang hiển thị công khai" : "Đang ẩn"}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <input
                    value={courseSettingsForm.title}
                    onChange={(e) =>
                      setCourseSettingsForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    placeholder="Tên khoá học offline"
                  />
                  <input
                    value={courseSettingsForm.tagline}
                    onChange={(e) =>
                      setCourseSettingsForm((prev) => ({ ...prev, tagline: e.target.value }))
                    }
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    placeholder="Tagline mô tả khoá học"
                  />
                  <select
                    value={courseSettingsForm.level}
                    onChange={(e) =>
                      setCourseSettingsForm((prev) => ({
                        ...prev,
                        level: e.target.value as OfflineCourse["level"],
                      }))
                    }
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    <option value="all">Mọi trình độ</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                  <input
                    value={courseSettingsForm.venue_city}
                    onChange={(e) =>
                      setCourseSettingsForm((prev) => ({
                        ...prev,
                        venue_city: e.target.value,
                      }))
                    }
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    placeholder="Thành phố triển khai chính"
                  />
                  <div className="xl:col-span-2">
                    <ProfileCombobox
                      title="Chọn giảng viên phụ trách"
                      description="Một khoá offline có thể có nhiều giảng viên nội bộ Corelia cùng phụ trách."
                      options={instructorPickerOptions}
                      placeholder="Chọn giảng viên phụ trách của khoá"
                      value={courseSettingsForm.instructor_ids}
                      onChange={(value) =>
                        setCourseSettingsForm((prev) => ({
                          ...prev,
                          instructor_ids: value as string[],
                        }))
                      }
                      multiple
                    />
                  </div>
                  <input
                    value={courseSettingsForm.certificate_title}
                    onChange={(e) =>
                      setCourseSettingsForm((prev) => ({
                        ...prev,
                        certificate_title: e.target.value,
                      }))
                    }
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    placeholder="Tên chứng nhận"
                  />
                  <input
                    value={courseSettingsForm.price_note}
                    onChange={(e) =>
                      setCourseSettingsForm((prev) => ({
                        ...prev,
                        price_note: e.target.value,
                      }))
                    }
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    placeholder="Ghi chú học phí / đăng ký"
                  />
                </div>

                {courseInstructorNames.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {courseInstructorNames.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-2.5 py-1 text-[12px] font-medium text-foreground"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : null}

                <textarea
                  value={courseSettingsForm.description}
                  onChange={(e) =>
                    setCourseSettingsForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows={5}
                  className="mt-4 min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Mô tả tổng quan khoá học offline"
                />
                <textarea
                  value={courseSettingsForm.learning_outcomes}
                  onChange={(e) =>
                    setCourseSettingsForm((prev) => ({
                      ...prev,
                      learning_outcomes: e.target.value,
                    }))
                  }
                  rows={4}
                  className="mt-4 min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Chuẩn đầu ra, kỹ năng, kết quả học tập mong đợi"
                />

                <label className="mt-4 flex items-center gap-3 rounded-2xl border border-border-subtle bg-background px-4 py-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={courseSettingsForm.published}
                    onChange={(e) =>
                      setCourseSettingsForm((prev) => ({
                        ...prev,
                        published: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  Hiển thị khoá này ở khu công khai cho học viên xem và tìm cohort phù hợp
                </label>

                <div className="mt-4 flex justify-end">
                  <Button
                    disabled={savingCourseSettings}
                    onClick={() => void handleSaveCourseSettings()}
                  >
                    {savingCourseSettings ? "Đang lưu..." : "Lưu thông tin khoá học"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {isManageView && canManageCourse ? (
            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-foreground">Các cohort của khoá</h2>
                    <p className="mt-1.5 text-[14px] leading-6 text-muted-foreground">
                      Mỗi cohort là một đợt mở lớp riêng, có lịch học, roster, recording và
                      roadmap học viên tách biệt.
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {cohorts.length} cohort{cohorts.length === 1 ? "" : "s"}
                  </div>
                </div>

                {cohorts.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-dashed border-border-subtle bg-background px-4 py-5 text-sm text-muted-foreground">
                    Khoá này chưa có cohort nào. Tạo cohort đầu tiên ở ngay bên dưới để bắt
                    đầu lên lịch học và xếp học viên.
                  </div>
                ) : (
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    {cohorts.map((item, index) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedCohortId(item.id)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          item.id === selectedCohortId
                            ? "border-primary bg-primary/5"
                            : "border-border-subtle bg-background hover:border-border"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-medium text-foreground">{item.title}</div>
                          <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1 text-[11px] font-medium text-foreground">
                            {getOfflineCohortStatusLabel(item.status)}
                          </span>
                        </div>
                        <div className="mt-2 text-[13px] text-muted-foreground">
                          Đợt {index + 1} · {formatDateRange(item.starts_at, item.ends_at)}
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-xl border border-border-subtle bg-card px-3 py-2">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                              Học viên
                            </div>
                            <div className="mt-1 text-sm text-foreground">
                              {item.metrics_snapshot.enrolled_students}
                            </div>
                          </div>
                          <div className="rounded-xl border border-border-subtle bg-card px-3 py-2">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                              Buổi học
                            </div>
                            <div className="mt-1 text-sm text-foreground">
                              {item.metrics_snapshot.sessions_total}
                            </div>
                          </div>
                          <div className="rounded-xl border border-border-subtle bg-card px-3 py-2">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                              Recording
                            </div>
                            <div className="mt-1 text-sm text-foreground">
                              {item.metrics_snapshot.published_recordings}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {isManageView && canManageCourse ? (
            <Card>
              <CardContent className="p-5 sm:p-6">
                <h2 className="text-lg font-medium text-foreground">Mở cohort mới</h2>
                <p className="mt-1.5 text-[14px] leading-6 text-muted-foreground">
                  Dùng khi khoá offline mở thêm đợt học mới, đổi lịch khai giảng, đổi giảng
                  viên hoặc tách batch theo địa điểm.
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <input
                    value={newCohortForm.title}
                    onChange={(e) =>
                      setNewCohortForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    placeholder="Tên cohort, ví dụ Cohort 2 · Tối T3 T5"
                  />
                  <input
                    value={newCohortForm.tagline}
                    onChange={(e) =>
                      setNewCohortForm((prev) => ({ ...prev, tagline: e.target.value }))
                    }
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    placeholder="Tagline cho cohort này"
                  />
                  <select
                    value={newCohortForm.status}
                    onChange={(e) =>
                      setNewCohortForm((prev) => ({
                        ...prev,
                        status: e.target.value as OfflineCohort["status"],
                      }))
                    }
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    <option value="draft">Bản nháp</option>
                    <option value="published">Mở ghi danh</option>
                    <option value="running">Đang diễn ra</option>
                    <option value="completed">Đã hoàn thành</option>
                  </select>
                  <select
                    value={newCohortForm.delivery_mode}
                    onChange={(e) =>
                      setNewCohortForm((prev) => ({
                        ...prev,
                        delivery_mode: e.target.value as OfflineCohort["delivery_mode"],
                      }))
                    }
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    <option value="offline">Học trực tiếp</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                  <select
                    value={newCohortForm.meeting_provider}
                    onChange={(e) =>
                      setNewCohortForm((prev) => ({
                        ...prev,
                        meeting_provider: e.target.value as OfflineCohort["meeting_provider"],
                      }))
                    }
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    <option value="google_meet">Google Meet</option>
                    <option value="manual">Không dùng họp online</option>
                  </select>
                  <div className="md:col-span-2 xl:col-span-2">
                    <ProfileCombobox
                      title="Chọn giảng viên đứng lớp"
                      description="Mỗi cohort chỉ có một giảng viên phụ trách chính. Khi chọn ở đây, giảng viên đó cũng được thêm vào danh sách phụ trách của khoá nếu chưa có."
                      options={instructorPickerOptions}
                      placeholder="Chọn giảng viên cho cohort này"
                      value={newCohortForm.instructor_id}
                      onChange={(value) =>
                        setNewCohortForm((prev) => ({
                          ...prev,
                          instructor_id: value as string,
                        }))
                      }
                    />
                  </div>
                  <input
                    value={newCohortForm.venue_name}
                    onChange={(e) =>
                      setNewCohortForm((prev) => ({ ...prev, venue_name: e.target.value }))
                    }
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    placeholder="Tên địa điểm"
                  />
                  <input
                    value={newCohortForm.venue_address}
                    onChange={(e) =>
                      setNewCohortForm((prev) => ({
                        ...prev,
                        venue_address: e.target.value,
                      }))
                    }
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    placeholder="Địa chỉ chi tiết"
                  />
                  <input
                    value={newCohortForm.city}
                    onChange={(e) =>
                      setNewCohortForm((prev) => ({ ...prev, city: e.target.value }))
                    }
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    placeholder="Thành phố"
                  />
                  <input
                    value={newCohortForm.zoom_host_email}
                    onChange={(e) =>
                      setNewCohortForm((prev) => ({
                        ...prev,
                        zoom_host_email: e.target.value,
                      }))
                    }
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    placeholder="Email host Google Meet"
                  />
                  <input
                    value={newCohortForm.default_zoom_join_url}
                    onChange={(e) =>
                      setNewCohortForm((prev) => ({
                        ...prev,
                        default_zoom_join_url: e.target.value,
                      }))
                    }
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    placeholder="Google Meet link cho học viên"
                  />
                  <input
                    value={newCohortForm.default_zoom_start_url}
                    onChange={(e) =>
                      setNewCohortForm((prev) => ({
                        ...prev,
                        default_zoom_start_url: e.target.value,
                      }))
                    }
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    placeholder="Google Meet link cho giảng viên"
                  />
                  <input
                    type="datetime-local"
                    value={newCohortForm.starts_at}
                    onChange={(e) =>
                      setNewCohortForm((prev) => ({ ...prev, starts_at: e.target.value }))
                    }
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                  />
                  <input
                    type="datetime-local"
                    value={newCohortForm.ends_at}
                    onChange={(e) =>
                      setNewCohortForm((prev) => ({ ...prev, ends_at: e.target.value }))
                    }
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </div>
                <div className="mt-4 rounded-2xl border border-border-subtle bg-background p-4 text-[13px] leading-6 text-muted-foreground">
                  Nếu cohort dùng Google Meet, link ở đây sẽ được ưu tiên hiển thị cho học
                  viên trong lịch buổi học để họ vẫn có thể tham gia online khi không đến
                  lớp trực tiếp. Các session mới cũng sẽ tự điền sẵn link này để đội ngũ
                  vận hành không phải nhập lặp lại cho từng tuần.
                </div>
                <textarea
                  value={newCohortForm.registration_notes}
                  onChange={(e) =>
                    setNewCohortForm((prev) => ({
                      ...prev,
                      registration_notes: e.target.value,
                    }))
                  }
                  rows={4}
                  className="mt-4 min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Ghi chú cho đợt mở lớp này: quy định điểm danh, phòng học, cách xem recording..."
                />
                <div className="mt-4 flex justify-end">
                  <Button
                    disabled={!canCreateCohort || savingNewCohort}
                    onClick={() => void handleCreateCohort()}
                  >
                    {savingNewCohort ? "Đang tạo..." : "Tạo cohort mới"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {selectedCohort ? (
            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-foreground">{selectedCohort.title}</h2>
                    <p className="mt-1.5 text-[14px] text-muted-foreground">
                      {selectedCohort.tagline}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1.5 text-[12px] font-medium text-foreground">
                      {getOfflineCohortStatusLabel(selectedCohort.status)}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1.5 text-[12px] font-medium text-foreground">
                      {getOfflineDeliveryModeLabel(selectedCohort.delivery_mode)}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-1.5 text-[12px] font-medium text-foreground">
                      {getOfflineMeetingProviderLabel(selectedCohort.meeting_provider)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Giảng viên
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      {selectedCohort.instructor_name}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Địa điểm
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      {selectedCohort.venue_name || selectedCohort.city || "Cập nhật sau"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Buổi học
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      {selectedCohort.metrics_snapshot.sessions_total}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      Recording
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      {selectedCohort.metrics_snapshot.published_recordings}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-5 text-sm text-muted-foreground">
                Khoá học này chưa có cohort nào.
              </CardContent>
            </Card>
          )}

          {selectedCohort ? (
            <Card>
              <CardContent className="p-5 sm:p-6">
                <h2 className="text-lg font-medium text-foreground">Lịch học từng tuần</h2>
                {!canSeePrivateOps ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-border-subtle bg-background px-4 py-5 text-sm text-muted-foreground">
                    Lịch chi tiết và recording mở cho học viên đã được xếp vào cohort hoặc đội ngũ vận hành.
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-border-subtle bg-background px-4 py-5 text-sm text-muted-foreground">
                    Chưa có buổi học nào được lên lịch.
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {sessions.map((session) => (
                      <div key={session.id} className="rounded-2xl border border-border-subtle bg-background p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
                              Tuần {session.week_index}
                            </div>
                            <div className="mt-1 text-lg font-medium text-foreground">
                              {session.title}
                            </div>
                            <div className="mt-1 text-[13px] text-muted-foreground">
                              {formatDateRange(session.starts_at, session.ends_at)}
                            </div>
                          </div>
                          <div className="text-right text-[13px] text-muted-foreground">
                            {session.location_label || selectedCohort.venue_name || "Theo lịch cập nhật"}
                          </div>
                        </div>

                        {session.summary ? (
                          <p className="mt-3 text-[14px] leading-6 text-muted-foreground">
                            {session.summary}
                          </p>
                        ) : null}

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-border-subtle p-4">
                            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                              Recording
                            </div>
                            <div className="mt-2 text-sm text-foreground">
                              {session.recording_url ? (
                                <a href={session.recording_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                                  Xem lại buổi học
                                </a>
                              ) : (
                                "Chưa có recording"
                              )}
                            </div>
                            <div className="mt-2 text-[12px] text-muted-foreground">
                              {getOfflineRecordingSyncStatusLabel(session.recording_sync_status)}
                              {session.zoom_recording_count > 0 ? ` · ${session.zoom_recording_count} file` : ""}
                            </div>
                            {session.zoom_join_url || selectedCohort.default_zoom_join_url ? (
                              <a
                                href={session.zoom_join_url || selectedCohort.default_zoom_join_url || "#"}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-flex text-sm text-primary hover:underline"
                              >
                                Vào lớp qua Google Meet khi không thể đến trực tiếp
                              </a>
                            ) : null}
                          </div>
                          <div className="rounded-2xl border border-border-subtle p-4">
                            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                              Trạng thái buổi
                            </div>
                            <div className="mt-2 text-sm text-foreground">
                              {getOfflineMeetingLifecycleStatusLabel(session.meeting_status)}
                            </div>
                            <div className="mt-1 text-[13px] text-muted-foreground">
                              Điểm danh: {getOfflineAttendanceSourceLabel(session.attendance_source)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 rounded-2xl border border-border-subtle p-4">
                          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Bài tập tuần
                          </div>
                          <div className="mt-2 text-sm text-foreground">
                            {session.assignment_title || "Không có bài tập riêng"}
                          </div>
                          {session.assignment_due_at ? (
                            <div className="mt-1 text-[13px] text-muted-foreground">
                              Hạn nộp: {new Date(session.assignment_due_at).toLocaleString("vi-VN")}
                            </div>
                          ) : null}
                        </div>

                        {!isManageView && myEnrollment ? (
                          <div className="mt-3 rounded-2xl border border-border-subtle p-4">
                            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                              Điểm danh của bạn
                            </div>
                            <div className="mt-2 text-sm text-foreground">
                              {(() => {
                                const attendance = attendanceRows.find(
                                  (item) => item.session_id === session.id,
                                );
                                return attendance
                                  ? getOfflineAttendanceStatusLabel(attendance.status)
                                  : "Chưa cập nhật";
                              })()}
                            </div>
                          </div>
                        ) : null}

                        {!isManageView && myEnrollment && session.assignment_title ? (
                          <div className="mt-4 rounded-2xl border border-border-subtle bg-card p-4">
                            <div className="text-sm font-medium text-foreground">Nộp bài cho buổi này</div>
                            <textarea
                              value={submissionDrafts[session.id]?.submission_text ?? ""}
                              onChange={(e) =>
                                setSubmissionDrafts((prev) => ({
                                  ...prev,
                                  [session.id]: {
                                    submission_text: e.target.value,
                                    proof_url: prev[session.id]?.proof_url ?? "",
                                  },
                                }))
                              }
                              rows={4}
                              className="mt-3 min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                              placeholder="Tóm tắt những gì bạn đã hoàn thành trong tuần này"
                            />
                            <input
                              value={submissionDrafts[session.id]?.proof_url ?? ""}
                              onChange={(e) =>
                                setSubmissionDrafts((prev) => ({
                                  ...prev,
                                  [session.id]: {
                                    submission_text: prev[session.id]?.submission_text ?? "",
                                    proof_url: e.target.value,
                                  },
                                }))
                              }
                              className="mt-3 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                              placeholder="Link minh chứng / repo / file"
                            />
                            <Button className="mt-3" onClick={() => void handleSaveAssignmentSubmission(session.id)} disabled={savingSubmissionSessionId === session.id}>
                              {savingSubmissionSessionId === session.id ? "Đang lưu..." : "Lưu bài nộp"}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {isManageView && selectedCohort ? (
            <>
              <Card>
                <CardContent className="p-5 sm:p-6">
                  <h2 className="text-lg font-medium text-foreground">Thêm buổi học mới</h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <input value={sessionForm.week_index} onChange={(e) => setSessionForm((prev) => ({ ...prev, week_index: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Tuần số" />
                    <input value={sessionForm.title} onChange={(e) => setSessionForm((prev) => ({ ...prev, title: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Tên buổi học" />
                    <input type="datetime-local" value={sessionForm.starts_at} onChange={(e) => setSessionForm((prev) => ({ ...prev, starts_at: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
                    <input type="datetime-local" value={sessionForm.ends_at} onChange={(e) => setSessionForm((prev) => ({ ...prev, ends_at: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
                    <input value={sessionForm.location_label} onChange={(e) => setSessionForm((prev) => ({ ...prev, location_label: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Phòng học / toà nhà" />
                    <input value={sessionForm.location_address} onChange={(e) => setSessionForm((prev) => ({ ...prev, location_address: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Địa chỉ chi tiết" />
                    <input value={sessionForm.zoom_join_url} onChange={(e) => setSessionForm((prev) => ({ ...prev, zoom_join_url: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Google Meet link cho học viên" />
                    <input value={sessionForm.zoom_start_url} onChange={(e) => setSessionForm((prev) => ({ ...prev, zoom_start_url: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Google Meet link cho giảng viên" />
                    <input value={sessionForm.recording_url} onChange={(e) => setSessionForm((prev) => ({ ...prev, recording_url: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Recording URL" />
                    <input value={sessionForm.assignment_title} onChange={(e) => setSessionForm((prev) => ({ ...prev, assignment_title: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Tên bài tập tuần" />
                    <select value={sessionForm.meeting_status} onChange={(e) => setSessionForm((prev) => ({ ...prev, meeting_status: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
                      <option value="scheduled">Đã lên lịch</option>
                      <option value="live">Đang diễn ra</option>
                      <option value="ended">Đã kết thúc</option>
                      <option value="cancelled">Đã huỷ</option>
                    </select>
                    <select value={sessionForm.attendance_source} onChange={(e) => setSessionForm((prev) => ({ ...prev, attendance_source: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
                      <option value="manual">Điểm danh nhập tay</option>
                      <option value="zoom_import">Đồng bộ từ Google Meet</option>
                    </select>
                    <select value={sessionForm.recording_sync_status} onChange={(e) => setSessionForm((prev) => ({ ...prev, recording_sync_status: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
                      <option value="not_expected">Không chờ recording</option>
                      <option value="pending">Chờ đồng bộ</option>
                      <option value="processing">Đang xử lý</option>
                      <option value="ready">Sẵn sàng</option>
                      <option value="failed">Lỗi đồng bộ</option>
                    </select>
                    <input value={sessionForm.zoom_recording_count} onChange={(e) => setSessionForm((prev) => ({ ...prev, zoom_recording_count: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Số file recording" />
                    <input type="datetime-local" value={sessionForm.assignment_due_at} onChange={(e) => setSessionForm((prev) => ({ ...prev, assignment_due_at: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
                    <input type="datetime-local" value={sessionForm.recording_ready_at} onChange={(e) => setSessionForm((prev) => ({ ...prev, recording_ready_at: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
                    <input type="datetime-local" value={sessionForm.last_zoom_sync_at} onChange={(e) => setSessionForm((prev) => ({ ...prev, last_zoom_sync_at: e.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
                  </div>
                  <textarea value={sessionForm.summary} onChange={(e) => setSessionForm((prev) => ({ ...prev, summary: e.target.value }))} rows={4} className="mt-4 min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Mục tiêu của buổi học" />
                  <textarea value={sessionForm.assignment_description} onChange={(e) => setSessionForm((prev) => ({ ...prev, assignment_description: e.target.value }))} rows={4} className="mt-4 min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Mô tả bài tập tuần" />
                  <Button className="mt-4" onClick={() => void handleAddSession()}>
                    {savingSession ? "Đang lưu..." : "Thêm buổi học"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 sm:p-6">
                  <h2 className="text-lg font-medium text-foreground">Học viên và roadmap</h2>
                  {canCoordinateRosterAccess ? (
                    <div className="mt-4 rounded-2xl border border-border-subtle bg-background p-4">
                      <div className="text-[13px] font-medium text-foreground">Thêm học viên vào cohort</div>
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                        <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm">
                          <option value="">Chọn học viên đã có tài khoản</option>
                          {availableStudents.map((student) => (
                            <option key={student.id} value={student.id}>
                              {student.full_name || student.email || student.id}
                            </option>
                          ))}
                        </select>
                        <Button type="button" disabled={!selectedStudentId || savingEnrollment} onClick={() => void handleAddStudent()}>
                          {savingEnrollment ? "Đang thêm..." : "Thêm học viên"}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-5 space-y-4">
                    {enrollments.map((item) => {
                      const draft = roadmapDrafts[item.user_id];
                      return (
                        <div key={item.id} className="rounded-2xl border border-border-subtle bg-background p-4">
                          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="text-sm font-medium text-foreground">
                                {item.student_name || item.student_email || item.user_id}
                              </div>
                              <div className="mt-1 text-[13px] text-muted-foreground">
                                {getOfflineEnrollmentStatusLabel(item.status)}
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-3 md:grid-cols-4">
                            <select value={draft?.status ?? item.status} onChange={(e) => setRoadmapDrafts((prev) => ({ ...prev, [item.user_id]: { ...prev[item.user_id], status: e.target.value as OfflineEnrollmentStatus } }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
                              <option value="active">Đang theo học</option>
                              <option value="at_risk">Cần theo dõi</option>
                              <option value="completed">Đã hoàn thành</option>
                              <option value="withdrawn">Đã rút</option>
                            </select>
                            <input value={draft?.progress_percent ?? "0"} onChange={(e) => setRoadmapDrafts((prev) => ({ ...prev, [item.user_id]: { ...prev[item.user_id], progress_percent: e.target.value } }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Tiến độ %" />
                            <input value={draft?.completed_sessions ?? "0"} onChange={(e) => setRoadmapDrafts((prev) => ({ ...prev, [item.user_id]: { ...prev[item.user_id], completed_sessions: e.target.value } }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Buổi đã học" />
                            <input value={draft?.assignment_completion_percent ?? "0"} onChange={(e) => setRoadmapDrafts((prev) => ({ ...prev, [item.user_id]: { ...prev[item.user_id], assignment_completion_percent: e.target.value } }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Bài tập %" />
                          </div>
                          <textarea value={draft?.mentor_note ?? ""} onChange={(e) => setRoadmapDrafts((prev) => ({ ...prev, [item.user_id]: { ...prev[item.user_id], mentor_note: e.target.value } }))} rows={3} className="mt-4 min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Nhận xét từ đội ngũ học tập" />
                          <div className="mt-4 flex justify-end">
                            <Button onClick={() => void handleSaveRoadmap(item.user_id)} disabled={savingRoadmapId === item.user_id}>
                              {savingRoadmapId === item.user_id ? "Đang lưu..." : "Lưu roadmap"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 sm:p-6">
                  <h2 className="text-lg font-medium text-foreground">Điểm danh theo buổi</h2>
                  {sessions.length > 0 ? (
                    <>
                      <select value={selectedAttendanceSessionId} onChange={(e) => setSelectedAttendanceSessionId(e.target.value)} className="mt-4 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
                        {sessions.map((session) => (
                          <option key={session.id} value={session.id}>
                            Tuần {session.week_index} · {session.title}
                          </option>
                        ))}
                      </select>
                      <div className="mt-5 space-y-4">
                        {enrollments.map((item) => {
                          const key = `${selectedAttendanceSessionId}:${item.user_id}`;
                          const draft = attendanceDrafts[key] ?? { status: "absent" as OfflineAttendanceStatus, note: "" };
                          return (
                            <div key={item.id} className="rounded-2xl border border-border-subtle bg-background p-4">
                              <div className="text-sm font-medium text-foreground">{item.student_name || item.student_email || item.user_id}</div>
                              <div className="mt-3 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto]">
                                <select value={draft.status} onChange={(e) => setAttendanceDrafts((prev) => ({ ...prev, [key]: { ...draft, status: e.target.value as OfflineAttendanceStatus } }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
                                  <option value="present">Có mặt</option>
                                  <option value="late">Đi muộn</option>
                                  <option value="excused">Có phép</option>
                                  <option value="absent">Vắng mặt</option>
                                </select>
                                <input value={draft.note} onChange={(e) => setAttendanceDrafts((prev) => ({ ...prev, [key]: { ...draft, note: e.target.value } }))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Ghi chú điểm danh" />
                                <Button onClick={() => void handleSaveAttendance(selectedAttendanceSessionId, item.user_id, item.student_name)} disabled={savingAttendanceKey === key}>
                                  {savingAttendanceKey === key ? "Đang lưu..." : "Lưu"}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="mt-4 text-sm text-muted-foreground">Hãy tạo buổi học trước khi điểm danh.</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 sm:p-6">
                  <h2 className="text-lg font-medium text-foreground">Review bài tập theo buổi</h2>
                  {assignmentSessions.length > 0 ? (
                    <>
                      <select value={selectedSubmissionSessionId} onChange={(e) => setSelectedSubmissionSessionId(e.target.value)} className="mt-4 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
                        {assignmentSessions.map((session) => (
                          <option key={session.id} value={session.id}>
                            Tuần {session.week_index} · {session.title}
                          </option>
                        ))}
                      </select>
                      <div className="mt-5 space-y-4">
                        {submissionsForSelectedSession.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-border-subtle bg-background px-4 py-6 text-center text-sm text-muted-foreground">
                            Chưa có bài nộp nào cho buổi này.
                          </div>
                        ) : (
                          submissionsForSelectedSession.map((submission) => (
                            <div key={submission.id} className="rounded-2xl border border-border-subtle bg-background p-4">
                              <div className="text-sm font-medium text-foreground">
                                {submission.student_name || submission.user_id}
                              </div>
                              <div className="mt-1 text-[13px] text-muted-foreground">
                                {getOfflineAssignmentSubmissionStatusLabel(submission.status)}
                              </div>
                              {submission.submission_text ? (
                                <p className="mt-3 whitespace-pre-wrap text-[14px] leading-6 text-muted-foreground">
                                  {submission.submission_text}
                                </p>
                              ) : null}
                              {submission.proof_url ? (
                                <a href={submission.proof_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm text-primary hover:underline">
                                  Mở minh chứng
                                </a>
                              ) : null}
                              <input value={reviewDrafts[submission.id] ?? ""} onChange={(e) => setReviewDrafts((prev) => ({ ...prev, [submission.id]: e.target.value }))} className="mt-4 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" placeholder="Nhận xét cho học viên" />
                              <div className="mt-4 flex flex-wrap gap-2">
                                <Button onClick={() => void handleReviewSubmission(submission.id, submission.session_id, submission.user_id, "passed")} disabled={savingReviewSubmissionId === submission.id}>
                                  Đạt yêu cầu
                                </Button>
                                <Button variant="outline" onClick={() => void handleReviewSubmission(submission.id, submission.session_id, submission.user_id, "needs_revision")} disabled={savingReviewSubmissionId === submission.id}>
                                  Cần bổ sung
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="mt-4 text-sm text-muted-foreground">Chưa có buổi nào gắn bài tập.</div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-5 sm:p-6">
              <h2 className="text-lg font-medium text-foreground">
                {isManageView ? "Điều phối khoá học" : "Thông tin chương trình"}
              </h2>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-border-subtle bg-background p-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Chứng nhận
                  </div>
                  <div className="mt-2 text-sm text-foreground">
                    {course.certificate_title || "Theo cấu hình khoá học"}
                  </div>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-background p-4">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Học phí / ghi chú
                  </div>
                  <div className="mt-2 text-sm text-foreground">
                    {course.price_note || "Cập nhật trong đợt mở cohort cụ thể"}
                  </div>
                </div>
                {selectedCohort ? (
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Thời gian cohort hiện tại
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      {formatDateRange(selectedCohort.starts_at, selectedCohort.ends_at)}
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {isManageView && selectedCohort ? (
            <>
              <Card>
                <CardContent className="p-5 sm:p-6">
                  <h2 className="text-lg font-medium text-foreground">Trạng thái cohort</h2>
                  <select value={managerStatus} onChange={(e) => setManagerStatus(e.target.value as OfflineCohort["status"])} className="mt-4 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
                    <option value="draft">Bản nháp</option>
                    <option value="published">Mở ghi danh</option>
                    <option value="running">Đang diễn ra</option>
                    <option value="completed">Đã hoàn thành</option>
                  </select>
                  <Button className="mt-4 w-full" onClick={() => void handleSaveStatus()}>
                    {savingStatus ? "Đang lưu..." : "Lưu trạng thái cohort"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5 sm:p-6">
                  <h2 className="text-lg font-medium text-foreground">Google Meet</h2>
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-border-subtle bg-background p-4">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Host email
                      </div>
                      <div className="mt-2 text-sm text-foreground">
                        {selectedCohort.zoom_host_email || "Chưa gắn host Google Meet"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border-subtle bg-background p-4">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Buổi học có link Meet
                      </div>
                      <div className="mt-2 text-sm text-foreground">
                        {sessions.filter((item) => !!item.zoom_join_url).length} buổi đã gắn link Meet
                      </div>
                    </div>
                    <div className="rounded-2xl border border-dashed border-border-subtle bg-background p-4 text-[13px] leading-6 text-muted-foreground">
                      Hiện tại hệ thống dùng Google Meet theo cách gọn hơn: lưu link tham gia
                      cho học viên, giữ trạng thái buổi học và recording trong từng session.
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : myEnrollment ? (
            <Card>
              <CardContent className="p-5 sm:p-6">
                <h2 className="text-lg font-medium text-foreground">Lộ trình của bạn</h2>
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-border-subtle bg-background p-4">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Trạng thái hiện tại
                    </div>
                    <div className="mt-2 text-sm text-foreground">
                      {getOfflineEnrollmentStatusLabel(myEnrollment.status)}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border-subtle bg-background p-4">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Tiến độ tổng
                      </div>
                      <div className="mt-2 text-lg font-semibold text-foreground">
                        {myEnrollment.progress_percent}%
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border-subtle bg-background p-4">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Bài tập hoàn thành
                      </div>
                      <div className="mt-2 text-lg font-semibold text-foreground">
                        {myEnrollment.assignment_completion_percent}%
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-5 sm:p-6">
                <h2 className="text-lg font-medium text-foreground">Cách tham gia khoá học</h2>
                <p className="mt-3 text-[14px] leading-7 text-muted-foreground">
                  Khoá học offline có thể mở nhiều cohort khác nhau. Bạn sẽ được xếp vào cohort cụ thể bởi đội ngũ Corelia để nhận lịch học, recording và bài tập theo tuần.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

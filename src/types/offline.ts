export type OfflineCohortStatus = "draft" | "published" | "running" | "completed";
export type OfflineDeliveryMode = "offline" | "hybrid";
export type OfflineMeetingProvider = "zoom" | "google_meet" | "manual";
export type OfflineEnrollmentStatus = "active" | "at_risk" | "completed" | "withdrawn";
export type OfflineAttendanceStatus = "present" | "late" | "absent" | "excused";
export type OfflineAssignmentSubmissionStatus =
  | "pending"
  | "needs_revision"
  | "passed";
export type OfflineMeetingLifecycleStatus = "scheduled" | "live" | "ended" | "cancelled";
export type OfflineRecordingSyncStatus =
  | "not_expected"
  | "pending"
  | "processing"
  | "ready"
  | "failed";
export type OfflineAttendanceSource = "manual" | "zoom_import";

export interface OfflineCohortMetricsSnapshot {
  sessions_total: number;
  enrolled_students: number;
  published_recordings: number;
  assignments_total: number;
  updated_at: string | null;
}

export interface OfflineCourseMetricsSnapshot {
  cohorts_total: number;
  active_cohorts: number;
  enrolled_students: number;
  published_recordings: number;
  updated_at: string | null;
}

export interface OfflineCourse {
  id: string;
  title: string;
  tagline: string;
  description: string | null;
  cover_image_url: string | null;
  level: "beginner" | "intermediate" | "advanced" | "all";
  venue_city: string | null;
  instructor_ids: string[];
  instructor_names: string[];
  learning_outcomes: string | null;
  certificate_title: string | null;
  price_note: string | null;
  published: boolean;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  metrics_snapshot: OfflineCourseMetricsSnapshot;
}

export interface OfflineCohort {
  id: string;
  offline_course_id: string;
  title: string;
  tagline: string;
  description: string | null;
  status: OfflineCohortStatus;
  delivery_mode: OfflineDeliveryMode;
  meeting_provider: OfflineMeetingProvider;
  venue_name: string | null;
  venue_address: string | null;
  city: string | null;
  cover_image_url: string | null;
  instructor_id: string;
  instructor_name: string;
  coordinator_ids: string[];
  zoom_host_email: string | null;
  default_zoom_join_url: string | null;
  default_zoom_start_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  registration_notes: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  metrics_snapshot: OfflineCohortMetricsSnapshot;
}

export interface OfflineCohortSession {
  id: string;
  cohort_id: string;
  week_index: number;
  title: string;
  summary: string | null;
  starts_at: string;
  ends_at: string;
  location_label: string | null;
  location_address: string | null;
  zoom_meeting_id: string | null;
  zoom_meeting_uuid: string | null;
  zoom_join_url: string | null;
  zoom_start_url: string | null;
  meeting_status: OfflineMeetingLifecycleStatus;
  attendance_source: OfflineAttendanceSource;
  recording_sync_status: OfflineRecordingSyncStatus;
  recording_ready_at: string | null;
  zoom_recording_count: number;
  last_zoom_sync_at: string | null;
  recording_url: string | null;
  transcript_url: string | null;
  assignment_title: string | null;
  assignment_description: string | null;
  assignment_due_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfflineCohortEnrollment {
  id: string;
  cohort_id: string;
  user_id: string;
  student_name: string | null;
  student_email: string | null;
  status: OfflineEnrollmentStatus;
  progress_percent: number;
  completed_sessions: number;
  assignment_completion_percent: number;
  mentor_note: string | null;
  enrolled_at: string;
  updated_at: string;
  last_reviewed_at: string | null;
}

export interface OfflineAttendanceRecord {
  id: string;
  cohort_id: string;
  session_id: string;
  user_id: string;
  student_name: string | null;
  status: OfflineAttendanceStatus;
  note: string | null;
  marked_by: string;
  marked_at: string;
  updated_at: string;
}

export interface OfflineAssignmentSubmission {
  id: string;
  cohort_id: string;
  session_id: string;
  user_id: string;
  student_name: string | null;
  submission_text: string | null;
  proof_url: string | null;
  status: OfflineAssignmentSubmissionStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_at: string;
  updated_at: string;
}

export interface OfflineCohortInsert {
  offline_course_id: string;
  title: string;
  tagline: string;
  description?: string | null;
  status?: OfflineCohortStatus;
  delivery_mode?: OfflineDeliveryMode;
  meeting_provider?: OfflineMeetingProvider;
  venue_name?: string | null;
  venue_address?: string | null;
  city?: string | null;
  cover_image_url?: string | null;
  instructor_id: string;
  instructor_name: string;
  coordinator_ids?: string[];
  zoom_host_email?: string | null;
  default_zoom_join_url?: string | null;
  default_zoom_start_url?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  registration_notes?: string | null;
}

export interface OfflineCohortUpdate {
  offline_course_id?: string;
  title?: string;
  tagline?: string;
  description?: string | null;
  status?: OfflineCohortStatus;
  delivery_mode?: OfflineDeliveryMode;
  meeting_provider?: OfflineMeetingProvider;
  venue_name?: string | null;
  venue_address?: string | null;
  city?: string | null;
  cover_image_url?: string | null;
  instructor_id?: string;
  instructor_name?: string;
  coordinator_ids?: string[];
  zoom_host_email?: string | null;
  default_zoom_join_url?: string | null;
  default_zoom_start_url?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  registration_notes?: string | null;
  metrics_snapshot?: OfflineCohortMetricsSnapshot;
}

export interface OfflineSessionInsert {
  week_index: number;
  title: string;
  summary?: string | null;
  starts_at: string;
  ends_at: string;
  location_label?: string | null;
  location_address?: string | null;
  zoom_meeting_id?: string | null;
  zoom_join_url?: string | null;
  zoom_start_url?: string | null;
  meeting_status?: OfflineMeetingLifecycleStatus;
  attendance_source?: OfflineAttendanceSource;
  recording_sync_status?: OfflineRecordingSyncStatus;
  recording_ready_at?: string | null;
  zoom_recording_count?: number;
  last_zoom_sync_at?: string | null;
  recording_url?: string | null;
  transcript_url?: string | null;
  assignment_title?: string | null;
  assignment_description?: string | null;
  assignment_due_at?: string | null;
}

export interface OfflineCourseInsert {
  title: string;
  tagline: string;
  description?: string | null;
  cover_image_url?: string | null;
  level?: "beginner" | "intermediate" | "advanced" | "all";
  venue_city?: string | null;
  instructor_ids?: string[];
  instructor_names?: string[];
  learning_outcomes?: string | null;
  certificate_title?: string | null;
  price_note?: string | null;
  published?: boolean;
}

export interface OfflineCourseUpdate {
  title?: string;
  tagline?: string;
  description?: string | null;
  cover_image_url?: string | null;
  level?: "beginner" | "intermediate" | "advanced" | "all";
  venue_city?: string | null;
  instructor_ids?: string[];
  instructor_names?: string[];
  learning_outcomes?: string | null;
  certificate_title?: string | null;
  price_note?: string | null;
  published?: boolean;
  metrics_snapshot?: OfflineCourseMetricsSnapshot;
}

export interface OfflineEnrollmentInsert {
  user_id: string;
  student_name?: string | null;
  student_email?: string | null;
  status?: OfflineEnrollmentStatus;
  progress_percent?: number;
  completed_sessions?: number;
  assignment_completion_percent?: number;
  mentor_note?: string | null;
}

export interface OfflineEnrollmentRoadmapUpdate {
  status?: OfflineEnrollmentStatus;
  progress_percent?: number;
  completed_sessions?: number;
  assignment_completion_percent?: number;
  mentor_note?: string | null;
  last_reviewed_at?: string | null;
}

export interface OfflineAttendanceUpsertInput {
  status: OfflineAttendanceStatus;
  note?: string | null;
}

export interface OfflineAssignmentSubmissionInsert {
  submission_text?: string | null;
  proof_url?: string | null;
}

export interface OfflineAssignmentSubmissionReviewInput {
  status: Exclude<OfflineAssignmentSubmissionStatus, "pending">;
  review_note?: string | null;
}

export const OFFLINE_COHORT_STATUS_LABELS: Record<OfflineCohortStatus, string> = {
  draft: "Bản nháp",
  published: "Mở ghi danh",
  running: "Đang diễn ra",
  completed: "Đã hoàn thành",
};

export const OFFLINE_DELIVERY_MODE_LABELS: Record<OfflineDeliveryMode, string> = {
  offline: "Học trực tiếp",
  hybrid: "Hybrid",
};

export const OFFLINE_MEETING_PROVIDER_LABELS: Record<OfflineMeetingProvider, string> = {
  zoom: "Zoom (legacy)",
  google_meet: "Google Meet",
  manual: "Không dùng nền tảng họp",
};

export const OFFLINE_ENROLLMENT_STATUS_LABELS: Record<OfflineEnrollmentStatus, string> = {
  active: "Đang theo học",
  at_risk: "Cần theo dõi",
  completed: "Đã hoàn thành",
  withdrawn: "Đã rút",
};

export const OFFLINE_MEETING_LIFECYCLE_STATUS_LABELS: Record<
  OfflineMeetingLifecycleStatus,
  string
> = {
  scheduled: "Đã lên lịch",
  live: "Đang diễn ra",
  ended: "Đã kết thúc",
  cancelled: "Đã huỷ",
};

export const OFFLINE_RECORDING_SYNC_STATUS_LABELS: Record<
  OfflineRecordingSyncStatus,
  string
> = {
  not_expected: "Không chờ recording",
  pending: "Chờ đồng bộ",
  processing: "Đang xử lý",
  ready: "Sẵn sàng",
  failed: "Lỗi đồng bộ",
};

export const OFFLINE_ATTENDANCE_SOURCE_LABELS: Record<OfflineAttendanceSource, string> = {
  manual: "Nhập tay",
  zoom_import: "Đồng bộ từ Google Meet",
};

export const OFFLINE_ATTENDANCE_STATUS_LABELS: Record<OfflineAttendanceStatus, string> = {
  present: "Có mặt",
  late: "Đi muộn",
  absent: "Vắng mặt",
  excused: "Có phép",
};

export const OFFLINE_ASSIGNMENT_SUBMISSION_STATUS_LABELS: Record<
  OfflineAssignmentSubmissionStatus,
  string
> = {
  pending: "Chờ xem",
  needs_revision: "Cần bổ sung",
  passed: "Đạt yêu cầu",
};

export function getOfflineCohortStatusLabel(status: OfflineCohortStatus): string {
  return OFFLINE_COHORT_STATUS_LABELS[status];
}

export function getOfflineDeliveryModeLabel(mode: OfflineDeliveryMode): string {
  return OFFLINE_DELIVERY_MODE_LABELS[mode];
}

export function getOfflineMeetingProviderLabel(provider: OfflineMeetingProvider): string {
  return OFFLINE_MEETING_PROVIDER_LABELS[provider];
}

export function getOfflineEnrollmentStatusLabel(status: OfflineEnrollmentStatus): string {
  return OFFLINE_ENROLLMENT_STATUS_LABELS[status];
}

export function getOfflineAttendanceStatusLabel(status: OfflineAttendanceStatus): string {
  return OFFLINE_ATTENDANCE_STATUS_LABELS[status];
}

export function getOfflineAssignmentSubmissionStatusLabel(
  status: OfflineAssignmentSubmissionStatus,
): string {
  return OFFLINE_ASSIGNMENT_SUBMISSION_STATUS_LABELS[status];
}

export function getOfflineMeetingLifecycleStatusLabel(
  status: OfflineMeetingLifecycleStatus,
): string {
  return OFFLINE_MEETING_LIFECYCLE_STATUS_LABELS[status];
}

export function getOfflineRecordingSyncStatusLabel(
  status: OfflineRecordingSyncStatus,
): string {
  return OFFLINE_RECORDING_SYNC_STATUS_LABELS[status];
}

export function getOfflineAttendanceSourceLabel(source: OfflineAttendanceSource): string {
  return OFFLINE_ATTENDANCE_SOURCE_LABELS[source];
}

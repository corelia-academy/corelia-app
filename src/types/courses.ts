/**
 * Types cho khoá học online (video YouTube) kiểu Udemy
 * Firestore: courses, sections (sub), lessons (sub), enrollments, lesson_progress
 */

import i18n from "@/i18n";

export type SupportedCourseLocale = "vi" | "en";

export type CourseLevel = "beginner" | "intermediate" | "advanced" | "all";
export type CourseOwnerType = "corelia" | "external_partner";

export type CourseCoInstructorPermissionKey =
  | "students"
  | "submissions"
  | "content"
  | "certificates";

export type CourseCoInstructorPermissions = Partial<
  Record<CourseCoInstructorPermissionKey, boolean>
>;

export interface CourseCoInstructorSnapshot {
  id: string;
  name: string;
  avatar_url?: string | null;
  headline?: string | null;
  organization?: string | null;
  website?: string | null;
  bio?: string | null;
  show_on_course_page?: boolean;
}

export interface SponsorLocaleContent {
  name?: string;
  description?: string;
}

export interface CourseSponsor {
  /** Stable id for list rendering + updates */
  id: string;
  /** Tên fallback (primary locale, backward compat) */
  name: string;
  website?: string | null;
  /** Mô tả fallback (primary locale, backward compat) */
  description?: string | null;
  logo_url?: string | null;
  logo_path?: string | null;
  /** Nội dung đa ngôn ngữ: tên & mô tả theo từng locale */
  locale_content?: Partial<Record<SupportedCourseLocale, SponsorLocaleContent>> | null;
}

export interface CoursePartner {
  /** Stable id for list rendering + updates */
  id: string;
  /** Tên fallback (primary locale, backward compat) */
  name: string;
  website?: string | null;
  /** Mô tả fallback (primary locale, backward compat) */
  description?: string | null;
  logo_url?: string | null;
  logo_path?: string | null;
  /** Nội dung đa ngôn ngữ: tên & mô tả theo từng locale */
  locale_content?: Partial<Record<SupportedCourseLocale, SponsorLocaleContent>> | null;
}

export interface CoursePartnerBrand {
  name: string;
  website?: string | null;
  description?: string | null;
  logo_url?: string | null;
  logo_path?: string | null;
}

export interface CourseI18nConfig {
  /** Khoá học hỗ trợ ngôn ngữ nội dung nào (hiện: vi/en) */
  supported_locales?: SupportedCourseLocale[];
  /** Ngôn ngữ nội dung chính (fallback) */
  primary_content_locale?: SupportedCourseLocale;
  /** Ngôn ngữ chính của video (có thể khác ngôn ngữ nội dung) */
  default_video_primary_locale?: SupportedCourseLocale;
  /** Luôn gợi ý về YouTube subtitles/auto-translate */
  subtitle_note_policy?: "suggest" | "none";
}

export interface CourseLocaleContent {
  /** Locale của nội dung này */
  locale: SupportedCourseLocale;
  title: string;
  slug?: string;
  description: string;
  learning_outcomes?: string[];
  short_description?: string;
  final_assignment_title?: string | null;
  final_assignment_description?: string | null;
  final_assignment_instructions?: string | null;
  updated_at?: string;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  /** What you'll learn: danh sách kết quả học tập */
  learning_outcomes?: string[];
  /** Kỹ năng hiển thị trên hồ sơ sau khi học viên hoàn thành khoá */
  skills?: string[];
  short_description?: string;
  thumbnail_url: string;
  /** Đường dẫn trong Supabase Storage (course-thumbnails/...), dùng để xoá ảnh cũ khi thay */
  thumbnail_path?: string;
  instructor_id: string;
  instructor_name: string;
  level: CourseLevel;
  /** Tổng thời lượng ước tính (giây) */
  total_duration_seconds: number;
  published: boolean;
  follower_count?: number;
  created_at: string;
  updated_at: string;
  /** Cấu hình đa ngôn ngữ cho nội dung khoá (không ảnh hưởng progress) */
  i18n?: CourseI18nConfig;
  /** Bài tập cuối khoá: tiêu đề (nếu có = khoá yêu cầu bài tập) */
  final_assignment_title?: string;
  /** Mô tả / yêu cầu bài tập cuối khoá */
  final_assignment_description?: string;
  /** Hướng dẫn chi tiết (tùy chọn) */
  final_assignment_instructions?: string;
  /** Ảnh nền Off-chain (dành cho canvas chèn tên học viên, để tải về/share MXH) */
  certificate_template_url?: string;
  /** Đường dẫn Storage template chứng nhận */
  certificate_template_path?: string;
  /** Vị trí tên học viên trên template: % từ trái (0–100) */
  certificate_name_x_percent?: number;
  /** Vị trí tên học viên trên template: % từ trên (0–100) */
  certificate_name_y_percent?: number;
  /** Màu chữ tên học viên trên template (hex, mặc định "#000000") */
  certificate_name_color?: string;
  /** Cỡ chữ tên học viên: % chiều rộng (mặc định 5 = 80px trên canvas 1600) */
  certificate_name_size_percent?: number;
  /** Khối footer "Date of Issue" / "Certificate ID": mép trái, % từ trái (0–100) */
  certificate_footer_x_percent?: number;
  /** Khối footer: giữa theo chiều dọc, % từ trên (0–100) */
  certificate_footer_y_percent?: number;
  /** Cỡ chữ footer: % chiều rộng (mặc định 1.75 = 28px) */
  certificate_footer_size_percent?: number;
  /** Màu chữ footer (hex, mặc định "#000000") */
  certificate_footer_color?: string;
  /** Tâm mã QR xác minh: % từ trái (0–100) */
  certificate_qr_x_percent?: number;
  /** Tâm mã QR xác minh: % từ trên (0–100) */
  certificate_qr_y_percent?: number;
  /** Cạnh mã QR: % chiều rộng (mặc định 11.25 = 180px) */
  certificate_qr_size_percent?: number;
  /** Phôi OCA On-chain (không in tên, bảo mật) — dùng khi đúc chứng chỉ lên Open Campus/IPFS */
  onchain_certificate_template_url?: string;
  /** Đường dẫn Storage của phôi OCA on-chain */
  onchain_certificate_template_path?: string;
  /** Khoá học có hỗ trợ cấp chứng nhận hoàn thành */
  has_certificate?: boolean;
  /** Khoá học vẫn đang được cập nhật nội dung (manual flag) */
  is_updating?: boolean;
  /** Khoá học có phân chia theo section (false = flat lesson list) */
  has_sections?: boolean;
  /** Khoá học tổng hợp từ nguồn ngoài (YouTube/reference) */
  is_external_aggregated?: boolean;
  /** Danh sách link nguồn ngoài (YouTube/reference) */
  external_source_urls?: string[];
  /** Chú thích nguồn để hiển thị công khai */
  external_source_attribution_note?: string | null;
  /** Loại sở hữu khoá học: nội bộ Corelia hoặc đối tác ngoài */
  owner_type?: CourseOwnerType;

  /** Đồng giảng viên (chỉ để hiển thị công khai) */
  co_instructors?: CourseCoInstructorSnapshot[];
  /** Map quyền theo uid đồng giảng viên (dùng cho scoped access) */
  co_instructor_permissions?: Record<string, CourseCoInstructorPermissions>;

  /** Sponsors hiển thị ở sidebar trang khoá học */
  sponsors?: CourseSponsor[];

  /** Brand hiển thị cho khoá đối tác (tách khỏi sponsors) */
  partner_brand?: CoursePartnerBrand | null;

  /** Partners hiển thị ở sidebar trang khoá học */
  partners?: CoursePartner[];
}

export interface CourseSection {
  id: string;
  title: string;
  order: number;
  /** Mô tả ngắn cho chương (plain text) */
  description?: string;
}

export interface CourseSectionLocaleContent {
  locale: SupportedCourseLocale;
  title: string;
  description?: string;
  updated_at?: string;
}

export interface LessonResource {
  title: string;
  url: string;
}

/** `video` = YouTube embed; `article` = markdown/text lesson; `quiz` = MCQ with score; `practice` = open-ended exercise. */
export type LessonFormat = "video" | "article" | "quiz" | "practice";

export interface CourseLesson {
  id: string;
  section_id: string;
  title: string;
  /** Mô tả ngắn cho bài học (plain text) */
  short_description?: string;
  /** Mô tả dài cho bài học (Markdown) */
  description_markdown?: string;
  /** Danh sách tài liệu/resources cho bài học */
  resources?: LessonResource[];
  /** Practice lesson can reference the content lesson it is based on. */
  practice_source_lesson_id?: string | null;
  /** Loại bài học — mặc định suy ra từ youtube_url / nội dung. */
  lesson_format?: LessonFormat;
  /** URL YouTube (embed hoặc watch), ví dụ https://www.youtube.com/watch?v=VIDEO_ID */
  youtube_url?: string;
  /** Giây bắt đầu clip trong video (optional; mặc định 0) */
  youtube_start_seconds?: number;
  /** Giây kết thúc clip (optional; không set = xem đến hết video) */
  youtube_end_seconds?: number | null;
  /** Ngôn ngữ chính của video (có thể khác ngôn ngữ nội dung) */
  video_primary_locale?: SupportedCourseLocale;
  /** Flag subtitle theo locale nội dung (không kiểm tra YouTube API) */
  has_subtitle?: boolean;
  /** Các locale subtitle đã chuẩn bị/có sẵn */
  subtitle_locales?: SupportedCourseLocale[];
  /** Thời lượng ước tính (giây) */
  duration_seconds: number;
  order: number;
  /** Bật để làm bài học học thử khi khoá thuộc mô hình trả phí trước */
  is_preview_free?: boolean;
}

export interface CourseLessonLocaleContent {
  locale: SupportedCourseLocale;
  title: string;
  short_description?: string;
  description_markdown?: string;
  resources?: LessonResource[];
  practice_source_lesson_id?: string | null;
  youtube_url?: string;
  youtube_start_seconds?: number;
  youtube_end_seconds?: number | null;
  video_primary_locale?: SupportedCourseLocale;
  has_subtitle?: boolean;
  subtitle_locales?: SupportedCourseLocale[];
  updated_at?: string;
}

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  enrolled_at: string;
  last_accessed_at: string;
  /** Thời điểm hoàn thành toàn bộ bài học trong khoá (không phụ thuộc chứng nhận) */
  completed_at?: string | null;
  /** Thời điểm cấp chứng nhận hoàn thành (null = chưa đủ điều kiện) */
  certificate_issued_at?: string | null;
}

/** Trạng thái bài nộp bài tập cuối khoá */
export type FinalSubmissionStatus = "pending" | "approved" | "rejected";

export interface FinalAssignmentSubmission {
  id: string;
  user_id: string;
  course_id: string;
  /** Nội dung text học viên nộp */
  content: string;
  /** URL file đính kèm (nếu có) */
  file_urls?: string[];
  submitted_at: string;
  status: FinalSubmissionStatus;
  reviewer_comment?: string | null;
  reviewed_at?: string | null;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  course_id: string;
  /** null = chưa hoàn thành */
  completed_at: string | null;
  /** Số giây đã xem (tùy chọn) */
  watch_seconds?: number;
}

/** Dùng khi tạo/cập nhật khoá học */
export interface CourseInsert {
  title: string;
  slug: string;
  description: string;
  learning_outcomes?: string[];
  skills?: string[];
  short_description?: string;
  thumbnail_url: string;
  thumbnail_path?: string;
  instructor_id: string;
  instructor_name: string;
  level?: CourseLevel;
  total_duration_seconds?: number;
  published?: boolean;
  i18n?: CourseI18nConfig;
  is_updating?: boolean;
  has_sections?: boolean;
  is_external_aggregated?: boolean;
  external_source_urls?: string[];
  external_source_attribution_note?: string | null;
  owner_type?: CourseOwnerType;

  co_instructors?: CourseCoInstructorSnapshot[];
  co_instructor_permissions?: Record<string, CourseCoInstructorPermissions>;

  sponsors?: CourseSponsor[];

  partner_brand?: CoursePartnerBrand | null;

  partners?: CoursePartner[];
}

/** Cập nhật một phần thông tin khoá (instructor/admin) */
export interface CourseUpdate {
  title?: string;
  slug?: string;
  description?: string;
  learning_outcomes?: string[];
  skills?: string[];
  short_description?: string;
  thumbnail_url?: string;
  thumbnail_path?: string;
  instructor_name?: string;
  level?: CourseLevel;
  total_duration_seconds?: number;
  published?: boolean;
  i18n?: CourseI18nConfig;
  final_assignment_title?: string | null;
  final_assignment_description?: string | null;
  final_assignment_instructions?: string | null;
  certificate_template_url?: string | null;
  certificate_template_path?: string | null;
  certificate_name_x_percent?: number | null;
  certificate_name_y_percent?: number | null;
  certificate_name_color?: string | null;
  certificate_name_size_percent?: number | null;
  certificate_footer_x_percent?: number | null;
  certificate_footer_y_percent?: number | null;
  certificate_footer_size_percent?: number | null;
  certificate_footer_color?: string | null;
  certificate_qr_x_percent?: number | null;
  certificate_qr_y_percent?: number | null;
  certificate_qr_size_percent?: number | null;
  onchain_certificate_template_url?: string | null;
  onchain_certificate_template_path?: string | null;
  has_certificate?: boolean;
  is_updating?: boolean;
  has_sections?: boolean;
  is_external_aggregated?: boolean;
  external_source_urls?: string[];
  external_source_attribution_note?: string | null;
  owner_type?: CourseOwnerType;

  co_instructors?: CourseCoInstructorSnapshot[] | null;
  co_instructor_permissions?: Record<string, CourseCoInstructorPermissions> | null;

  sponsors?: CourseSponsor[] | null;

  partner_brand?: CoursePartnerBrand | null;

  partners?: CoursePartner[] | null;
}

export interface CourseSectionInsert {
  title: string;
  order: number;
  description?: string;
}

export interface CourseLessonInsert {
  section_id: string;
  title: string;
  lesson_format?: LessonFormat;
  short_description?: string;
  description_markdown?: string;
  resources?: LessonResource[];
  practice_source_lesson_id?: string | null;
  youtube_url?: string;
  youtube_start_seconds?: number;
  youtube_end_seconds?: number | null;
  video_primary_locale?: SupportedCourseLocale;
  has_subtitle?: boolean;
  subtitle_locales?: SupportedCourseLocale[];
  duration_seconds: number;
  order: number;
  is_preview_free?: boolean;
}

export const COURSE_LEVEL_LABELS: Record<CourseLevel, string> = {
  beginner: "Cơ bản",
  intermediate: "Trung cấp",
  advanced: "Nâng cao",
  all: "Mọi cấp độ",
};

export const COURSE_OWNER_TYPE_LABELS: Record<CourseOwnerType, string> = {
  corelia: "Khoá học Corelia",
  external_partner: "Khoá học giảng viên đối tác",
};

export function getCourseLevelLabel(level: CourseLevel): string {
  return i18n.t(`courses:level.${level}`, { defaultValue: COURSE_LEVEL_LABELS[level] });
}

export function getCourseOwnerTypeLabel(ownerType?: CourseOwnerType): string {
  const key = ownerType ?? "corelia";
  return i18n.t(`courses:ownerType.${key}`, { defaultValue: COURSE_OWNER_TYPE_LABELS[key] });
}

function isYoutubeVideoId(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{11}$/.test(value);
}

/** Trích xuất YouTube video ID từ các URL watch, short, live, embed và youtu.be. */
export function getYoutubeVideoId(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const pathSegments = parsed.pathname.split("/").filter(Boolean);
  const candidate =
    host === "youtu.be"
      ? pathSegments[0]
      : host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com"
        ? parsed.pathname === "/watch"
          ? parsed.searchParams.get("v")
          : ["embed", "shorts", "live", "v"].includes(pathSegments[0] ?? "")
            ? pathSegments[1]
            : null
        : null;

  return isYoutubeVideoId(candidate) ? candidate : null;
}

/** URL embed để nhúng iframe */
export function getYoutubeEmbedUrl(url: string): string | null {
  const id = getYoutubeVideoId(url);
  return id ? `https://www.youtube.com/embed/${id}?rel=0` : null;
}

/** Embed iframe với segment start/end (giây). Chỉ áp dụng khi có youtube_url hợp lệ. */
export function getYoutubeEmbedUrlForLesson(lesson: Pick<CourseLesson, "youtube_url" | "youtube_start_seconds" | "youtube_end_seconds">): string | null {
  const base = getYoutubeEmbedUrl(lesson.youtube_url ?? "");
  if (!base) return null;
  const startRaw = lesson.youtube_start_seconds;
  const start =
    typeof startRaw === "number" && Number.isFinite(startRaw) && startRaw > 0
      ? Math.floor(startRaw)
      : 0;
  const endRaw = lesson.youtube_end_seconds;
  const end =
    endRaw != null && typeof endRaw === "number" && Number.isFinite(endRaw) && endRaw > start
      ? Math.floor(endRaw)
      : null;

  const u = new URL(base);
  if (start > 0) u.searchParams.set("start", String(start));
  if (end != null) u.searchParams.set("end", String(end));
  return u.toString();
}

/** Format thời lượng (giây) sang text. Trả về "—" khi 0 hoặc không hợp lệ (tránh "0 phút"). */
export function formatDuration(seconds: number): string {
  if (seconds == null || typeof seconds !== "number" || seconds <= 0) return "—";
  if (seconds < 60) return i18n.t("detail.duration.lessThanOneMinute", { ns: "courses" });
  const roundedTotalMinutes = Math.round(seconds / 60);
  const h = Math.floor(roundedTotalMinutes / 60);
  const m = roundedTotalMinutes % 60;
  if (h === 0) {
    return i18n.t("detail.duration.minutes", {
      ns: "courses",
      count: m,
    });
  }
  return i18n.t("detail.duration.hoursMinutes", {
    ns: "courses",
    hours: h,
    minutes: m,
  });
}

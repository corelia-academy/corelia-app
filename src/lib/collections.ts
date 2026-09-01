/**
 * Tập trung tất cả tên collection/subcollection của Firestore.
 * Sửa tên chỉ cần đổi ở đây — không phải rải rác trong từng file.
 */

// ─── Top-level collections ────────────────────────────────────────────────────
export const COL = {
  PROFILES: "profiles",

  // Khoá học online
  COURSES: "courses",
  ENROLLMENTS: "enrollments",
  LESSON_PROGRESS: "lesson_progress",
  FINAL_ASSIGNMENT_SUBMISSIONS: "final_assignment_submissions",

  // Cuộc thi
  CONTESTS: "contests",
  CONTEST_REGISTRATIONS: "contest_registrations",
  CONTEST_ACCESS_INVITES: "contest_access_invites",
  CONTEST_SUBMISSIONS: "contest_submissions",
  CONTEST_SCORES: "contest_scores",

  // Khoá học offline
} as const;

// ─── Subcollection keys (dùng trong collection path lồng nhau) ────────────────
export const SUB = {
  SECTIONS: "sections",
  LESSONS: "lessons",
  LOCALES: "locales",
  DISCOUNTS: "discounts",
  SESSIONS: "sessions",
} as const;

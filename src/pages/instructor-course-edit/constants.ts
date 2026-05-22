import type { CourseCoInstructorPermissionKey } from "@/types/courses";

export const EDIT_SECTION_IDS = [
  "info",
  "pricing",
  "content",
  "assignments",
  "certificate",
  "announcements",
  "students",
  "danger",
] as const;

export const CO_INSTRUCTOR_PERMISSION_KEYS: Array<{
  key: CourseCoInstructorPermissionKey;
  labelKey: string;
}> = [
  { key: "students", labelKey: "courseEdit.coInstructors.permissions.students" },
  { key: "submissions", labelKey: "courseEdit.coInstructors.permissions.submissions" },
  { key: "content", labelKey: "courseEdit.coInstructors.permissions.content" },
  { key: "certificates", labelKey: "courseEdit.coInstructors.permissions.certificates" },
  { key: "pricing", labelKey: "courseEdit.coInstructors.permissions.pricing" },
];

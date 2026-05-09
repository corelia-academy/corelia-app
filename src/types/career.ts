import type { Course } from "@/types/courses";

export type CareerTrack = {
  id: string;
  owner_scope?: "corelia" | "instructor";
  instructor_id?: string | null;
  slug: string;
  title: string;
  description: string;
  what_youll_learn: string[];
  prerequisites: string[];
  has_certificate: boolean;
  /** Text-only content localization config */
  i18n?: import("@/types/entityLocales").EntityI18nConfig;
  published?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type CareerTrackIncludedCourse = {
  course: Pick<Course, "id" | "slug" | "title" | "thumbnail_url" | "total_duration_seconds">;
  sort_order: number;
};

export type CareerTrackDetail = CareerTrack & {
  instructorHandle?: string | null;
  includedCourses: CareerTrackIncludedCourse[];
  courseCount: number;
  totalDurationSeconds: number;
};


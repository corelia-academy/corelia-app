import type {
  Course,
  CoursePartner,
  CoursePartnerBrand,
  CourseSponsor,
} from "@/types/courses";

export type CareerTrack = {
  id: string;
  owner_scope?: "corelia" | "instructor";
  instructor_id?: string | null;
  slug: string;
  title: string;
  description: string;
  short_description?: string | null;
  what_youll_learn: string[];
  prerequisites: string[];
  has_certificate: boolean;
  hero_media_type?: "image" | "youtube";
  hero_youtube_url?: string | null;
  hero_youtube_video_id?: string | null;
  thumbnail_url?: string | null;
  thumbnail_path?: string | null;
  sponsors?: CourseSponsor[];
  partner_brand?: CoursePartnerBrand | null;
  partners?: CoursePartner[];
  /** Text-only content localization config */
  i18n?: import("@/types/entityLocales").EntityI18nConfig;
  published?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type CareerTrackIncludedCourse = {
  course: Pick<
    Course,
    | "id"
    | "slug"
    | "title"
    | "thumbnail_url"
    | "total_duration_seconds"
    | "short_description"
  >;
  sort_order: number;
};

export type CareerTrackDetail = CareerTrack & {
  instructorHandle?: string | null;
  includedCourses: CareerTrackIncludedCourse[];
  courseCount: number;
  totalDurationSeconds: number;
};

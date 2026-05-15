export type BackendContextType =
  | "lesson"
  | "dashboard"
  | "course_discovery"
  | "career"
  | "activity"
  | "profile_review"
  | "global";

export type LearningProfileMemoryRow = {
  weak_topics: string[] | null;
  strong_topics: string[] | null;
  learning_style: string | null;
  ai_summary: string | null;
  total_questions: number | null;
};

export type LearningMemoryDelta = {
  newWeakTopic: string | null;
  newStrongTopic: string | null;
  learningStyle: string | null;
  summary: string | null;
  totalQuestions: number;
};

export type RecommendedAction = {
  label: string;
  to: string;
  reason: string;
};

export type RecommendedEntity = {
  kind: "course" | "career" | "hackathon";
  title: string;
  to: string;
  reason: string;
  subtitle?: string | null;
  badge?: string | null;
};

export type LessonContextData = {
  courseId?: string;
  courseSlug?: string | null;
  courseTitle?: string;
  lessonTitle?: string;
};

export type DashboardCourseSummary = {
  id: string;
  slug: string | null;
  title: string;
  shortDescription: string | null;
  category: string | null;
  level: string | null;
};

export type DashboardCareerTrackSummary = {
  slug: string;
  title: string;
  description: string | null;
  ownerScope: "corelia" | "instructor" | null;
  instructorHandle: string | null;
};

export type DashboardHackathonSummary = {
  slug: string;
  title: string;
  status: string | null;
  tagline: string | null;
  registrationDeadline: string | null;
  submissionDeadline: string | null;
};

export type DashboardContextData = {
  recentCourses?: DashboardCourseSummary[];
  featuredTracks?: DashboardCareerTrackSummary[];
  featuredHackathons?: DashboardHackathonSummary[];
};

export type GlobalContextData = DashboardContextData;

export type ProfileReviewContextData = DashboardContextData;

export type CourseDiscoveryContextData = {
  recentCourses?: DashboardCourseSummary[];
};

export type CareerContextData = {
  featuredTracks?: DashboardCareerTrackSummary[];
};

export type ActivityContextData = {
  featuredHackathons?: DashboardHackathonSummary[];
};

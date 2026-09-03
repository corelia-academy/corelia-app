import { queryOptions } from "@tanstack/react-query";

import {
  computeProgressPercent,
  getCourse,
  getCourseLessonLocaleContent,
  getCourseLessonLocaleContentMap,
  getCourseLessons,
  getCourseLocaleContent,
  getCourseSectionLocaleContentMap,
  getCourseSectionLocaleContent,
  getCourseSections,
  getEnrollmentsForCourse,
  getLessonDistinctLearnerCountsForCourse,
  getLessonProgressForUsersInCourse,
} from "@/lib/courses";
import { getSubmissionsForCourse } from "@/lib/finalAssignment";
import {
  getProfilesByIds,
  listCourseCoInstructorCandidates,
} from "@/lib/profile";
import { listPendingCoInstructorInvites } from "@/lib/coInstructorInvites";
import { getLessonQuestions, getSectionQuestions } from "@/lib/sectionQuestions";
import type { Profile } from "@/types/database";
import type {
  Course,
  CourseLesson,
  CourseSection,
  Enrollment,
  FinalAssignmentSubmission,
  SupportedCourseLocale,
} from "@/types/courses";

export interface InstructorCourseWorkspace {
  course: Course | null;
  sections: CourseSection[];
  lessons: CourseLesson[];
  enrollments: Enrollment[];
  submissions: FinalAssignmentSubmission[];
  submissionByUser: Record<string, FinalAssignmentSubmission>;
  studentProfiles: Record<string, Profile | null>;
  studentProgress: Record<string, number>;
  lessonLearnerCounts: Record<string, number>;
}

export const instructorCourseEditorKeys = {
  all: ["courses", "instructor-editor"] as const,
  workspace: (courseId: string, userId: string) =>
    [...instructorCourseEditorKeys.all, "workspace", courseId, userId] as const,
  locale: (courseId: string, locale: SupportedCourseLocale, userId: string) =>
    [...instructorCourseEditorKeys.all, "locale", courseId, locale, userId] as const,
  coInstructors: (courseId: string, userId: string) =>
    [...instructorCourseEditorKeys.all, "co-instructors", courseId, userId] as const,
  sectionLocale: (
    courseId: string,
    sectionId: string,
    locale: SupportedCourseLocale,
    userId: string,
  ) =>
    [...instructorCourseEditorKeys.all, "section-locale", courseId, sectionId, locale, userId] as const,
  lessonLocale: (
    courseId: string,
    lessonId: string,
    locale: SupportedCourseLocale,
    userId: string,
  ) =>
    [...instructorCourseEditorKeys.all, "lesson-locale", courseId, lessonId, locale, userId] as const,
  questions: (
    courseId: string,
    mode: "section" | "lesson",
    targetId: string,
    locale: SupportedCourseLocale,
    userId: string,
  ) =>
    [
      ...instructorCourseEditorKeys.all,
      "questions",
      courseId,
      mode,
      targetId,
      locale,
      userId,
    ] as const,
};

export function instructorCourseQuestionsQueryOptions(input: {
  courseId: string;
  mode: "section" | "lesson";
  targetId: string | null | undefined;
  locale: SupportedCourseLocale;
  userId: string | undefined;
  enabled: boolean;
}) {
  const targetId = input.targetId ?? "";
  const userId = input.userId ?? "";
  return queryOptions({
    queryKey: instructorCourseEditorKeys.questions(
      input.courseId,
      input.mode,
      targetId || "missing",
      input.locale,
      userId || "missing",
    ),
    queryFn: ({ signal }) =>
      input.mode === "lesson"
        ? getLessonQuestions(input.courseId, targetId, input.locale, signal)
        : getSectionQuestions(input.courseId, targetId, input.locale, signal),
    enabled: Boolean(
      input.enabled && input.courseId && targetId && userId,
    ),
    staleTime: 30_000,
    meta: privateMeta(input.userId),
  });
}

export function instructorCourseSectionLocaleQueryOptions(input: {
  courseId: string;
  sectionId: string;
  locale: SupportedCourseLocale;
  userId: string | undefined;
}) {
  return queryOptions({
    queryKey: instructorCourseEditorKeys.sectionLocale(
      input.courseId,
      input.sectionId,
      input.locale,
      input.userId ?? "missing",
    ),
    queryFn: () => getCourseSectionLocaleContent(
      input.courseId,
      input.sectionId,
      input.locale,
    ),
    enabled: Boolean(input.courseId && input.sectionId && input.userId),
    staleTime: 60_000,
    meta: privateMeta(input.userId),
  });
}

export function instructorCourseLessonLocaleQueryOptions(input: {
  courseId: string;
  lessonId: string;
  locale: SupportedCourseLocale;
  userId: string | undefined;
}) {
  return queryOptions({
    queryKey: instructorCourseEditorKeys.lessonLocale(
      input.courseId,
      input.lessonId,
      input.locale,
      input.userId ?? "missing",
    ),
    queryFn: () => getCourseLessonLocaleContent(
      input.courseId,
      input.lessonId,
      input.locale,
    ),
    enabled: Boolean(input.courseId && input.lessonId && input.userId),
    staleTime: 60_000,
    meta: privateMeta(input.userId),
  });
}

function privateMeta(userId: string | undefined) {
  return {
    scope: "private",
    userId: userId ?? "missing",
    showInGlobalLoading: false,
  } as const;
}

export function instructorCourseWorkspaceQueryOptions(input: {
  courseId: string | undefined;
  profile: Profile | null;
}) {
  const courseId = input.courseId?.trim() ?? "";
  const userId = input.profile?.id ?? "";
  return queryOptions<InstructorCourseWorkspace>({
    queryKey: instructorCourseEditorKeys.workspace(
      courseId || "missing",
      userId || "missing",
    ),
    queryFn: async ({ signal }) => {
      const course = await getCourse(courseId);
      if (signal.aborted) throw new DOMException("Query cancelled", "AbortError");
      if (!course) {
        return {
          course: null,
          sections: [],
          lessons: [],
          enrollments: [],
          submissions: [],
          submissionByUser: {},
          studentProfiles: {},
          studentProgress: {},
          lessonLearnerCounts: {},
        };
      }

      const isStaff = input.profile?.role === "admin" || input.profile?.role === "support_staff";
      const isOwner = course.instructor_id === userId;
      const permissions = course.co_instructor_permissions?.[userId] ?? {};
      const hasAnyPermission = Object.values(permissions).some(Boolean);
      const canAccess = isStaff || isOwner || hasAnyPermission;
      if (!canAccess) {
        return {
          course,
          sections: [],
          lessons: [],
          enrollments: [],
          submissions: [],
          submissionByUser: {},
          studentProfiles: {},
          studentProgress: {},
          lessonLearnerCounts: {},
        };
      }

      const canContent = isStaff || isOwner || permissions.content === true;
      const canStudents = isStaff || isOwner || permissions.students === true;
      const canSubmissions = isStaff || isOwner || permissions.submissions === true;
      const [sections, lessons, enrollments, submissions, lessonLearnerCounts] =
        await Promise.all([
          canContent ? getCourseSections(courseId) : Promise.resolve([]),
          canContent ? getCourseLessons(courseId) : Promise.resolve([]),
          canStudents ? getEnrollmentsForCourse(courseId) : Promise.resolve([]),
          canSubmissions ? getSubmissionsForCourse(courseId) : Promise.resolve([]),
          canStudents
            ? getLessonDistinctLearnerCountsForCourse(courseId)
            : Promise.resolve({}),
        ]);
      if (signal.aborted) throw new DOMException("Query cancelled", "AbortError");

      const userIds = enrollments.map((enrollment) => enrollment.user_id);
      const [studentProfiles, progressByUser] = canStudents
        ? await Promise.all([
            getProfilesByIds(userIds, signal),
            getLessonProgressForUsersInCourse(userIds, courseId, signal),
          ])
        : [{}, new Map<string, never[]>()];
      const studentProgress = Object.fromEntries(
        userIds.map((studentId) => [
          studentId,
          computeProgressPercent(lessons, progressByUser.get(studentId) ?? []),
        ]),
      );
      const submissionByUser = Object.fromEntries(
        submissions.map((submission: FinalAssignmentSubmission) => [submission.user_id, submission]),
      );

      return {
        course,
        sections,
        lessons,
        enrollments,
        submissions,
        submissionByUser,
        studentProfiles,
        studentProgress,
        lessonLearnerCounts,
      };
    },
    enabled: Boolean(courseId && userId),
    staleTime: 30_000,
    meta: privateMeta(input.profile?.id),
  });
}

export function instructorCourseLocaleQueryOptions(input: {
  courseId: string | undefined;
  locale: SupportedCourseLocale;
  userId: string | undefined;
  enabled: boolean;
}) {
  const courseId = input.courseId?.trim() ?? "";
  return queryOptions({
    queryKey: instructorCourseEditorKeys.locale(
      courseId || "missing",
      input.locale,
      input.userId ?? "missing",
    ),
    queryFn: async () => {
      const [courseContent, sectionLocaleMap, lessonLocaleMap] = await Promise.all([
        getCourseLocaleContent(courseId, input.locale),
        getCourseSectionLocaleContentMap(courseId, input.locale),
        getCourseLessonLocaleContentMap(courseId, input.locale),
      ]);
      return { courseContent, sectionLocaleMap, lessonLocaleMap };
    },
    enabled: input.enabled && Boolean(courseId && input.userId),
    staleTime: 60_000,
    meta: privateMeta(input.userId),
  });
}

export function instructorCourseCoInstructorsQueryOptions(input: {
  courseId: string | undefined;
  userId: string | undefined;
  enabled: boolean;
}) {
  const courseId = input.courseId?.trim() ?? "";
  return queryOptions({
    queryKey: instructorCourseEditorKeys.coInstructors(
      courseId || "missing",
      input.userId ?? "missing",
    ),
    queryFn: async () => {
      const [pendingInvites, candidates] = await Promise.all([
        listPendingCoInstructorInvites(courseId),
        listCourseCoInstructorCandidates(courseId),
      ]);
      return { pendingInvites, candidates };
    },
    enabled: input.enabled && Boolean(courseId && input.userId),
    staleTime: 30_000,
    meta: privateMeta(input.userId),
  });
}

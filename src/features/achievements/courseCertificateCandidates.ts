import { courseHasCertificate, getCompletedLessonIds, type LearnerCourseProgressSnapshot } from "@/lib/courses";
import { getSubmission } from "@/lib/finalAssignment";
import type { Course, Enrollment } from "@/types/courses";

/** Read-only repair candidates. Issuance still rechecks eligibility on the server. */
export async function courseCertificateCandidates(input: {
  userId: string;
  courseIds: string[];
  courses: Map<string, Course>;
  enrollments: Enrollment[];
  progress: LearnerCourseProgressSnapshot;
  fallbackTitle: string;
}) {
  const enrollments = new Map(input.enrollments.map(enrollment => [enrollment.course_id, enrollment]));
  const candidates = await Promise.all(input.courseIds.map(async courseId => {
    const enrollment = enrollments.get(courseId);
    const course = input.courses.get(courseId);
    if (!courseHasCertificate(course) || enrollment?.certificate_issued_at) return [];
    if (!enrollment?.completed_at) {
      const lessons = (input.progress.lessonsByCourse.get(courseId) ?? []).filter(lesson => lesson.published !== false && !lesson.archived_at);
      const progress = input.progress.progressByCourse.get(courseId) ?? [];
      if (!lessons.length || getCompletedLessonIds(lessons, progress).size !== lessons.length) return [];
      if (course?.final_assignment_title?.trim() && (await getSubmission(input.userId, courseId))?.status !== "approved") return [];
    }
    return [{ courseId, courseTitle: course?.title || input.fallbackTitle }];
  }));
  return candidates.flat();
}

import { getCoursesByIds } from "@/lib/courses";

export type ResolvedLearningCourse = {
  id: string;
  slug: string;
  title: string;
};

export async function resolveContestLearningLinks(
  courseIds: string[],
): Promise<Map<string, ResolvedLearningCourse>> {
  const courseMap = await getCoursesByIds(courseIds);
  const coursesById = new Map<string, ResolvedLearningCourse>();
  for (const [id, course] of courseMap) {
    const slug = course.slug?.trim();
    const title = course.title?.trim();
    if (slug && title) coursesById.set(id, { id, slug, title });
  }
  return coursesById;
}

import { isActivityLesson } from "@/lib/lessonFormat";
import type { CourseLesson } from "@/types/courses";

export function getCourseContentLessons(lessons: CourseLesson[]): CourseLesson[] {
  return lessons.filter((lesson) => !isActivityLesson(lesson));
}

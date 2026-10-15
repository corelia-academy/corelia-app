export const LESSON_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;

export function isValidLessonImage(file: Pick<File, "type" | "size">): boolean {
  return LESSON_IMAGE_TYPES.includes(file.type) && file.size > 0 && file.size <= MAX_BYTES;
}

/**
 * Lesson Markdown stores a stable relative reference instead of a signed URL, so images never expire:
 *   /lesson-image/<courseId>/<file>  ->  app/course-thumbnails/<courseId>/lessons/<file>
 * The reference is resolved to a fresh signed URL when the lesson is rendered.
 */
const REF = /^\/lesson-image\/([A-Za-z0-9_-]{1,64})\/([A-Za-z0-9_-]{1,64}\.[a-z0-9]{1,8})$/;

export function lessonImageRef(courseId: string, file: string): string {
  return `/lesson-image/${courseId}/${file}`;
}

export function parseLessonImageRef(src: string | null | undefined): { courseId: string; file: string; path: string } | null {
  const m = REF.exec(src ?? "");
  if (!m) return null;
  return { courseId: m[1], file: m[2], path: `course-thumbnails/${m[1]}/lessons/${m[2]}` };
}

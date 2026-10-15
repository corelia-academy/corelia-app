export const LESSON_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;

export function isValidLessonImage(file: Pick<File, "type" | "size">): boolean {
  return LESSON_IMAGE_TYPES.includes(file.type) && file.size > 0 && file.size <= MAX_BYTES;
}

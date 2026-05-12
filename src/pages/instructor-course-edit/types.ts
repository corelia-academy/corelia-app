export type LessonDropPosition = "before" | "after";

export type LessonDropTarget = {
  sectionId: string;
  lessonId: string;
  position: LessonDropPosition;
};

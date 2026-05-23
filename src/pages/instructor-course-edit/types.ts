export type LessonDropPosition = "before" | "after";

export type LessonDropTarget = {
  sectionId: string;
  lessonId: string;
  position: LessonDropPosition;
};

export type SectionDropPosition = "before" | "after";

export type SectionDropTarget = {
  sectionId: string;
  position: SectionDropPosition;
};

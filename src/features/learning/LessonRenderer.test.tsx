// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { LessonRenderer } from "./LessonRenderer";
import type { CourseLesson } from "@/types/courses";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("./useLearningTranslation", () => ({ useLearningTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./YoutubeLessonVideo", () => ({ YoutubeLessonVideo: () => null }));
vi.mock("./PracticeLesson", () => ({ PracticeLesson: () => null }));
vi.mock("./QuizLesson", () => ({ QuizLesson: () => null }));
vi.mock("@/features/code-exercise/CodeExerciseLesson", () => ({ CodeExerciseLesson: () => null }));

it("shows an updating video without offering a completion action", () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  const onAction = vi.fn();
  const lesson = {
    id: "updating-video",
    section_id: "section",
    order: 0,
    duration_seconds: 0,
    title: "Updating video",
    lesson_format: "video",
    youtube_url: "",
    published: true,
  } as CourseLesson;

  act(() => root.render(
    <LessonRenderer
      lesson={lesson}
      courseId="course"
      mode="learner"
      completed={false}
      onComplete={vi.fn()}
      onAction={onAction}
    />,
  ));

  expect(host.querySelector('[role="status"]')?.textContent).toBe("learning.videoUpdating");
  expect(onAction).toHaveBeenLastCalledWith(null);
  act(() => root.unmount());
});

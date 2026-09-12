// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider, useParams } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import LearningCourseEditorRoute from "./LearningCourseEditorRoute";
import type { CourseLesson } from "@/types/courses";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: { id: "owner" } }) }));
vi.mock("@/features/learning/useLearningTranslation", () => ({ useLearningTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/learning", () => ({ getLearningEditor: vi.fn(), getLearningReadiness: vi.fn(), publishLearningReport: vi.fn() }));
vi.mock("./InstructorCourseEdit", () => ({ default: function CourseEditor({ onEditLearningLesson }: { onEditLearningLesson(lesson: CourseLesson): void }) {
  const { id } = useParams();
  return <button onClick={() => onEditLearningLesson({ id: "lesson", title: id ?? "", section_id: "section", duration_seconds: 0, order: 0 })}>Open lesson</button>;
} }));
vi.mock("@/features/learning/admin/LessonEditor", () => ({ LessonEditor: ({ courseId, initial }: { courseId: string; initial: CourseLesson }) => <p data-testid="lesson-context">{courseId}:{initial.title}</p> }));
let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

it("does not carry an open lesson from course A into course B after navigation", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  for (const id of ["a", "b"]) {
    client.setQueryData(["courses", "learning-editor", id, "owner"], { course: { id }, lessons: [], sections: [], locales: { vi: new Map(), en: new Map() } });
    client.setQueryData(["courses", "learning-readiness", id, "owner"], []);
    client.setQueryData(["courses", "learning-publication", id, "owner"], []);
  }
  const router = createMemoryRouter([{ path: "/instructor/courses/:id/edit", element: <LearningCourseEditorRoute /> }], { initialEntries: ["/instructor/courses/a/edit"] });
  const host = document.createElement("div");
  const root = createRoot(host);
  cleanup = () => { act(() => root.unmount()); router.dispose(); client.clear(); };
  await act(async () => root.render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>));
  act(() => host.querySelector("button")!.click());
  expect(host.querySelector('[data-testid="lesson-context"]')?.textContent).toBe("a:a");
  await act(async () => { await router.navigate("/instructor/courses/b/edit"); });
  expect(host.querySelector('[data-testid="lesson-context"]')).toBeNull();
  act(() => host.querySelector("button")!.click());
  expect(host.querySelector('[data-testid="lesson-context"]')?.textContent).toBe("b:b");
});

// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider, useParams } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import LearningCourseEditorRoute from "./LearningCourseEditorRoute";
import type { CourseLesson } from "@/types/courses";
import { getLearningEditor } from "@/lib/learning";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: { id: "owner" } }) }));
vi.mock("@/features/learning/useLearningTranslation", () => ({ useLearningTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/learning", () => ({ getLearningEditor: vi.fn(), getLearningReadiness: vi.fn(), publishLearningReport: vi.fn() }));
vi.mock("@/lib/courses", () => ({ refreshCourseTotalDuration: vi.fn() }));
vi.mock("./InstructorCourseEdit", () => ({ default: function CourseEditor({ onEditLearningLesson }: { onEditLearningLesson(lesson: CourseLesson, locale: "en"): void }) {
  const { id } = useParams();
  return <button onClick={() => onEditLearningLesson({ id: "lesson", title: id ?? "", section_id: "section", duration_seconds: 0, order: 0 }, "en")}>Open lesson</button>;
} }));
vi.mock("@/features/learning/admin/LessonEditor", () => ({ LessonEditor: ({ courseId, initial, initialLocale }: { courseId: string; initial: CourseLesson; initialLocale?: string }) => <p data-testid="lesson-context" data-locale={initialLocale}>{courseId}:{initial.title}</p> }));
vi.mock("@/components/ui/dialog", () => {
  const Wrapper = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <div>{children}</div> : null, DialogContent: Wrapper, DialogTitle: Wrapper, DialogDescription: Wrapper };
});
const snapshot = (id: string, title?: string) => ({ course: { id }, lessons: title ? [{ id: "lesson", title, section_id: "section", duration_seconds: 0, order: 0 }] : [], sections: [], locales: { vi: new Map(), en: new Map() } });
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); vi.resetAllMocks(); });

it("does not carry an open lesson from course A into course B after navigation", async () => {
  vi.mocked(getLearningEditor).mockImplementation(async id => snapshot(id, id) as never);
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
  await act(async () => host.querySelector("button")!.click());
  expect(host.querySelector('[data-testid="lesson-context"]')?.textContent).toBe("a:a");
  await act(async () => { await router.navigate("/instructor/courses/b/edit"); });
  expect(host.querySelector('[data-testid="lesson-context"]')).toBeNull();
  await act(async () => host.querySelector("button")!.click());
  expect(host.querySelector('[data-testid="lesson-context"]')?.textContent).toBe("b:b");
});

it("waits for fresh translations, retries load errors, and isolates an open draft from background updates", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(["courses", "learning-editor", "a", "owner"], snapshot("a", "Cached"));
  client.setQueryData(["courses", "learning-readiness", "a", "owner"], []);
  client.setQueryData(["courses", "learning-publication", "a", "owner"], []);
  let reject!: (error: Error) => void;
  vi.mocked(getLearningEditor).mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
  const router = createMemoryRouter([{ path: "/instructor/courses/:id/edit", element: <LearningCourseEditorRoute /> }], { initialEntries: ["/instructor/courses/a/edit"] });
  const host = document.createElement("div"); const root = createRoot(host);
  cleanup = () => { act(() => root.unmount()); router.dispose(); client.clear(); };
  await act(async () => root.render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>));
  await act(async () => host.querySelector("button")!.click());
  expect(host.querySelector('[data-testid="lesson-context"]')).toBeNull();
  expect(host.textContent).toContain("learning.loading");
  await act(async () => reject(new Error("Network failed")));
  expect(host.textContent).toContain("learning.translationLoadError");
  vi.mocked(getLearningEditor).mockResolvedValueOnce(snapshot("a", "Fresh") as never);
  await act(async () => Array.from(host.querySelectorAll("button")).find(button => button.textContent === "learning.retry")!.click());
  expect(host.querySelector('[data-testid="lesson-context"]')?.textContent).toBe("a:Fresh");
  expect(host.querySelector('[data-testid="lesson-context"]')?.getAttribute("data-locale")).toBe("en");
  await act(async () => { client.setQueryData(["courses", "learning-editor", "a", "owner"], snapshot("a", "Background")); });
  expect(host.querySelector('[data-testid="lesson-context"]')?.textContent).toBe("a:Fresh");
});


it("does not recreate a lesson removed before its fresh snapshot loads", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(["courses", "learning-editor", "a", "owner"], snapshot("a", "Cached"));
  client.setQueryData(["courses", "learning-readiness", "a", "owner"], []);
  client.setQueryData(["courses", "learning-publication", "a", "owner"], []);
  vi.mocked(getLearningEditor).mockResolvedValue(snapshot("a") as never);
  const router = createMemoryRouter([{ path: "/instructor/courses/:id/edit", element: <LearningCourseEditorRoute /> }], { initialEntries: ["/instructor/courses/a/edit"] });
  const host = document.createElement("div"); const root = createRoot(host);
  cleanup = () => { act(() => root.unmount()); router.dispose(); client.clear(); };
  await act(async () => root.render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>));
  await act(async () => host.querySelector("button")!.click());
  expect(host.querySelector('[data-testid="lesson-context"]')).toBeNull();
  expect(host.textContent).toContain("learning.translationLoadError");
});

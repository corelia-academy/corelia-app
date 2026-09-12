// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import Learn from "./Learn";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
  sync: vi.fn(), credential: vi.fn(), setEnrollment: vi.fn(),
  courses: { a: { id: "a", title: "A", published: true }, b: { id: "b", title: "B", published: true } },
}));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: { id: "learner" }, profile: { id: "learner" } }) }));
vi.mock("react-i18next", async (importOriginal) => ({ ...await importOriginal<typeof import("react-i18next")>(), useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/courses", () => ({
  courseHasCertificate: () => false,
  ensureEnrollmentForProgress: async () => null,
  syncCourseCompletion: (...args: unknown[]) => state.sync(...args),
  checkAndIssueCertificate: vi.fn(), getNextLesson: () => null,
  sortLessonsByCurriculum: (lessons: unknown) => lessons, setLessonProgress: vi.fn(),
}));
vi.mock("@/lib/credentialsEdge", () => ({ invokeCheckCourseCredential: (...args: unknown[]) => state.credential(...args) }));
vi.mock("@/lib/learning", () => ({ recordLearningEvent: vi.fn() }));
vi.mock("@/features/learning/invalidateLearningProgress", () => ({ invalidateLearningProgress: vi.fn() }));
vi.mock("./hooks/useLearnCourseLoad", () => ({ useLearnCourseLoad: ({ courseId }: { courseId: "a" | "b" }) => ({ course: state.courses[courseId], lessons: [], sections: [], loading: false }) }));
vi.mock("./hooks/useLearnEnrollmentAccess", () => ({ useLearnEnrollmentAccess: () => ({ enrollment: null, hasFullCourseAccess: true, setEnrollment: state.setEnrollment }) }));
vi.mock("./hooks/useLearnProgress", () => ({ useLearnProgress: ({ courseId }: { courseId: string }) => ({ progressPercent: courseId === "a" ? 100 : 0, completedIds: new Set(), progressList: [], refresh: vi.fn() }) }));
vi.mock("./hooks/useLearnSubmission", () => ({ useLearnSubmission: () => ({ submission: null }) }));
vi.mock("@/features/courses/quizQueries", () => ({ sectionQuizQueryOptions: () => ({ queryKey: ["test-section"], queryFn: async () => ({ questions: [] }), enabled: false }) }));
vi.mock("./components/LessonPlayerCard", () => ({ LessonPlayerCard: ({ courseId }: { courseId: string }) => <p data-testid="course">{courseId}</p> }));
vi.mock("./components/FinalAssignmentPanel", () => ({ FinalAssignmentPanel: () => null }));
vi.mock("./components/SectionQuiz", () => ({ SectionQuiz: () => null }));
vi.mock("./components/LessonCurriculum", () => ({ LessonCurriculum: () => null }));
vi.mock("@/components/courses/CourseCompletionCertificatePanel", () => ({ CourseCompletionCertificatePanel: () => <p data-testid="completed">Completed</p> }));
vi.mock("@/components/ui/sheet", () => {
  const Wrapper = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Sheet: Wrapper, SheetContent: Wrapper, SheetHeader: Wrapper, SheetTitle: Wrapper, SheetTrigger: Wrapper };
});
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); vi.clearAllMocks(); });

it.each([false, true])("keeps completion and credential follow-up in the active course (switch=%s)", async (switchCourse) => {
  let resolveCompletion!: (value: { completed: boolean; completed_at: string }) => void;
  state.sync.mockReturnValue(new Promise(resolve => { resolveCompletion = resolve; }));
  state.credential.mockResolvedValue({ reason: "no_credential" });
  const router = createMemoryRouter([{ path: "/learn/:courseId", element: <Learn /> }], { initialEntries: ["/learn/a"] });
  const client = new QueryClient();
  const host = document.createElement("div");
  const root = createRoot(host);
  cleanup = () => { act(() => root.unmount()); router.dispose(); client.clear(); };
  await act(async () => root.render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>));
  expect(state.sync).toHaveBeenCalledWith("learner", "a");
  if (switchCourse) await act(async () => { await router.navigate("/learn/b"); });
  expect(host.querySelector('[data-testid="course"]')?.textContent).toBe(switchCourse ? "b" : "a");
  await act(async () => resolveCompletion({ completed: true, completed_at: "2026-09-12T00:00:00Z" }));
  expect(Boolean(host.querySelector('[data-testid="completed"]'))).toBe(!switchCourse);
  expect(state.credential).toHaveBeenCalledTimes(switchCourse ? 0 : 1);
});

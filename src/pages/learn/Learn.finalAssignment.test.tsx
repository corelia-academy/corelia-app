// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import Learn from "./Learn";
import { recordLearningEvent } from "@/lib/learning";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
  course: { id: "course", title: "TypeScript", published: true, final_assignment_title: "Task Manager", final_assignment_fields: ["notes"] },
  lessons: [{ id: "article", section_id: "section", title: "Reading", description_markdown: "Article body", lesson_format: "article", published: true, order: 0, duration_seconds: 0 }],
  sections: [{ id: "section", title: "Section", order: 0 }],
  access: true, submission: null as { status: string } | null, submit: vi.fn(),
}));
vi.mock("react-i18next", async importOriginal => ({ ...await importOriginal<typeof import("react-i18next")>(), useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/features/learning/useLearningTranslation", () => ({ useLearningTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: { id: "learner" }, profile: { id: "learner" } }) }));
vi.mock("@/lib/courses", () => ({ courseHasCertificate: () => false, sortLessonsByCurriculum: (lessons: unknown) => lessons, getNextLesson: () => state.lessons[0], resetLessonProgress: vi.fn(), setLessonProgress: vi.fn() }));
vi.mock("@/lib/learning", () => ({ recordLearningEvent: vi.fn() }));
vi.mock("@/lib/credentialsEdge", () => ({ invokeCheckCourseCredential: vi.fn() }));
vi.mock("@/lib/storage", () => ({ uploadFinalAssignmentFile: vi.fn() }));
vi.mock("./hooks/useLearnCourseLoad", () => ({ useLearnCourseLoad: () => ({ course: state.course, lessons: state.lessons, sections: state.sections, loading: false }) }));
vi.mock("./hooks/useLearnEnrollmentAccess", () => ({ useLearnEnrollmentAccess: () => ({ hasFullCourseAccess: state.access, enrollment: null }) }));
vi.mock("./hooks/useLearnProgress", () => ({ useLearnProgress: () => ({ progressPercent: 0, completedIds: new Set(), progressList: [] }) }));
vi.mock("./hooks/useLearnSubmission", () => ({ useLearnSubmission: () => ({ state: "ready", submission: state.submission, submit: state.submit }) }));
vi.mock("./components/LessonPlayerCard", () => ({ LessonPlayerCard: ({ lesson }: { lesson: { description_markdown: string } }) => <p data-testid="article">{lesson?.description_markdown}</p> }));
vi.mock("@/components/ui/sheet", () => {
  const Wrapper = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Sheet: Wrapper, SheetContent: Wrapper, SheetHeader: Wrapper, SheetTitle: Wrapper, SheetTrigger: Wrapper };
});
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); vi.clearAllMocks(); vi.restoreAllMocks(); state.access = true; state.course.final_assignment_title = "Task Manager"; state.submission = null; });

async function mount(path: string) {
  const router = createMemoryRouter(["/learn/:courseId", "/learn/:courseId/lesson/:lessonId", "/learn/:courseId/final-assignment"].map(path => ({ path, element: <Learn /> })), { initialEntries: [path] });
  const client = new QueryClient(); const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  cleanup = () => { act(() => root.unmount()); router.dispose(); client.clear(); host.remove(); };
  await act(async () => root.render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>));
  return { host, router };
}

it.each([false, true])("separates article and final assignment with Back/Forward (desktop=%s)", async desktop => {
  const match = window.matchMedia.bind(window);
  vi.spyOn(window, "matchMedia").mockImplementation(query => Object.defineProperty(match(query), "matches", { value: desktop }));
  const { host, router } = await mount("/learn/course/lesson/article");
  expect(host.querySelector('[data-testid="article"]')?.textContent).toBe("Article body");
  expect(host.querySelector("#final-assignment")).toBeNull();
  const link = host.querySelector<HTMLAnchorElement>('a[href="/learn/course/final-assignment"]')!;
  expect(link).toBeTruthy();
  vi.mocked(recordLearningEvent).mockClear();
  await act(async () => link.click());
  expect(router.state.location.pathname).toBe("/learn/course/final-assignment");
  expect(host.querySelector('[data-testid="article"]')).toBeNull();
  expect(host.querySelector("#final-assignment h1")?.textContent).toBe("Task Manager");
  expect(host.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe("/learn/course/final-assignment");
  expect(recordLearningEvent).not.toHaveBeenCalled();
  await act(async () => { await router.navigate(-1); });
  expect(host.querySelector('[data-testid="article"]')).not.toBeNull();
  expect(host.querySelector("#final-assignment")).toBeNull();
  await act(async () => { await router.navigate(1); });
  expect(host.querySelector("#final-assignment")).not.toBeNull();
});

it("opens the final assignment directly, submits, and restores its status on reload", async () => {
  const { host, router } = await mount("/learn/course/final-assignment");
  expect(router.state.location.pathname).toBe("/learn/course/final-assignment");
  expect(recordLearningEvent).not.toHaveBeenCalled();
  const input = host.querySelector<HTMLInputElement>("#final-assignment input")!;
  act(() => { Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")!.set!.call(input, "My project notes"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  await act(async () => Array.from(host.querySelectorAll("button")).find(button => button.textContent === "detail.learn.finalAssignment.submit")!.click());
  expect(state.submit).toHaveBeenCalledWith(expect.objectContaining({ artifacts: { notes: "My project notes" } }));
  cleanup?.();
  state.submission = { status: "pending" };
  const reloaded = await mount("/learn/course/final-assignment");
  expect(reloaded.host.textContent).toContain("detail.learn.finalAssignment.status.pending");
});

it.each(["missing", "denied"])("shows a clear unavailable state when %s", async reason => {
  if (reason === "missing") state.course.final_assignment_title = "";
  else state.access = false;
  const { host, router } = await mount("/learn/course/final-assignment");
  expect(router.state.location.pathname).toBe("/learn/course/final-assignment");
  expect(host.querySelector("#final-assignment")).toBeNull();
  expect(host.textContent).toContain(reason === "missing" ? "detail.learn.finalAssignmentUnavailable" : "detail.learn.finalAssignmentAccessRequired");
  expect(host.querySelector('a[href="/courses/course"]')).not.toBeNull();
});


it("keeps the practice handoff across routes when browser storage is blocked", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage denied"); });
  const { host, router } = await mount("/learn/course/lesson/article");
  act(() => {
    window.dispatchEvent(new CustomEvent("learning:final-artifacts", { detail: { userId: "learner", courseId: "course", artifacts: { notes: "Completed practice" } } }));
    window.dispatchEvent(new CustomEvent("learning:final-artifacts", { detail: { userId: "other", courseId: "course", artifacts: { notes: "Other user" } } }));
    window.dispatchEvent(new CustomEvent("learning:final-artifacts", { detail: { userId: "learner", courseId: "other", artifacts: { notes: "Other course" } } }));
  });
  await act(async () => { await router.navigate("/learn/course/final-assignment"); });
  expect(host.querySelector<HTMLInputElement>("#final-assignment input")?.value).toBe("Completed practice");
});

// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import LearningPreview from "./LearningPreview";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ isPending: true }) }));
vi.mock("@/features/learning/useLearningTranslation", () => ({ useLearningTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/learning", () => ({ getLearningPreview: vi.fn() }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: { id: "instructor" } }) }));
vi.mock("@/pages/learn/components/LessonPlayerCard", () => ({ LessonPlayerCard: () => null }));

let cleanup: () => void;
afterEach(() => cleanup?.());
const editorPath = "/instructor/courses/course/edit";
const previewPath = "/instructor/courses/course/preview/lesson";

function mount(fromEditor: boolean, hash = "#content") {
  const origin = { pathname: editorPath, search: "?context=edit", hash };
  const router = createMemoryRouter([
    { path: "/instructor/courses/:id/preview/:lessonId?", element: <LearningPreview /> },
    { path: "/instructor/courses/:id/edit", element: <div>Editor</div> },
  ], {
    initialEntries: fromEditor ? [
      `${editorPath}#info`,
      `${origin.pathname}${origin.search}${origin.hash}`,
      { pathname: previewPath, state: { editorLocation: origin } },
    ] : [previewPath],
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(<RouterProvider router={router} />));
  cleanup = () => { act(() => root.unmount()); router.dispose(); container.remove(); };
  return { router, container };
}

it.each(["#content", "#assignments", ""])("returns to the original editor entry (%s) and preserves earlier tab history", async hash => {
  const { router, container } = mount(true, hash);
  const back = container.querySelector("a")!;
  expect(back.getAttribute("href")).toBe(`${editorPath}?context=edit${hash}`);
  await act(async () => back.click());
  expect(router.state.historyAction).toBe("POP");
  expect(router.state.location).toMatchObject({ pathname: editorPath, search: "?context=edit", hash });
  await act(async () => router.navigate(-1));
  expect(router.state.location.hash).toBe("#info");
});

it("returns direct preview visits to the content tab without leaving a preview loop", async () => {
  const { router, container } = mount(false);
  await act(async () => container.querySelector("a")!.click());
  expect(router.state.historyAction).toBe("REPLACE");
  expect(router.state.location).toMatchObject({ pathname: editorPath, hash: "#content" });
});

it("lets browser Back restore the original editor entry", async () => {
  const { router } = mount(true);
  await act(async () => router.navigate(-1));
  expect(router.state.location).toMatchObject({ pathname: editorPath, hash: "#content" });
});

// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { LessonReadinessBadge } from "./LessonReadinessBadge";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("../useLearningTranslation", () => ({ useLearningTranslation: () => ({ t: (key: string) => key }) }));

it("shows loading, ready, actionable issues, and retry without treating failed stale data as ready", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const onOpen = vi.fn(), onRetry = vi.fn();
  const render = (issues: string[] | undefined, failed = false) => act(() => root.render(<LessonReadinessBadge issues={issues} failed={failed} onOpen={onOpen} onRetry={onRetry} />));
  render(undefined);
  expect(container.textContent).toBe("learning.loading");
  render([]);
  expect(container.textContent).toBe("learning.ready");
  render(["content_required"]);
  expect(container.querySelector("button")?.title).toBe("learning.validation.content_required");
  act(() => container.querySelector("button")!.click());
  expect(onOpen).toHaveBeenCalledOnce();
  render([], true);
  expect(container.textContent).toBe("learning.readinessRetry");
  act(() => container.querySelector("button")!.click());
  expect(onRetry).toHaveBeenCalledOnce();
  act(() => root.unmount());
});

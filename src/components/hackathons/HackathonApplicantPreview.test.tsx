// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { HackathonApplicantPreview } from "./HackathonApplicantPreview";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const applicants = Array.from({ length: 20 }, (_, index) => ({
  user_id: `applicant-${index}`,
  username: `applicant-${index}`,
  full_name: `Applicant ${index}`,
  avatar_seed: null,
  avatar_config: null,
}));

afterEach(() => vi.restoreAllMocks());

it("uses the available row width and puts only hidden applicants in +N", async () => {
  let width = 120;
  let onResize = () => {};
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ width }) as DOMRect);
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { onResize = callback; }
    observe() {}
    disconnect() {}
  });

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(<HackathonApplicantPreview applicants={applicants} count={20} label="Applications" />));

  expect(container.querySelectorAll("[data-slot='avatar']")).toHaveLength(3);
  expect(container.querySelector("[data-slot='avatar-group-count']")?.textContent).toBe("+17");

  width = 320;
  await act(async () => onResize());
  expect(container.querySelectorAll("[data-slot='avatar']")).toHaveLength(11);
  expect(container.querySelector("[data-slot='avatar-group-count']")?.textContent).toBe("+9");

  width = 600;
  await act(async () => onResize());
  expect(container.querySelectorAll("[data-slot='avatar']")).toHaveLength(20);
  expect(container.querySelector("[data-slot='avatar-group-count']")).toBeNull();
  expect(container.querySelector("[data-slot='avatar-group']")?.getAttribute("aria-label")).toBe("Applications: 20");

  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

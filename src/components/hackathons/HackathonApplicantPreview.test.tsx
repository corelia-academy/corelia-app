// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import { HackathonApplicantPreview } from "./HackathonApplicantPreview";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const applicants = Array.from({ length: 20 }, (_, index) => ({
  user_id: `applicant-${index}`,
  username: `applicant-${index}`,
  full_name: `Applicant ${index}`,
  avatar_seed: null,
  avatar_config: null,
}));

async function renderPreview(count: number, available = applicants) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(<HackathonApplicantPreview applicants={available} count={count} label="Applications" />));
  return {
    container,
    cleanup: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

it.each([
  { count: 3, avatars: 3, remainder: null },
  { count: 5, avatars: 5, remainder: null },
  { count: 20, avatars: 5, remainder: "+15" },
])("shows at most five of $count applicants", async ({ count, avatars, remainder }) => {
  const view = await renderPreview(count);

  expect(view.container.querySelectorAll("[data-slot='avatar']")).toHaveLength(avatars);
  expect(view.container.querySelector("[data-slot='avatar-group-count']")?.textContent ?? null).toBe(remainder);
  expect(view.container.querySelector("[data-slot='avatar-group']")?.getAttribute("aria-label")).toBe("Applications: " + count);

  await view.cleanup();
});

it("counts applicants without public avatars in the remainder", async () => {
  const view = await renderPreview(20, applicants.slice(0, 2));

  expect(view.container.querySelectorAll("[data-slot='avatar']")).toHaveLength(2);
  expect(view.container.querySelector("[data-slot='avatar-group-count']")?.textContent).toBe("+18");

  await view.cleanup();
});

it.each([
  { count: 0, displayed: "0" },
  { count: 20, displayed: "20" },
])("shows $displayed without an avatar group when no public avatars are available", async ({ count, displayed }) => {
  const view = await renderPreview(count, []);

  expect(view.container.querySelector("[data-slot='avatar-group']")).toBeNull();
  expect(view.container.textContent).toContain(displayed);

  await view.cleanup();
});

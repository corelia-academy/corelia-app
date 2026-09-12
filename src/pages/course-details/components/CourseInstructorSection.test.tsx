// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { CourseInstructorSection } from "./CourseInstructorSection";
import { parseCourseInstructors } from "@/features/learning/courseInstructors";
import { getPublicProfileById } from "@/lib/profile";
import type { PublicProfile } from "@/types/database";
import type { CourseCoInstructorSnapshot } from "@/types/courses";
import type { CourseInstructorRef } from "@/features/learning/types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/profile", () => ({ getPublicProfileById: vi.fn() }));
const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.clearAllMocks(); });
const person = (id: string) => ({ id, full_name: `Person ${id}`, role: "instructor" }) as PublicProfile;

async function mount(instructors?: CourseInstructorRef[], coInstructors?: CourseCoInstructorSnapshot[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement("div");
  const root = createRoot(container);
  cleanups.push(() => { act(() => root.unmount()); client.clear(); });
  await act(async () => {
    root.render(<QueryClientProvider client={client}><MemoryRouter>
      <CourseInstructorSection profile={person("owner")} instructors={instructors} coInstructors={coInstructors} />
    </MemoryRouter></QueryClientProvider>);
  });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  return { container, client };
}

it("renders ordered public attribution and labels without implicitly showing the owner", async () => {
  vi.mocked(getPublicProfileById).mockImplementation(async id => id === "gone" ? null : person(id));
  const { container } = await mount([
    { profile_id: "b", order: 2, role_label: "Guest" },
    { profile_id: "a", order: 0, role_label: "Lead" },
    { profile_id: "gone", order: 1 },
  ]);
  expect([...container.querySelectorAll("a")].map(link => link.getAttribute("href"))).toEqual(["/instructors/a", "/instructors/b"]);
  expect(container.textContent).toContain("Lead");
  expect(container.textContent).toContain("Guest");
  expect(container.textContent).not.toContain("Person owner");
  expect(container.textContent).not.toContain("gone");
});

it("preserves the legacy display when metadata is absent or malformed, but respects an explicit empty list", async () => {
  expect((await mount()).container.textContent).toContain("Person owner");
  expect((await mount({ bad: true } as unknown as CourseInstructorRef[])).container.textContent).toContain("Person owner");
  expect((await mount([])).container.textContent).toBe("");
  expect(getPublicProfileById).not.toHaveBeenCalled();
});

it("allows retry after a profile lookup failure instead of treating it as an empty list", async () => {
  vi.mocked(getPublicProfileById).mockRejectedValueOnce(new Error("offline")).mockResolvedValue(person("a"));
  const { container } = await mount([{ profile_id: "a", order: 0 }]);
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  await act(async () => container.querySelector("button")!.click());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  expect(container.textContent).toContain("Person a");
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

it("does not sanitize malformed metadata or mutate stored order while reading", () => {
  for (const raw of [null, {}, [{ profile_id: "a", order: 0, role_label: {} }], [{ profile_id: "a", order: -1 }], [{ profile_id: "a", order: 0 }, { profile_id: "a", order: 1 }]]) {
    expect(parseCourseInstructors(raw)).toBeNull();
  }
  const original = [{ profile_id: "b", order: 1 }, { profile_id: "a", order: 0 }];
  expect(parseCourseInstructors(original)?.[0].profile_id).toBe("a");
  expect(original[0].profile_id).toBe("b");
});

 it("retains existing co-instructor visibility and new accepted co-instructors without duplicate cards", async () => {
  vi.mocked(getPublicProfileById).mockImplementation(async id => person(id));
  const { container } = await mount([{ profile_id: "hidden", order: 0 }, { profile_id: "shown", order: 1 }], [
    { id: "hidden", name: "Hidden", show_on_course_page: false },
    { id: "shown", name: "Shown", show_on_course_page: true },
    { id: "new", name: "New", show_on_course_page: true },
  ]);
  expect([...container.querySelectorAll("a")].map(link => link.getAttribute("href"))).toEqual(["/instructors/shown", "/instructors/new"]);
  expect(getPublicProfileById).not.toHaveBeenCalledWith("hidden");
});

it("links non-instructor attribution to its public handle and omits links without a handle", async () => {
  vi.mocked(getPublicProfileById).mockImplementation(async id => ({ ...person(id), role: "student", username: id === "a" ? "guest" : null }) as PublicProfile);
  const { container } = await mount([{ profile_id: "a", order: 0 }, { profile_id: "b", order: 1 }]);
  expect([...container.querySelectorAll("a")].map(link => link.getAttribute("href"))).toEqual(["/@guest"]);
  expect(container.textContent).toContain("Person b");
});

// @vitest-environment happy-dom
import { act, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { CourseResources } from "./CourseResources";
import { LearnSidebar } from "@/pages/learn/components/LearnSidebar";
import { CourseResourcesEditor } from "@/pages/instructor-course-edit/components/CourseResourcesEditor";
import type { CourseResource } from "@/types/courses";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, options?: { count: number }) => options ? `${key}-${options.count}` : key }) }));
let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());
async function render(ui: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  cleanup = () => { act(() => root.unmount()); host.remove(); };
  await act(async () => root.render(ui));
  return host;
}
const resources: CourseResource[] = [{ title: "Docs", url: "https://example.com/docs", icon: "document" }, { title: "Community", url: "https://example.com/community", icon: "discord" }];

it("hides an empty public section and filters malformed resources", async () => {
  const host = await render(<><CourseResources resources={undefined} /><CourseResources resources={[null, { title: "Unsafe", url: "javascript:alert(1)" }, ...resources]} /></>);
  expect(host.querySelectorAll("section")).toHaveLength(1);
  expect(Array.from(host.querySelectorAll("a")).map(link => link.getAttribute("href"))).toEqual(resources.map(resource => resource.url));
  expect(host.querySelector("a")?.target).toBe("_blank");
  expect(host.querySelector("a")?.rel).toContain("noopener");
  expect(host.querySelectorAll('[data-slot="course-resource-icon"]')).toHaveLength(2);
});

it.each([{ items: resources }, { items: [] }])("opens curriculum first and switches to shared resources (%j)", async ({ items }) => {
  const host = await render(<LearnSidebar curriculum={<p>Lessons</p>} resources={items} />);
  const tabs = host.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  expect(tabs[0].getAttribute("aria-selected")).toBe("true");
  await act(async () => tabs[1].click());
  expect(tabs[1].getAttribute("aria-selected")).toBe("true");
  if (items.length) expect(host.querySelectorAll("a")).toHaveLength(2);
  else expect(host.textContent).toContain("courseResources.empty");
});

it("adds, reorders and removes resources in the authoring form", async () => {
  function Editor() {
    const [value, onChange] = useState(resources);
    return <CourseResourcesEditor value={value} onChange={onChange} />;
  }
  const host = await render(<Editor />);
  const click = async (label: string) => act(async () => host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
  await click("courseResources.moveDown-1");
  expect(host.querySelector("input")?.value).toBe("Community");
  await click("courseResources.moveUp-2");
  expect(host.querySelector("input")?.value).toBe("Docs");
  await click("courseResources.remove-1");
  expect(host.querySelectorAll("input")).toHaveLength(2);
  const add = Array.from(host.querySelectorAll("button")).find(button => button.textContent?.includes("courseResources.add"))!;
  await act(async () => add.click());
  expect(host.querySelectorAll("input")).toHaveLength(4);
  expect(host.querySelectorAll("input")[2].value).toBe("");
  const iconSelect = host.querySelectorAll<HTMLSelectElement>("select")[1];
  await act(async () => {
    iconSelect.value = "github";
    iconSelect.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(host.querySelectorAll<HTMLSelectElement>("select")[1].value).toBe("github");
});

it("disables the resources fieldset during save", async () => {
  const host = await render(<CourseResourcesEditor value={resources} onChange={vi.fn()} disabled />);
  expect(host.querySelector("fieldset")?.disabled).toBe(true);
});

// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { PracticeProjectField, PracticeProjectLink } from "./PracticeProject";
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("./useLearningTranslation", () => ({ useLearningTranslation: () => ({ t: (key: string) => key, i18n: { language: "vi" } }) }));
vi.mock("@/features/projects/projectQueries", () => ({
  publicProjectDirectoryQueryOptions: (locale: string) => ({ queryKey: ["directory", locale], queryFn: vi.fn(), initialPageParam: null, getNextPageParam: () => undefined, staleTime: Infinity }),
  publicProjectDetailQueryOptions: (id: string | undefined, locale: string) => ({ queryKey: ["project", id, locale], queryFn: vi.fn(), enabled: Boolean(id), staleTime: Infinity }),
}));
const cleanups: Array<() => void> = [];
afterEach(() => cleanups.splice(0).forEach(cleanup => cleanup()));
function render(element: ReactNode, detail: unknown = null) {
  const client = new QueryClient();
  client.setQueryData(["directory", "vi"], { pages: [{ items: [{ project: { id: "first", slug: "first-project", title: "First", visibility: "public" }, owner: null }] }], pageParams: [null] });
  client.setQueryData(["project", "selected", "vi"], detail ? { project: detail, owner: null } : null);
  client.setQueryData(["project", "selected", "en"], detail ? { project: detail, owner: null } : null);
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(<QueryClientProvider client={client}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>));
  cleanups.push(() => { act(() => root.unmount()); client.clear(); });
  return container;
}
it("retains a selected project outside the first directory page and removes missing references", () => {
  const onChange = vi.fn();
  const container = render(<PracticeProjectField value="selected" onChange={onChange} />, { id: "selected", title: "Selected", visibility: "public" });
  const select = container.querySelector("select")!;
  expect(select.selectedOptions[0].textContent).toBe("Selected");
  act(() => { select.value = "first"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(onChange).toHaveBeenLastCalledWith("first");
  act(() => { select.value = ""; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(onChange).toHaveBeenLastCalledWith(undefined);
});
it.each([null, { visibility: "private" }, { visibility: "unlisted" }, { visibility: "public", blocked: true }])("hides inaccessible projects even when cached for an authorized viewer: %j", project => {
  const container = render(<PracticeProjectLink id="selected" />, project);
  expect(container.querySelector("a")).toBeNull();
  expect(container.textContent).toBe("learning.relatedUnavailable");
});
it("uses the existing project route and requested locale", () => {
  const container = render(<PracticeProjectLink id="selected" locale="en" />, { id: "selected", slug: "rust-cli", title: "English project", visibility: "public" });
  expect(container.querySelector("a")?.getAttribute("href")).toBe("/projects/rust-cli");
  expect(container.textContent).toContain("English project");
});

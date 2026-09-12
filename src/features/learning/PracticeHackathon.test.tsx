// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { PracticeHackathonField, PracticeHackathonLink } from "./PracticeHackathon";
import { publicHackathonCatalogQueryOptions } from "@/features/hackathons/hackathonQueries";
import type { ReactNode } from "react";
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("./useLearningTranslation", () => ({ useLearningTranslation: () => ({ t: (key: string) => key, i18n: { language: "vi" } }) }));
vi.mock("@/features/hackathons/hackathonQueries", () => ({ publicHackathonCatalogQueryOptions: vi.fn((locale: string) => ({ queryKey: ["public-hackathons", locale], queryFn: vi.fn(), staleTime: Infinity })) }));
const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.clearAllMocks(); });
function render(element: ReactNode) {
  const client = new QueryClient();
  client.setQueryData(["public-hackathons", "vi"], [{ id: "public", title: "Hackathon VI", slug: "build-cli" }, { id: "no-route", title: "Legacy without slug" }]);
  client.setQueryData(["public-hackathons", "en"], [{ id: "public", title: "Hackathon EN", slug: "build-cli" }]);
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(<QueryClientProvider client={client}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>));
  cleanups.push(() => { act(() => root.unmount()); client.clear(); });
  return container;
}
it("selects an existing public catalog ID and can remove an unavailable reference", () => {
  const onChange = vi.fn();
  const container = render(<PracticeHackathonField value="removed" onChange={onChange} />);
  const select = container.querySelector("select")!;
  expect(select.value).toBe("removed");
  expect(Array.from(select.options, option => option.value)).not.toContain("no-route");
  act(() => { select.value = "public"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(onChange).toHaveBeenLastCalledWith("public");
  act(() => { select.value = ""; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(onChange).toHaveBeenLastCalledWith(undefined);
});
it("uses the preview content locale and existing hackathon route", () => {
  const container = render(<PracticeHackathonLink id="public" locale="en" />);
  expect(publicHackathonCatalogQueryOptions).toHaveBeenCalledWith("en");
  expect(container.querySelector("a")?.getAttribute("href")).toBe("/hackathons/build-cli");
  expect(container.textContent).toContain("Hackathon EN");
});
it("does not emit a link for an inaccessible or deleted reference", () => {
  const container = render(<PracticeHackathonLink id="private-or-deleted" />);
  expect(container.querySelector("a")).toBeNull();
  expect(container.textContent).toBe("learning.relatedUnavailable");
});

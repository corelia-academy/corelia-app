// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, queryOptions } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserProfileProjectsSection } from "./UserProfileProjectsSection";
import type { PublicProfile } from "@/types/database";

const own = Array.from({ length: 5 }, (_, index) => ({ id: `own-${index}`, owner_id: "profile-1", title: `Own ${index}` }));
const saved = Array.from({ length: 5 }, (_, index) => ({ project: { id: `saved-${index}`, owner_id: "other", title: `Saved ${index}` }, owner: null }));
const state = { savedIds: saved.map(({ project }) => project.id) };

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en", resolvedLanguage: "en" } }) }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: { id: "profile-1" } }) }));
vi.mock("@/components/projects/ProjectCard", () => ({ ProjectCard: ({ project }: { project: { title: string } }) => <article>{project.title}</article> }));
vi.mock("@/features/profiles/publicProfileQueries", () => ({
  publicProfileProjectsQueryOptions: () => queryOptions({ queryKey: ["t", "own"], queryFn: async () => own }),
}));
vi.mock("@/features/projects/projectSaveQueries", () => ({
  mySavedProjectIdsQueryOptions: (_userId: string | undefined, enabled: boolean) =>
    queryOptions({ queryKey: ["t", "saved-ids", enabled, state.savedIds.length], queryFn: async () => state.savedIds, enabled }),
  projectSavesQueryOptions: () => queryOptions({ queryKey: ["t", "saves"], queryFn: async () => new Set<string>() }),
}));
vi.mock("@/features/projects/projectQueries", () => ({
  publicProjectEntriesByIdsQueryOptions: (ids: string[]) =>
    queryOptions({ queryKey: ["t", "entries", ids.length], queryFn: async () => (ids.length ? saved : []), enabled: ids.length > 0 }),
  publicProjectTeamsQueryOptions: () => queryOptions({ queryKey: ["t", "teams"], queryFn: async () => ({}) }),
}));
vi.mock("@/features/projects/projectSocialQueries", () => ({
  projectHeartsQueryOptions: () => queryOptions({ queryKey: ["t", "hearts"], queryFn: async () => new Set<string>() }),
}));
vi.mock("@/features/hackathons/hackathonQueries", () => ({
  publicHackathonCatalogQueryOptions: () => queryOptions({ queryKey: ["t", "hackathons"], queryFn: async () => [] }),
}));
vi.mock("@/lib/projectTaxonomy", () => ({ listProjectTaxonomyOptions: async () => [] }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); state.savedIds = saved.map(({ project }) => project.id); });

const profile = { id: "profile-1", full_name: "Admin", username: "admin" } as PublicProfile;

async function render(isSelf: boolean) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  cleanup = () => { act(() => root.unmount()); queryClient.clear(); container.remove(); };
  await act(async () => {
    root.render(<QueryClientProvider client={queryClient}><UserProfileProjectsSection profile={profile} isSelf={isSelf} /></QueryClientProvider>);
  });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 60)); });
  return container;
}

const titles = (section: Element | null) => [...(section?.querySelectorAll("article") ?? [])].map((card) => card.textContent);
const click = (container: HTMLElement, text: string) => act(async () => [...container.querySelectorAll("button")].find((b) => b.textContent === text)!.click());

describe("UserProfileProjectsSection", () => {
  it("shows my projects with 4 cards, then all of them", async () => {
    const container = await render(true);
    const section = container.querySelector('section[aria-label="userProfile.projects.mine"]');
    expect(titles(section)).toHaveLength(4);
    await click(container, "userProfile.xpHistory.viewAll");
    expect(titles(section)).toHaveLength(5);
  });

  it("shows saved projects only to the owner, 4 cards (2 rows of 2) with view all / show less", async () => {
    const container = await render(true);
    const section = container.querySelector('section[aria-label="userProfile.projects.saved"]')!;
    expect(titles(section)).toEqual(["Saved 0", "Saved 1", "Saved 2", "Saved 3"]);
    expect(section.querySelector(".grid")?.className).toContain("sm:grid-cols-2");
    const viewAll = [...section.querySelectorAll("button")].find((b) => b.textContent === "userProfile.xpHistory.viewAll")!;
    await act(async () => viewAll.click());
    expect(titles(section)).toHaveLength(5);
    await act(async () => [...section.querySelectorAll("button")].find((b) => b.textContent === "userProfile.xpHistory.collapse")!.click());
    expect(titles(section)).toHaveLength(4);
  });

  it("hides saved projects from visitors", async () => {
    const visitor = await render(false);
    expect(visitor.querySelector('section[aria-label="userProfile.projects.saved"]')).toBeNull();
  });

  it("still shows the saved block with an empty message when the owner saved nothing", async () => {
    state.savedIds = [];
    const owner = await render(true);
    const section = owner.querySelector('section[aria-label="userProfile.projects.saved"]')!;
    expect(section.textContent).toContain("userProfile.projects.savedEmpty");
    expect(titles(section)).toHaveLength(0);
  });
});

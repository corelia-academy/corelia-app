// @vitest-environment happy-dom
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Contest } from "@/types/hackathons";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
  auth: {
    user: { id: "admin-1" },
    profile: { id: "admin-1", role: "admin" },
    profileLoading: false,
    authInitialized: true,
  } as Record<string, unknown>,
}));

const draftContest = {
  id: "hackathon-1",
  slug: "draft-demo",
  title: "Draft Demo",
  tagline: "Draft summary",
  short_description: "Draft summary",
  description_markdown: "Draft description",
  status: "draft",
  location: "online",
  mode: "online",
  participants_count: 0,
  cover_image_url: null,
  host: { name: "Corelia", logo_url: null, website_url: null },
  social_links: {},
  registration_deadline: null,
  submission_deadline: null,
  tracks: [],
  sectors: [],
  tech_stacks: [],
  timeline: [],
  winner_awards: [],
} as unknown as Contest;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key === "public.previewNotice" ? "Preview notice" : key,
    i18n: { language: "vi", resolvedLanguage: "vi" },
  }),
}));

vi.mock("@/stores/authStore", () => ({ useAuth: () => state.auth }));
vi.mock("@/lib/hackathons", () => ({
  getMyContestRegistration: vi.fn(async () => null),
  registerForContest: vi.fn(),
}));
vi.mock("@/features/hackathons/hackathonQueries", () => ({
  publicHackathonDetailQueryOptions: (_slug: string, _locale: string, enabled: boolean) => ({
    queryKey: ["hackathons", "public-test"],
    queryFn: async () => null,
    enabled,
  }),
  hackathonPreviewQueryOptions: (_slug: string, _locale: string, _userId: string, enabled: boolean) => ({
    queryKey: ["hackathons", "preview-test"],
    queryFn: async () => draftContest,
    enabled,
  }),
}));

import ContestPublicLayout from "./ContestPublicLayout";

function renderRoute(entry: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/hackathons/:slug" element={<ContestPublicLayout />}>
              <Route path="overview" element={<div>Overview content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  return {
    container,
    cleanup: async () => {
      await act(async () => root.unmount());
      queryClient.clear();
      container.remove();
    },
  };
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

describe("draft hackathon preview", () => {
  beforeEach(() => {
    state.auth = {
      user: { id: "admin-1" },
      profile: { id: "admin-1", role: "admin" },
      profileLoading: false,
      authInitialized: true,
    };
    window.scrollTo = vi.fn();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollTo = vi.fn();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders an admin-only, read-only draft preview and preserves preview tabs", async () => {
    const view = renderRoute("/hackathons/draft-demo/overview?preview=1");
    await settle();

    expect(view.container.textContent).toContain("Draft Demo");
    expect(view.container.textContent).toContain("Preview notice");
    expect(view.container.textContent).not.toContain("public.register");
    expect(view.container.textContent).not.toContain("public.createProject");
    const tabLinks = Array.from(view.container.querySelectorAll("nav a"));
    expect(tabLinks).toHaveLength(5);
    expect(tabLinks.every((link) => link.getAttribute("href")?.endsWith("?preview=1"))).toBe(true);

    await view.cleanup();
  });

  it("does not expose a draft preview to a non-manager", async () => {
    state.auth = {
      user: { id: "learner-1" },
      profile: { id: "learner-1", role: "student" },
      profileLoading: false,
      authInitialized: true,
    };
    const view = renderRoute("/hackathons/draft-demo/overview?preview=1");
    await settle();

    expect(view.container.textContent).toContain("detail.errors.notFound");
    expect(view.container.textContent).not.toContain("Draft Demo");

    await view.cleanup();
  });
});

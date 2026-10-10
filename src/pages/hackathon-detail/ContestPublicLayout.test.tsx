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
  publicContest: null as Contest | null,
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
  prize_pool: { amount: "100000000", currency: "VND" },
  cover_image_url: "https://cdn.example.com/banner.png",
  host: { name: "Corelia", logo_url: null, website_url: null },
  social_links: { x: "https://x.com/corelia" },

  submission_deadline: null,
  tracks: [],
  sectors: [],
  tech_stacks: [],
  timeline: [],
  winner_awards: [],
} as unknown as Contest;

const publishedContest = {
  ...draftContest,
  id: "hackathon-2",
  slug: "published-demo",
  title: "Published Demo",
  status: "published",
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
  getMyContestSubmission: vi.fn(async () => null),
  getEffectiveContestSubmissionDeadline: (contest: { submission_deadline?: string | null; ends_at?: string | null }) =>
    contest.submission_deadline?.trim() || contest.ends_at?.trim() || null,
  registerForContest: vi.fn(),
  canRegisterForContest: vi.fn((c) => c?.status === "published" || c?.status === "running"),
  isPastContestSubmissionDeadline: vi.fn(() => false),
  sanitizeSlug: (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : null),
}));
vi.mock("@/features/hackathons/hackathonQueries", () => ({
  publicHackathonApplicantPreviewsQueryOptions: (ids: string[]) => ({
    queryKey: ["hackathons", "applicant-test", ...ids],
    queryFn: async () => ({
      "hackathon-2": [{
        user_id: "applicant-1",
        username: "applicant",
        full_name: "Applicant One",
        avatar_seed: null,
        avatar_config: null,
      }],
    }),
    enabled: ids.length > 0,
  }),
  publicHackathonDetailQueryOptions: (_slug: string, _locale: string, enabled: boolean) => ({
    queryKey: ["hackathons", "public-test"],
    queryFn: async () => state.publicContest ?? publishedContest,
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
    state.publicContest = null;
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
    expect(view.container.textContent).not.toContain("public.status.draft");
    expect(view.container.textContent).not.toContain("public.mode.online");
    expect(view.container.textContent).not.toContain("public.register");
    expect(view.container.textContent).not.toContain("public.createProject");
    const tabLinks = Array.from(view.container.querySelectorAll("nav a"));
    expect(tabLinks).toHaveLength(5);
    expect(tabLinks.every((link) => link.getAttribute("href")?.endsWith("?preview=1"))).toBe(true);

    await view.cleanup();
  });

  it("shows the full banner without a dark content overlay and uses the X brand icon", async () => {
    const view = renderRoute("/hackathons/draft-demo/overview?preview=1");
    await settle();

    const banner = view.container.querySelector<HTMLImageElement>("img[src='https://cdn.example.com/banner.png']");
    expect(banner?.parentElement?.className).toContain("aspect-[21/9]");
    expect(view.container.querySelector(".bg-gradient-to-t")).toBeNull();
    expect(view.container.querySelector("h1")?.closest(".absolute")).toBeNull();

    const xLink = view.container.querySelector<HTMLAnchorElement>('a[aria-label="X"]');
    expect(xLink?.href).toBe("https://x.com/corelia");
    expect(xLink?.querySelector('[data-social-icon="x"]')).not.toBeNull();
    expect(xLink?.querySelector(".lucide-external-link")).toBeNull();

    await view.cleanup();
  });

  it("places the public status by the title without covering the banner", async () => {
    const view = renderRoute("/hackathons/published-demo/overview");
    await settle();

    const status = view.container.querySelector<HTMLElement>("[data-hackathon-hero-status]");
    expect(status?.textContent).toBe("public.status.published");
    expect(status?.closest("header")?.querySelector("img")).not.toBeNull();
    expect(status?.parentElement?.querySelector("h1")).not.toBeNull();
    expect(status?.parentElement?.querySelector("img")).toBeNull();
    expect(view.container.querySelector(".bg-gradient-to-t")).toBeNull();

    await view.cleanup();
  });

  it("shows applicant avatars with the total in the public detail", async () => {
    state.publicContest = { ...publishedContest, participants_count: 119 };
    const view = renderRoute("/hackathons/published-demo/overview");
    await settle();

    expect(view.container.querySelector("[data-slot='avatar-group']")).not.toBeNull();
    expect(view.container.querySelector("[data-slot='avatar-group-count']")?.textContent).toBe("+118");
    expect(view.container.textContent).toContain("public.applications");
    expect(view.container.querySelector("[data-slot='avatar-group']")?.getAttribute("aria-label")).toBe("public.applications: 119");
    expect(view.container.querySelector("[data-hackathon-metadata]")?.className).toContain("sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]");
    expect(view.container.querySelector("[data-slot='avatar-group']")?.closest(".col-span-2")?.className).toContain("sm:col-span-1");

    await view.cleanup();
  });

  it.each([
    ["/hackathons/published-demo/overview", "/hackathons/published-demo/prizes"],
    ["/hackathons/draft-demo/overview?preview=1", "/hackathons/draft-demo/prizes?preview=1"],
  ])("shows a localized prize summary with a detail link on %s", async (entry, target) => {
    const view = renderRoute(entry);
    await settle();
    try {
      const summary = view.container.querySelector(`a[href='${target}']`);
      expect(summary?.textContent).toContain("100.000.000");
      expect(summary?.textContent).toContain("VND");
      expect(summary?.textContent).toContain("public.prizes.breakdown");
      expect(summary?.closest("header")).toBeNull();
    } finally {
      await view.cleanup();
    }
  });

  it("puts the primary action ahead of prize details and keeps the full summary reachable", async () => {
    const view = renderRoute("/hackathons/published-demo/overview");
    await settle();
    try {
      const hero = view.container.querySelector("header");
      const action = Array.from(hero?.querySelectorAll("button") ?? []).find((button) => button.textContent === "public.register");
      const prize = view.container.querySelector("a[href='/hackathons/published-demo/prizes']");
      const overview = hero?.querySelector("a[href='/hackathons/published-demo/overview#overview-content']");
      expect(action).toBeDefined();
      expect(prize).not.toBeNull();
      expect(action?.compareDocumentPosition(prize!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(overview?.textContent).toContain("public.overview.readMore");
      expect(hero?.querySelector("p")?.className).toContain("line-clamp-2");
    } finally {
      await view.cleanup();
    }
  });

  it("omits unset deadlines instead of showing placeholder dates", async () => {
    const view = renderRoute("/hackathons/published-demo/overview");
    await settle();
    try {
      expect(view.container.textContent).not.toContain("public.registrationDeadline");
      expect(view.container.textContent).not.toContain("public.submissionDeadline");
      expect(view.container.querySelectorAll("time")).toHaveLength(0);
    } finally {
      await view.cleanup();
    }
  });

  it("shows the timezone in an arrowless tooltip below each configured deadline", async () => {
    state.publicContest = {
      ...publishedContest,
      submission_deadline: "2026-10-01T05:00:00.000Z",
    };
    const view = renderRoute("/hackathons/published-demo/overview");
    await settle();
    try {
      const deadlines = Array.from(view.container.querySelectorAll("time"));
      expect(deadlines).toHaveLength(2);
      expect(deadlines.every((deadline) => !deadline.textContent?.includes("ICT (UTC+7)"))).toBe(true);

      const trigger = view.container.querySelector<HTMLButtonElement>(
        'button[aria-label="public.submissionDeadline"]',
      );
      if (!trigger) throw new Error("Submission deadline tooltip trigger was not rendered");

      await act(async () => {
        trigger.dispatchEvent(new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "touch",
          button: 0,
        }));
        trigger.dispatchEvent(new PointerEvent("pointerup", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "touch",
          button: 0,
        }));
      });

      const tooltip = document.body.querySelector<HTMLElement>(
        '[data-slot="tooltip-content"]',
      );
      expect(tooltip?.textContent).toBe("public.timezoneLabel");
      expect(tooltip?.getAttribute("data-side")).toBe("bottom");
      expect(document.body.querySelector('[data-slot="tooltip-arrow"]')).toBeNull();
    } finally {
      await view.cleanup();
    }
  });

  it("shows configured dates and leaves the registration action disabled after closing", async () => {
    state.publicContest = {
      ...publishedContest,
      status: "ended",
      submission_deadline: "2026-10-01T05:00:00.000Z",
    };
    const view = renderRoute("/hackathons/published-demo/overview");
    await settle();
    try {
      const action = Array.from(view.container.querySelectorAll("header button")).find((button) => button.textContent === "public.registrationClosed");
      expect(action?.hasAttribute("disabled")).toBe(true);
      expect(view.container.querySelectorAll("time")).toHaveLength(1);
      expect(view.container.textContent).not.toContain("public.registrationDeadline");
      expect(view.container.textContent).toContain("public.submissionDeadline");
      const deadlines = Array.from(view.container.querySelectorAll("time"));
      expect(deadlines[0]?.textContent).toContain("12:00");
      expect(deadlines[0]?.textContent).not.toContain("ICT (UTC+7)");
      expect(deadlines[0]?.getAttribute("datetime")).toBe("2026-10-01T05:00:00.000Z");
    } finally {
      await view.cleanup();
    }
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

  it("renders contest correctly when URL has uppercase slug (/hackathons/PUBLISHED-DEMO/overview)", async () => {
    const view = renderRoute("/hackathons/PUBLISHED-DEMO/overview");
    await settle();

    expect(view.container.textContent).toContain("Published Demo");
    expect(view.container.textContent).not.toContain("detail.errors.notFound");

    await view.cleanup();
  });
});

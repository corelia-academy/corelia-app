// @vitest-environment happy-dom
import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import type { Contest } from "@/types/hackathons";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { createContest, getContest, getHackathonLocaleContent, invokeGenerateDescription, notifyHackathonWinnerAwards, projectDirectoryOptions, projectQueryFn, setHackathonLocaleContent, updateContest } = vi.hoisted(() => ({
  createContest: vi.fn(),
  getContest: vi.fn(),
  getHackathonLocaleContent: vi.fn(),
  invokeGenerateDescription: vi.fn(),
  notifyHackathonWinnerAwards: vi.fn(),
  projectDirectoryOptions: vi.fn(),
  projectQueryFn: vi.fn(
    async (): Promise<{
      items: Array<{ project: { id: string; title: string }; owner?: { username?: string; full_name?: string | null } | null }>;
      nextCursor: string | null;
    }> => ({ items: [], nextCursor: null }),
  ),
  setHackathonLocaleContent: vi.fn(),
  updateContest: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...await importOriginal<typeof import("react-i18next")>(),
  useTranslation: () => ({
    t: (key: string, options?: { number?: number }) => options?.number ? `${key}:${options.number}` : key,
    i18n: { language: "en", resolvedLanguage: "en" },
  }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

vi.mock("@/lib/hackathons", () => ({
  createContest,
  deleteContest: vi.fn(),
  getContest,
  getHackathonLocaleContent,
  notifyHackathonWinnerAwards,
  setHackathonLocaleContent,
  updateContest,
}));

vi.mock("@/lib/courses", () => ({ getPublishedCourses: vi.fn(async () => [
  { id: "course-1", slug: "skill-course", title: "Skill course" },
  { id: "course-2", slug: "demo-course", title: "Demo course" },
]) }));

vi.mock("@/lib/storage", () => ({
  deleteContestMediaByPath: vi.fn(),
  deleteStorageObjectByPath: vi.fn(),
  uploadContestBanner: vi.fn(),
  uploadContestHostLogo: vi.fn(),
}));

vi.mock("@/lib/descriptionGenerator", () => ({ invokeGenerateDescription }));

vi.mock("@/features/projects/projectQueries", () => ({
  publicProjectDirectoryQueryOptions: (...args: unknown[]) => {
    projectDirectoryOptions(...args);
    return {
      queryKey: ["projects", "hackathon-editor-test"],
      queryFn: projectQueryFn,
      initialPageParam: null,
      getNextPageParam: (lastPage: { nextCursor?: string | null }) => lastPage?.nextCursor ?? undefined,
    };
  },
}));

import AdminHackathonEditorPage from "./AdminHackathonEditorPage";

function LocationProbe() {
  const location = useLocation();
  return React.createElement("output", { "data-testid": "location" }, `${location.pathname}${location.hash}`);
}

function renderEditor(initialEntry: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  act(() => {
    root.render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(
          MemoryRouter,
          { initialEntries: [initialEntry] },
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: "/admin/hackathons/new",
              element: React.createElement(React.Fragment, null, React.createElement(AdminHackathonEditorPage), React.createElement(LocationProbe)),
            }),
            React.createElement(Route, {
              path: "/admin/hackathons/:id/edit",
              element: React.createElement(React.Fragment, null, React.createElement(AdminHackathonEditorPage), React.createElement(LocationProbe)),
            }),
          ),
        ),
      ),
    );
  });

  return {
    container,
    queryClient,
    async cleanup() {
      await act(async () => root.unmount());
      queryClient.clear();
      container.remove();
    },
  };
}

async function settle() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

function changeInput(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setValue?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function changeTextarea(input: HTMLTextAreaElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

const contest = {
  id: "hackathon-1",
  slug: "demo-hackathon",
  title: "Demo Hackathon",
  tagline: "",
  short_description: "",
  description: "",
  description_markdown: "",
  resources_markdown: "",
  status: "draft",
  location: "online",
  mode: "online",
  participants_count: 0,
  cover_image_url: null,
  cover_image_path: null,
  host: { name: "Corelia", logo_url: null, logo_path: null, website_url: null },
  social_links: { telegram: null, x: null, facebook: null },

  submission_deadline: null,
  prize_pool: { amount: "0", currency: "VND", description_markdown: "" },
  tracks: [],
  sectors: [],
  tech_stacks: [],
  timeline: [],
  winner_awards: [],
} as unknown as Contest;

describe("AdminHackathonEditorPage course-aligned navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectQueryFn.mockResolvedValue({ items: [], nextCursor: null });
    window.scrollTo = vi.fn();
    window.confirm = vi.fn(() => true);
    getContest.mockResolvedValue(contest);
    getHackathonLocaleContent.mockResolvedValue(null);
    createContest.mockResolvedValue(contest);
    updateContest.mockResolvedValue(contest);
    setHackathonLocaleContent.mockResolvedValue(undefined);
    invokeGenerateDescription.mockResolvedValue({
      description: "{}",
      sources: [],
      bundle: { title: "English Demo", shortDescription: "English summary" },
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("saves preparation courses from Resources", async () => {
    const view = renderEditor("/admin/hackathons/hackathon-1/edit#resources");
    await settle();
    try {
      const official = view.container.querySelector<HTMLSelectElement>("#hackathon-official-course")!;
      await act(async () => {
        official.value = "course-1";
        official.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await act(async () => {
        view.container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click();
      });
      expect(view.container.querySelector("#hackathon-social-posts")).toBeNull();
      const save = Array.from(view.container.querySelectorAll("button")).find((button) => button.textContent?.includes("hackathons.editor.saveSection"));
      await act(async () => save?.click());
      await settle();
      expect(updateContest).toHaveBeenCalledWith("hackathon-1", expect.objectContaining({
        official_course_id: "course-1",
        related_course_ids: ["course-2"],
      }));
    } finally {
      await view.cleanup();
    }
  });

  it("saves organizer post links from General information", async () => {
    const view = renderEditor("/admin/hackathons/hackathon-1/edit#overview");
    await settle();
    try {
      await act(async () => changeTextarea(view.container.querySelector<HTMLTextAreaElement>("#hackathon-social-posts")!, "https://x.com/corelia/status/123"));
      const save = Array.from(view.container.querySelectorAll("button")).find((button) => button.textContent?.includes("hackathons.editor.saveSection"));
      await act(async () => save?.click());
      await settle();
      expect(updateContest).toHaveBeenCalledWith("hackathon-1", expect.objectContaining({ social_post_urls: ["https://x.com/corelia/status/123"] }));
    } finally {
      await view.cleanup();
    }
  });

  it("opens the new flow immediately on Overview and locks later sections until a draft exists", async () => {
    const view = renderEditor("/admin/hackathons/new#timeline");
    await settle();

    expect(view.container.textContent).not.toContain("hackathons.loading");
    expect(view.container.querySelector("h2")?.textContent).toBe("hackathons.editor.sections.overview");
    expect(view.container.querySelector('[data-testid="location"]')?.textContent).toBe("/admin/hackathons/new#overview");

    const timelineButton = Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent === "hackathons.editor.sections.timeline");
    expect(timelineButton).toBeDefined();
    expect(timelineButton?.disabled).toBe(true);
    expect(view.container.textContent).toContain("hackathons.editor.createDraft");
    const aiButton = Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("hackathons.editor.aiTranslation"));
    expect(aiButton).toBeUndefined();
    expect(projectQueryFn).not.toHaveBeenCalled();

    await view.cleanup();
  });

  it("renders only the section selected by the edit URL and preserves hash navigation", async () => {
    const view = renderEditor("/admin/hackathons/hackathon-1/edit#timeline");
    await settle();

    expect(view.container.querySelector("h2")?.textContent).toBe("hackathons.editor.sections.timeline");
    expect(view.container.querySelector('[data-testid="location"]')?.textContent).toBe("/admin/hackathons/hackathon-1/edit#timeline");

    const overviewButton = Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent === "hackathons.editor.sections.overview");
    expect(overviewButton).toBeDefined();
    await act(async () => overviewButton?.click());
    await settle();

    expect(view.container.querySelector("h2")?.textContent).toBe("hackathons.editor.sections.overview");
    expect(view.container.querySelector('[data-testid="location"]')?.textContent).toBe("/admin/hackathons/hackathon-1/edit#overview");

    await view.cleanup();
  });

  it("displays local deadlines and preserves their exact instants when saving other content", async () => {
    const deadline = new Date(2026, 8, 29, 22, 0, 35).toISOString();
    getContest.mockResolvedValue({ ...contest, submission_deadline: deadline });
    const view = renderEditor("/admin/hackathons/hackathon-1/edit#overview");
    await settle();
    try {
      const dates = view.container.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]');
      expect(Array.from(dates, (input) => input.value)).toEqual(["2026-09-29T22:00"]);
      await act(async () => changeInput(view.container.querySelector("input")!, "Updated title"));
      const save = Array.from(view.container.querySelectorAll("button")).find((button) => button.textContent?.includes("hackathons.editor.saveSection"));
      await act(async () => save?.click());
      await settle();
      expect(updateContest).toHaveBeenCalledWith("hackathon-1", expect.objectContaining({
        title: "Updated title", submission_deadline: deadline,
      }));
    } finally {
      await view.cleanup();
    }
  });

  it("creates a draft and moves the new flow to the editable Overview route", async () => {
    const view = renderEditor("/admin/hackathons/new#overview");
    await settle();

    const inputs = view.container.querySelectorAll("input");
    await act(async () => {
      changeInput(inputs[0], "Demo Hackathon");
      changeInput(inputs[1], "demo-hackathon");
    });

    const createButton = Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("hackathons.editor.createDraft"));
    await act(async () => createButton?.click());
    await settle();

    expect(createContest).toHaveBeenCalledOnce();
    expect(createContest).toHaveBeenCalledWith(expect.objectContaining({
      sectors: [],
      tech_stacks: [],
    }));
    expect(setHackathonLocaleContent).toHaveBeenCalledTimes(2);
    expect(setHackathonLocaleContent).toHaveBeenCalledWith(
      "hackathon-1",
      "en",
      expect.objectContaining({
        sectors: [],
        tech_stacks: [],
      }),
    );
    expect(view.container.textContent).toContain("hackathons.editor.sections.taxonomy");
    expect(view.container.querySelector('[data-testid="location"]')?.textContent)
      .toBe("/admin/hackathons/hackathon-1/edit#overview");

    await view.cleanup();
  });

  it("keeps trailing slug separators while typing and canonicalizes them on save", async () => {
    const view = renderEditor("/admin/hackathons/new#overview");
    await settle();

    const inputs = view.container.querySelectorAll("input");
    await act(async () => {
      changeInput(inputs[0], "Manual slug demo");
      changeInput(inputs[1], "manual-");
    });
    expect(inputs[1].value).toBe("manual-");

    await act(async () => changeInput(inputs[1], "manual-slug-"));
    expect(inputs[1].value).toBe("manual-slug-");

    const createButton = Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("hackathons.editor.createDraft"));
    await act(async () => createButton?.click());
    await settle();

    expect(createContest).toHaveBeenCalledWith(expect.objectContaining({ slug: "manual-slug" }));

    await view.cleanup();
  });

  it("makes each social format explicit and saves Telegram usernames as public links", async () => {
    const view = renderEditor("/admin/hackathons/new#overview");
    await settle();

    const inputs = view.container.querySelectorAll("input");
    const telegram = view.container.querySelector<HTMLInputElement>("#hackathon-telegram");
    const x = view.container.querySelector<HTMLInputElement>("#hackathon-x");
    const facebook = view.container.querySelector<HTMLInputElement>("#hackathon-facebook");

    expect(telegram?.type).toBe("text");
    expect(telegram?.placeholder).toBe("hackathons.editor.fields.telegramPlaceholder");
    expect(x?.type).toBe("url");
    expect(x?.placeholder).toBe("hackathons.editor.fields.xPlaceholder");
    expect(facebook?.type).toBe("url");
    expect(facebook?.placeholder).toBe("hackathons.editor.fields.facebookPlaceholder");

    await act(async () => {
      changeInput(inputs[0], "Social format demo");
      changeInput(inputs[1], "social-format-demo");
      changeInput(telegram!, "@corelia_builders");
      changeInput(x!, "https://x.com/unihackfest");
      changeInput(facebook!, "https://www.facebook.com/unihackfest");
    });

    const createButton = Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("hackathons.editor.createDraft"));
    await act(async () => createButton?.click());
    await settle();

    expect(createContest).toHaveBeenCalledWith(expect.objectContaining({
      social_links: {
        telegram: "https://t.me/corelia_builders",
        x: "https://x.com/unihackfest",
        facebook: "https://www.facebook.com/unihackfest",
      },
    }));

    await view.cleanup();
  });

  it("translates the complete source locale into the selected locale draft without auto-saving", async () => {
    const view = renderEditor("/admin/hackathons/hackathon-1/edit#overview");
    await settle();

    const englishButton = Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("EN"));
    expect(englishButton).toBeDefined();
    await act(async () => englishButton?.click());

    const translateButton = Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("hackathons.editor.aiTranslation.action"));
    expect(translateButton).toBeDefined();
    await act(async () => translateButton?.click());
    await settle();

    expect(invokeGenerateDescription).toHaveBeenCalledWith(expect.objectContaining({
      action: "translate",
      type: "hackathon",
      hackathonId: "hackathon-1",
      sourceLocale: "vi",
      locale: "en",
      bundleKind: "hackathon",
    }));
    const titleInput = view.container.querySelector("input") as HTMLInputElement | null;
    expect(titleInput?.value).toBe("English Demo");
    expect(view.container.textContent).toContain("hackathons.editor.unsaved");

    await view.cleanup();
  });

  it("treats the hackathon's primary locale as the master copy", async () => {
    const japanese = { ...contest, title: "デモ ハッカソン", i18n: { primary_content_locale: "ja", supported_locales: ["ja", "ko", "vi"] } } as unknown as Contest;
    getContest.mockResolvedValue(japanese);
    getHackathonLocaleContent.mockImplementation(async (_id: string, loc: string) => (
      loc === "ja" ? { title: "デモ ハッカソン", short_description: "概要", description_markdown: "", resources_markdown: "", tracks: [], sectors: [], tech_stacks: [], timeline: [] } : null
    ));
    invokeGenerateDescription.mockResolvedValue({ description: "{}", sources: [], bundle: { title: "데모 해커톤" } });
    const view = renderEditor("/admin/hackathons/hackathon-1/edit#overview");
    await settle();
    try {
      // Opens on the primary locale with its badge.
      expect((view.container.querySelector("#hackathon-title") as HTMLInputElement).value).toBe("デモ ハッカソン");
      const primary = Array.from(view.container.querySelectorAll("button")).find((button) => button.getAttribute("aria-pressed") === "true");
      expect(primary?.textContent).toContain("hackathons.editor.primaryBadge");

      // Translating into another locale uses the primary locale as the source.
      const korean = Array.from(view.container.querySelectorAll("button")).find((button) => button.textContent?.includes("KO"));
      await act(async () => korean?.click());
      const translate = Array.from(view.container.querySelectorAll("button")).find((button) => button.textContent?.includes("hackathons.editor.aiTranslation.action"));
      await act(async () => translate?.click());
      await settle();
      expect(invokeGenerateDescription).toHaveBeenCalledWith(expect.objectContaining({ sourceLocale: "ja", locale: "ko" }));

      // Document-level fields are written from the primary locale, and its copy is always saved.
      const save = Array.from(view.container.querySelectorAll("button")).find((button) => button.textContent?.includes("hackathons.editor.saveSection"));
      await act(async () => save?.click());
      await settle();
      expect(updateContest).toHaveBeenCalledWith("hackathon-1", expect.objectContaining({ title: "デモ ハッカソン", short_description: "概要" }));
      const saved = setHackathonLocaleContent.mock.calls.map((call) => call[1]);
      expect(saved).toEqual(expect.arrayContaining(["ja", "vi", "en", "ko"]));
    } finally {
      await view.cleanup();
    }
  });

  it("saves updated submission_deadline when edited in Overview", async () => {
    const { updateContest } = await import("@/lib/hackathons");
    (updateContest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(contest);

    const view = renderEditor("/admin/hackathons/hackathon-1/edit#overview");
    await settle();

    const subInput = view.container.querySelector<HTMLInputElement>("#hackathon-submission-deadline");
    expect(subInput).toBeDefined();

    await act(async () => {
      changeInput(subInput!, "2026-10-20T20:00");
    });

    const saveButton = Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("hackathons.editor.saveSection"));
    expect(saveButton).toBeDefined();

    await act(async () => saveButton?.click());
    await settle();

    expect(updateContest).toHaveBeenCalledWith(
      "hackathon-1",
      expect.objectContaining({
        submission_deadline: expect.stringMatching(/^2026-10-20T/),
      }),
    );

    await view.cleanup();
  });

  it("saves independent edit toggles and keeps early-edit preference when announcing results", async () => {
    const { updateContest } = await import("@/lib/hackathons");
    const view = renderEditor("/admin/hackathons/hackathon-1/edit#overview");
    await settle();
    const early = view.container.querySelector<HTMLInputElement>("#hackathon-allow_project_edits_after_deadline")!;
    const announced = view.container.querySelector<HTMLInputElement>("#hackathon-winners_announced")!;
    expect(early.checked).toBe(false);
    expect(announced.checked).toBe(false);
    await act(async () => early.click());
    await act(async () => announced.click());
    expect(early.checked).toBe(true);
    expect(early.disabled).toBe(true);
    const save = Array.from(view.container.querySelectorAll("button")).find(button => button.textContent?.includes("hackathons.editor.saveSection"));
    await act(async () => save?.click());
    await settle();
    expect(updateContest).toHaveBeenCalledWith("hackathon-1", expect.objectContaining({ winners_announced: true, allow_project_edits_after_deadline: true }));
    await view.cleanup();
  });

  it("finds a translated project on a later page and awards it", async () => {
    const { toast } = await import("sonner");
    (toast.success as unknown as ReturnType<typeof vi.fn>).mockClear();

    projectQueryFn.mockReset();
    projectQueryFn
      .mockResolvedValueOnce({
        items: [{ project: { id: "p1", title: "Project 1" }, owner: { username: "user1" } }],
        nextCursor: "cursor-page-2",
      })
      .mockResolvedValueOnce({
        items: [{ project: { id: "p2", title: "Check-Di" }, owner: { username: "user2" } }],
        nextCursor: null,
      });

    const view = renderEditor("/admin/hackathons/hackathon-1/edit#projects");
    await settle();

    // Verify both pages were queried automatically
    expect(projectQueryFn).toHaveBeenCalledTimes(2);
    expect(projectDirectoryOptions).toHaveBeenCalledWith("en", "hackathon", "newest", expect.objectContaining({ hackathonId: "hackathon-1" }));

    // Open the project picker combobox
    const comboboxTrigger = Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("hackathons.editor.selectProject"));
    expect(comboboxTrigger).toBeDefined();

    await act(async () => comboboxTrigger?.click());
    await settle();

    const projectSearch = document.body.querySelector<HTMLInputElement>('input[placeholder="hackathons.editor.searchProjectPlaceholder"]')!;
    await act(async () => changeInput(projectSearch, "Check-Di"));

    // Find the translated project from page 2 using its English title.
    const dialogButtons = Array.from(document.body.querySelectorAll("button"));
    const page2Option = dialogButtons.find((button) => button.textContent?.includes("Check-Di"));
    expect(page2Option).toBeDefined();

    // Select the project from page 2.
    await act(async () => page2Option?.click());
    await settle();

    // Enter award label and click Add
    const awardLabelInput = view.container.querySelector<HTMLInputElement>("#hackathon-winner-award-label");
    expect(awardLabelInput).toBeDefined();

    await act(async () => {
      changeInput(awardLabelInput!, "Second Place");
    });

    const addButton = Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("hackathons.editor.add"));
    expect(addButton).toBeDefined();

    await act(async () => addButton?.click());
    await settle();

    expect(toast.success).toHaveBeenCalledWith("hackathons.editor.awardAdded");

    // Verify the newly added award uses the translated project title.
    expect(view.container.textContent).toContain("Check-Di");
    const addedAwardInput = Array.from(view.container.querySelectorAll("input"))
      .find((input) => input.value === "Second Place");
    expect(addedAwardInput).toBeDefined();

    await view.cleanup();
  });

  it("groups legacy awards, adds to the same project, reorders both levels, and saves their order", async () => {
    getContest.mockResolvedValue({
      ...contest,
      winner_awards: [
        { id: "a1", project_id: "p1", label: "First", sort_order: 0 },
        { id: "b1", project_id: "p2", label: "Second", sort_order: 1 },
        { id: "a2", project_id: "p1", label: "Third", sort_order: 2 },
      ],
    });
    projectQueryFn.mockResolvedValue({
      items: [
        { project: { id: "p1", title: "Project 1" } },
        { project: { id: "p2", title: "Project 2" } },
      ],
      nextCursor: null,
    });

    const view = renderEditor("/admin/hackathons/hackathon-1/edit#projects");
    await settle();
    const groups = () => Array.from(view.container.querySelectorAll("[data-award-project]"));
    expect(groups().map((group) => group.querySelector("h3")?.textContent)).toEqual(["Project 1", "Project 2"]);
    expect(Array.from(groups()[0].querySelectorAll("input"), (input) => input.value)).toEqual(["First", "Third"]);
    expect(view.container.textContent?.match(/hackathons.editor.selectProject/g)).toHaveLength(2);

    const picker = Array.from(view.container.querySelectorAll("button")).find((button) => button.textContent?.includes("hackathons.editor.selectProject"));
    await act(async () => picker?.click());
    await settle();
    const projectOption = Array.from(document.body.querySelectorAll("button")).find((button) => button.textContent?.includes("Project 1"));
    await act(async () => projectOption?.click());
    await act(async () => changeInput(view.container.querySelector<HTMLInputElement>("#hackathon-winner-award-label")!, "Fourth"));
    const add = Array.from(view.container.querySelectorAll("button")).find((button) => button.textContent === "hackathons.editor.add");
    await act(async () => add?.click());
    expect(groups()).toHaveLength(2);
    expect(Array.from(groups()[0].querySelectorAll("input"), (input) => input.value)).toEqual(["First", "Third", "Fourth"]);

    await act(async () => groups()[0].querySelector<HTMLButtonElement>('[aria-label="hackathons.editor.moveAwardDown"]')?.click());
    expect(Array.from(groups()[0].querySelectorAll("input"), (input) => input.value)).toEqual(["Third", "First", "Fourth"]);
    await act(async () => groups()[0].querySelector<HTMLButtonElement>('[aria-label="hackathons.editor.moveProjectDown"]')?.click());
    expect(groups().map((group) => group.querySelector("h3")?.textContent)).toEqual(["Project 2", "Project 1"]);

    const save = Array.from(view.container.querySelectorAll("button")).find((button) => button.textContent?.includes("hackathons.editor.saveSection"));
    await act(async () => save?.click());
    await settle();
    expect(updateContest).toHaveBeenCalledWith("hackathon-1", expect.objectContaining({
      winner_awards: [
        expect.objectContaining({ id: "b1", sort_order: 0 }),
        expect.objectContaining({ id: "a2", sort_order: 1 }),
        expect.objectContaining({ id: "a1", sort_order: 2 }),
        expect.objectContaining({ label: "Fourth", project_id: "p1", sort_order: 3 }),
      ],
    }));
    await view.cleanup();

    const savedAwards = updateContest.mock.lastCall?.[1].winner_awards;
    getContest.mockResolvedValue({ ...contest, winner_awards: savedAwards });
    const reloaded = renderEditor("/admin/hackathons/hackathon-1/edit#projects");
    await settle();
    const reloadedGroups = Array.from(reloaded.container.querySelectorAll("[data-award-project]"));
    expect(reloadedGroups.map((group) => group.getAttribute("data-award-project"))).toEqual(["p2", "p1"]);
    expect(Array.from(reloadedGroups[1].querySelectorAll("input"), (input) => input.value)).toEqual(["Third", "First", "Fourth"]);
    await act(async () => changeInput(reloadedGroups[1].querySelector("input")!, "Renamed"));
    await act(async () => reloadedGroups[1].querySelectorAll<HTMLButtonElement>('[aria-label="hackathons.editor.remove"]')[2].click());
    expect(Array.from(reloadedGroups[1].querySelectorAll("input"), (input) => input.value)).toEqual(["Renamed", "First"]);
    expect(reloaded.container.querySelectorAll("[data-award-project]")).toHaveLength(2);
    await reloaded.cleanup();
  });

  it("moves awards and projects by drag and blocks blank award labels", async () => {
    getContest.mockResolvedValue({
      ...contest,
      winner_awards: [
        { id: "a1", project_id: "p1", label: "First", sort_order: 0 },
        { id: "a2", project_id: "p1", label: "Second", sort_order: 1 },
        { id: "b1", project_id: "p2", label: "Third", sort_order: 2 },
      ],
    });
    const view = renderEditor("/admin/hackathons/hackathon-1/edit#projects");
    await settle();
    const groups = () => Array.from(view.container.querySelectorAll("[data-award-project]"));
    const drag = async (source: Element, target: Element) => {
      const start = new Event("dragstart", { bubbles: true, cancelable: true });
      Object.defineProperty(start, "dataTransfer", { value: { setData: vi.fn(), effectAllowed: "move" } });
      await act(async () => source.dispatchEvent(start));
      await act(async () => target.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true })));
      await act(async () => target.dispatchEvent(new Event("drop", { bubbles: true, cancelable: true })));
    };

    await drag(groups()[0].querySelector('[aria-label="hackathons.editor.dragAward"]')!, groups()[0].querySelectorAll("input")[1].parentElement!);
    expect(Array.from(groups()[0].querySelectorAll("input"), (input) => input.value)).toEqual(["Second", "First"]);
    await drag(groups()[0].querySelector('[aria-label="hackathons.editor.dragProject"]')!, groups()[1]);
    expect(groups().map((group) => group.querySelector("h3")?.textContent)).toEqual(["p2", "p1"]);

    await act(async () => changeInput(groups()[1].querySelector("input")!, "  "));
    const save = Array.from(view.container.querySelectorAll("button")).find((button) => button.textContent?.includes("hackathons.editor.saveSection"));
    await act(async () => save?.click());
    await settle();
    expect(updateContest).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("hackathons.editor.awardLabelRequired");
    await view.cleanup();
  });

  it("finishes saving many awards without sending email or waiting for background refresh", async () => {
    const awards = Array.from({ length: 22 }, (_, index) => ({
      id: `award-${index}`,
      project_id: `project-${index}`,
      label: "Honorable Mention",
      sort_order: index,
    }));
    getContest.mockResolvedValue({ ...contest, winner_awards: awards });
    updateContest.mockResolvedValue({ ...contest, winner_awards: awards });
    const view = renderEditor("/admin/hackathons/hackathon-1/edit#projects");
    await settle();
    vi.spyOn(view.queryClient, "invalidateQueries").mockImplementation(() => new Promise(() => {}));

    const save = Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("hackathons.editor.saveSection"))!;
    await act(async () => save.click());
    await settle();

    expect(updateContest).toHaveBeenCalledWith("hackathon-1", expect.objectContaining({ winner_awards: awards }));
    expect(setHackathonLocaleContent).toHaveBeenCalledTimes(2);
    expect(notifyHackathonWinnerAwards).not.toHaveBeenCalled();
    expect(save.disabled).toBe(false);
    expect(save.textContent).toContain("hackathons.editor.saveSection");
    expect(toast.success).toHaveBeenCalledWith("hackathons.editor.saved");
    await view.cleanup();
  });

  it("notifies from saved awards only after unsaved changes are saved", async () => {
    let storedContest = {
      ...contest,
      winner_awards: [{ id: "award-1", project_id: "project-1", label: "First Place", sort_order: 0 }],
    };
    getContest.mockImplementation(async () => storedContest);
    updateContest.mockImplementation(async (_id, updates) => {
      storedContest = { ...storedContest, winner_awards: updates.winner_awards };
      return storedContest;
    });
    notifyHackathonWinnerAwards.mockResolvedValueOnce({ ok: true, emails_sent_count: 1, failures_count: 0, failures: [] });
    const view = renderEditor("/admin/hackathons/hackathon-1/edit#projects");
    await settle();

    const awardLabel = view.container.querySelector<HTMLInputElement>("[data-award-project] input")!;
    await act(async () => changeInput(awardLabel, "Updated Place"));
    const notify = Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("hackathons.editor.notifyAwardsAction"))!;
    expect(notify.disabled).toBe(true);
    expect(view.container.textContent).toContain("hackathons.editor.saveBeforeNotifyAwards");
    const save = Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("hackathons.editor.saveSection"))!;
    await act(async () => save.click());
    await settle();
    expect(notify.disabled).toBe(false);
    expect(notifyHackathonWinnerAwards).not.toHaveBeenCalled();

    await act(async () => notify.click());
    await settle();
    expect(window.confirm).toHaveBeenCalledWith("hackathons.editor.notifyAwardsConfirm");
    expect(notifyHackathonWinnerAwards).toHaveBeenCalledWith("hackathon-1", [
      { project_id: "project-1", label: "Updated Place" },
    ]);
    await view.cleanup();
  });

  it("keeps notification disabled and shows the save error when award persistence fails", async () => {
    getContest.mockResolvedValue({
      ...contest,
      winner_awards: [{ id: "award-1", project_id: "project-1", label: "First Place", sort_order: 0 }],
    });
    updateContest.mockRejectedValue(new Error("save failed"));
    const view = renderEditor("/admin/hackathons/hackathon-1/edit#projects");
    await settle();
    await act(async () => changeInput(view.container.querySelector<HTMLInputElement>("[data-award-project] input")!, "Updated Place"));
    const save = Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("hackathons.editor.saveSection"))!;
    await act(async () => save.click());
    await settle();

    const notify = Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("hackathons.editor.notifyAwardsAction"))!;
    expect(save.disabled).toBe(false);
    expect(notify.disabled).toBe(true);
    expect(notifyHackathonWinnerAwards).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("save failed");
    await view.cleanup();
  });

  it("shows awardsNotifyNotConfigured warning and no success toast when email is unconfigured (V-01c)", async () => {
    getContest.mockResolvedValueOnce({
      ...contest,
      winner_awards: [{ id: "aw-1", project_id: "p1", label: "First Place", sort_order: 0 }],
    });
    notifyHackathonWinnerAwards.mockResolvedValueOnce({
      ok: true,
      emails_sent_count: 0,
      failures_count: 1,
      failures: [{ project_id: "p1", user_id: "u1", recipient_email: "u1@example.com", reason: "email_not_configured", is_retryable: true }],
    });

    vi.spyOn(window, "confirm").mockReturnValue(true);

    const view = renderEditor("/admin/hackathons/hackathon-1/edit#projects");
    await settle();

    const notifyButton = Array.from(view.container.querySelectorAll("button"))
      .find((b) => b.textContent?.includes("hackathons.editor.notifyAwardsAction"));
    expect(notifyButton).toBeDefined();

    await act(async () => notifyButton?.click());
    await settle();

    expect(notifyHackathonWinnerAwards).toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith("hackathons.editor.awardsNotifyNotConfigured");
    expect(toast.success).not.toHaveBeenCalledWith(expect.stringContaining("hackathons.editor.awardsNotified"));

    await view.cleanup();
  });

  it("shows distinct error toasts for indeterminate and permanent failures (V-01c)", async () => {
    getContest.mockResolvedValueOnce({
      ...contest,
      winner_awards: [{ id: "aw-1", project_id: "p1", label: "First Place", sort_order: 0 }],
    });
    notifyHackathonWinnerAwards.mockResolvedValueOnce({
      ok: true,
      emails_sent_count: 0,
      failures_count: 2,
      failures: [
        { project_id: "p1", user_id: "u1", recipient_email: "u1@example.com", reason: "indeterminate_delivery_requires_reconciliation", is_retryable: false },
        { project_id: "p2", user_id: "u2", recipient_email: "u2@example.com", reason: "email_delivery_rejected", is_retryable: false },
      ],
    });

    vi.spyOn(window, "confirm").mockReturnValue(true);

    const view = renderEditor("/admin/hackathons/hackathon-1/edit#projects");
    await settle();

    const notifyButton = Array.from(view.container.querySelectorAll("button"))
      .find((b) => b.textContent?.includes("hackathons.editor.notifyAwardsAction"));
    expect(notifyButton).toBeDefined();

    await act(async () => notifyButton?.click());
    await settle();

    expect(toast.error).toHaveBeenCalledWith("hackathons.editor.awardsNotifyIndeterminateError");
    expect(toast.error).toHaveBeenCalledWith("hackathons.editor.awardsNotifyPermanentError");
    expect(toast.success).not.toHaveBeenCalledWith(expect.stringContaining("hackathons.editor.awardsNotified"));

    await view.cleanup();
  });

  it("blocks publishing when taxonomy is empty and redirects to taxonomy section", async () => {
    const view = renderEditor("/admin/hackathons/hackathon-1/edit#danger");
    await settle();

    // Click publish CTA to change draft status to published
    const publishButton = Array.from(view.container.querySelectorAll("button"))
      .find((b) => b.textContent?.includes("hackathons.editor.statusDraftCta"));
    expect(publishButton).toBeDefined();
    await act(async () => publishButton?.click());
    await settle();

    const unpublishButton = Array.from(view.container.querySelectorAll("button"))
      .find((b) => b.textContent?.includes("hackathons.editor.statusPublishedCta"));
    expect(unpublishButton?.className).toContain("bg-hackathon-unpublish-surface");
    expect(unpublishButton?.className).toContain("hover:bg-hackathon-unpublish-hover-surface");

    // Click save in header
    const saveButton = Array.from(view.container.querySelectorAll("button"))
      .find((b) => b.textContent?.includes("hackathons.editor.saveSection"));
    expect(saveButton).toBeDefined();
    await act(async () => saveButton?.click());
    await settle();

    expect(toast.error).toHaveBeenCalledWith("hackathons.editor.validationTaxonomyRequired");
    expect(updateContest).not.toHaveBeenCalled();
    expect(view.container.querySelector('[data-testid="location"]')?.textContent)
      .toBe("/admin/hackathons/hackathon-1/edit#taxonomy");

    await view.cleanup();
  });
});

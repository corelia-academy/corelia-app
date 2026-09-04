// @vitest-environment happy-dom
import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Contest } from "@/types/hackathons";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { createContest, getContest, getHackathonLocaleContent, invokeGenerateDescription, projectQueryFn, setHackathonLocaleContent } = vi.hoisted(() => ({
  createContest: vi.fn(),
  getContest: vi.fn(),
  getHackathonLocaleContent: vi.fn(),
  invokeGenerateDescription: vi.fn(),
  projectQueryFn: vi.fn(
    async (): Promise<{
      items: Array<{ project: { id: string; title: string }; owner?: { username?: string; full_name?: string | null } | null }>;
      nextCursor: string | null;
    }> => ({ items: [], nextCursor: null }),
  ),
  setHackathonLocaleContent: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { number?: number }) => options?.number ? `${key}:${options.number}` : key,
  }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/lib/hackathons", () => ({
  createContest,
  deleteContest: vi.fn(),
  getContest,
  getHackathonLocaleContent,
  setHackathonLocaleContent,
  updateContest: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  deleteStorageObjectByPath: vi.fn(),
  uploadContestBanner: vi.fn(),
  uploadContestHostLogo: vi.fn(),
}));

vi.mock("@/lib/descriptionGenerator", () => ({ invokeGenerateDescription }));

vi.mock("@/features/projects/projectQueries", () => ({
  publicProjectDirectoryQueryOptions: () => ({
    queryKey: ["projects", "hackathon-editor-test"],
    queryFn: projectQueryFn,
    initialPageParam: null,
    getNextPageParam: (lastPage: { nextCursor?: string | null }) => lastPage?.nextCursor ?? undefined,
  }),
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
  registration_deadline: null,
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
    window.scrollTo = vi.fn();
    window.confirm = vi.fn(() => true);
    getContest.mockResolvedValue(contest);
    getHackathonLocaleContent.mockResolvedValue(null);
    createContest.mockResolvedValue(contest);
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
      sectors: expect.arrayContaining([
        expect.objectContaining({ id: "sector-ai-engineering", name: "Kỹ thuật AI & Machine Learning" }),
        expect.objectContaining({ id: "sector-blockchain-web3", name: "Blockchain & Web3" }),
        expect.objectContaining({ id: "sector-developer-tools", name: "Công cụ lập trình & Mã nguồn mở" }),
      ]),
      tech_stacks: expect.arrayContaining([
        expect.objectContaining({ id: "tech-javascript-typescript", name: "JavaScript / TypeScript" }),
        expect.objectContaining({ id: "tech-solidity-evm", name: "Solidity / EVM" }),
        expect.objectContaining({ id: "tech-solana", name: "Solana" }),
      ]),
    }));
    expect(setHackathonLocaleContent).toHaveBeenCalledTimes(2);
    expect(setHackathonLocaleContent).toHaveBeenCalledWith(
      "hackathon-1",
      "en",
      expect.objectContaining({
        sectors: expect.arrayContaining([
          expect.objectContaining({ id: "sector-ai-engineering", name: "AI & Machine Learning Engineering" }),
          expect.objectContaining({ id: "sector-developer-tools", name: "Developer Tools & Open Source" }),
        ]),
        tech_stacks: expect.arrayContaining([
          expect.objectContaining({ id: "tech-pytorch-tensorflow", name: "PyTorch / TensorFlow" }),
          expect.objectContaining({ id: "tech-solana", name: "Solana" }),
        ]),
      }),
    );
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

  it("saves updated registration_deadline and submission_deadline when edited in Overview", async () => {
    const { updateContest } = await import("@/lib/hackathons");
    (updateContest as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(contest);

    const view = renderEditor("/admin/hackathons/hackathon-1/edit#overview");
    await settle();

    const regInput = view.container.querySelector<HTMLInputElement>("#hackathon-registration-deadline");
    const subInput = view.container.querySelector<HTMLInputElement>("#hackathon-submission-deadline");
    expect(regInput).toBeDefined();
    expect(subInput).toBeDefined();

    await act(async () => {
      changeInput(regInput!, "2026-10-01T20:00");
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
        registration_deadline: expect.stringMatching(/^2026-10-01T/),
        submission_deadline: expect.stringMatching(/^2026-10-20T/),
      }),
    );

    await view.cleanup();
  });

  it("rejects saving when registration_deadline is strictly after submission_deadline", async () => {
    const { updateContest } = await import("@/lib/hackathons");
    const { toast } = await import("sonner");
    (updateContest as unknown as ReturnType<typeof vi.fn>).mockClear();
    (toast.error as unknown as ReturnType<typeof vi.fn>).mockClear();

    const view = renderEditor("/admin/hackathons/hackathon-1/edit#overview");
    await settle();

    const regInput = view.container.querySelector<HTMLInputElement>("#hackathon-registration-deadline");
    const subInput = view.container.querySelector<HTMLInputElement>("#hackathon-submission-deadline");

    await act(async () => {
      changeInput(regInput!, "2026-10-25T20:00");
      changeInput(subInput!, "2026-10-10T20:00");
    });

    const saveButton = Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("hackathons.editor.saveSection"));
    await act(async () => saveButton?.click());
    await settle();

    expect(updateContest).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("hackathons.editor.validationDeadlines");

    await view.cleanup();
  });

  it("fetches next pages of candidate submissions when viewing projects section", async () => {
    const { toast } = await import("sonner");
    (toast.success as unknown as ReturnType<typeof vi.fn>).mockClear();

    projectQueryFn.mockReset();
    projectQueryFn
      .mockResolvedValueOnce({
        items: [{ project: { id: "p1", title: "Project 1" }, owner: { username: "user1" } }],
        nextCursor: "cursor-page-2",
      })
      .mockResolvedValueOnce({
        items: [{ project: { id: "p2", title: "Project 2" }, owner: { username: "user2" } }],
        nextCursor: null,
      });

    const view = renderEditor("/admin/hackathons/hackathon-1/edit#projects");
    await settle();

    // Verify both pages were queried automatically
    expect(projectQueryFn).toHaveBeenCalledTimes(2);

    // Open the project picker combobox
    const comboboxTrigger = Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("hackathons.editor.selectProject"));
    expect(comboboxTrigger).toBeDefined();

    await act(async () => comboboxTrigger?.click());
    await settle();

    // Find and verify page 2 project option in the dialog DOM
    const dialogButtons = Array.from(document.body.querySelectorAll("button"));
    const page2Option = dialogButtons.find((button) => button.textContent?.includes("Project 2"));
    expect(page2Option).toBeDefined();

    // Select Project 2 from page 2
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

    // Verify DOM now renders the newly added award with Project 2
    expect(view.container.textContent).toContain("Project 2");
    const addedAwardInput = Array.from(view.container.querySelectorAll("input"))
      .find((input) => input.value === "Second Place");
    expect(addedAwardInput).toBeDefined();

    await view.cleanup();
  });
});


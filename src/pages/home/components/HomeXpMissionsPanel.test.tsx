// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HomeXpMissionsPanel } from "./HomeXpMissionsPanel";
import type { HomeXpMissionProgress } from "../hooks/useHomeXpMissions";
import type { FocusCard } from "../utils/homeTypes";

const mocks = vi.hoisted(() => ({
  missions: { data: undefined, isPending: true, isError: false } as {
    data: HomeXpMissionProgress | undefined;
    isPending: boolean;
    isError: boolean;
  },
  focusCards: [] as FocusCard[],
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return { ...actual, useTranslation: () => ({ t: (key: string) => key }) };
});
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("../hooks/useHomeXpMissions", () => ({ useHomeXpMissions: () => mocks.missions }));
vi.mock("../hooks/useHomeUserDashboard", () => ({
  useHomeUserDashboard: () => ({ focusCards: mocks.focusCards }),
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const none: HomeXpMissionProgress = {
  lessonCompleted: false,
  quizPassed: false,
  courseCompleted: false,
  firstHackathonSubmission: false,
  ocidConnected: false,
  githubConnected: false,
  ethereumWallet: false,
  solanaWallet: false,
  projectLikesToday: 0,
};
const all: HomeXpMissionProgress = {
  lessonCompleted: true,
  quizPassed: true,
  courseCompleted: true,
  firstHackathonSubmission: true,
  ocidConnected: true,
  githubConnected: true,
  ethereumWallet: true,
  solanaWallet: true,
  projectLikesToday: 5,
};

function card(id: string, overrides: Partial<FocusCard> = {}): FocusCard {
  return {
    id,
    title: id,
    format: "online",
    progress: 50,
    completed: false,
    nextStep: "",
    meta: "",
    action: `/study/${id}`,
    ...overrides,
  };
}

function setMissions(data: HomeXpMissionProgress | undefined) {
  mocks.missions = { data, isPending: data === undefined, isError: false };
}

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {JSON.stringify({ path: location.pathname, state: location.state })}
    </output>
  );
}

let cleanup: (() => void) | undefined;

async function renderPanel() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanup = () => {
    act(() => root.unmount());
    container.remove();
  };
  await act(async () => {
    root.render(
      <MemoryRouter>
        <HomeXpMissionsPanel userId="user-1" />
        <LocationProbe />
      </MemoryRouter>,
    );
  });
  return container;
}

function linkFor(container: HTMLElement, id: string) {
  const title = [...container.querySelectorAll("span")].find(
    (el) => el.textContent === `home.xpMissions.tasks.${id}.title`,
  );
  return title?.closest("a") ?? null;
}

async function clickAndReadLocation(container: HTMLElement, id: string) {
  const link = linkFor(container, id);
  await act(async () => link?.click());
  return JSON.parse(container.querySelector('[data-testid="location"]')!.textContent!) as {
    path: string;
    state: { scrollTo?: string } | null;
  };
}

beforeEach(() => {
  setMissions(none);
  mocks.focusCards = [];
});

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe("HomeXpMissionsPanel navigation", () => {
  it("sends lesson to the most recent course that is still in progress", async () => {
    mocks.focusCards = [
      card("done", { completed: true, progress: 100 }),
      card("all-lessons-done", { progress: 100 }),
      card("active"),
    ];
    const container = await renderPanel();

    expect(linkFor(container, "lesson")?.getAttribute("href")).toBe("/study/active");
  });

  it.each([
    ["the lesson mission is already complete", { ...none, lessonCompleted: true }, [card("active")]],
    ["the mission status is still loading", undefined, [card("active")]],
    ["no course is in progress", none, [card("done", { completed: true })]],
  ] as Array<[string, HomeXpMissionProgress | undefined, FocusCard[]]>)(
    "sends lesson to /courses when %s",
    async (_label, data, cards) => {
      setMissions(data);
      mocks.focusCards = cards;
      const container = await renderPanel();

      expect(linkFor(container, "lesson")?.getAttribute("href")).toBe("/courses");
    },
  );

  it("always sends quiz to /courses, even with a course in progress", async () => {
    mocks.focusCards = [card("active")];
    const container = await renderPanel();

    expect(linkFor(container, "quiz")?.getAttribute("href")).toBe("/courses");
  });

  it.each([
    ["course", "/courses"],
    ["projectLike", "/projects"],
    ["firstHackathonSubmission", "/hackathons"],
  ] as const)("sends %s to %s", async (id, href) => {
    const container = await renderPanel();

    expect(linkFor(container, id)?.getAttribute("href")).toBe(href);
  });

  it.each([
    ["ocidConnected", "connect-ocid"],
    ["githubConnected", "connected-github"],
    ["ethereumWallet", "connected-ethereum"],
    ["solanaWallet", "connected-solana"],
  ] as const)("opens the account profile and asks to scroll for %s", async (id, scrollTo) => {
    const container = await renderPanel();

    expect(linkFor(container, id)?.getAttribute("href")).toBe("/account/profile");
    expect(await clickAndReadLocation(container, id)).toEqual({
      path: "/account/profile",
      state: { scrollTo },
    });
  });

  it("keeps every mission clickable after all of them are complete", async () => {
    setMissions(all);
    const container = await renderPanel();

    expect(container.querySelectorAll("a")).toHaveLength(9);
    expect(container.querySelector("[disabled], [aria-disabled='true']")).toBeNull();
  });

  it("still scrolls to the connection block when its mission is complete", async () => {
    setMissions(all);
    const container = await renderPanel();

    expect(await clickAndReadLocation(container, "githubConnected")).toEqual({
      path: "/account/profile",
      state: { scrollTo: "connected-github" },
    });
  });
});

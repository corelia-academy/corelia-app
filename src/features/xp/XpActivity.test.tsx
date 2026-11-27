// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { XpActivity } from "./XpActivity";
import { getMyXpDayBreakdown, getMyXpHistory, getXpSummary } from "@/lib/xp";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options?.count !== undefined ? `${key}:${options.count}` : key),
    i18n: { language: "en" },
  }),
}));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/xp", async () => {
  const actual = await vi.importActual<typeof import("@/lib/xp")>("@/lib/xp");
  return { ...actual, getXpSummary: vi.fn(), getMyXpHistory: vi.fn(), getMyXpDayBreakdown: vi.fn() };
});

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); vi.clearAllMocks(); });

const entries = Array.from({ length: 6 }, (_, index) => ({
  id: `entry-${index}`,
  source: "lesson_completed",
  points: index + 1,
  occurred_at: "2026-11-01T10:00:00Z",
  created_at: "2026-11-01T10:00:00Z",
}));

async function renderActivity(own: boolean) {
  vi.mocked(getXpSummary).mockResolvedValue({ total: 21, trackingSince: "2026-01-01", days: [{ date: new Date().toISOString().slice(0, 10), xp: 5 }] } as never);
  vi.mocked(getMyXpHistory).mockResolvedValue(entries as never);
  vi.mocked(getMyXpDayBreakdown).mockResolvedValue([{ source: "lesson_completed", xp: 5 }] as never);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  cleanup = () => { act(() => root.unmount()); queryClient.clear(); container.remove(); };
  await act(async () => {
    root.render(<QueryClientProvider client={queryClient}><XpActivity userId="user-1" own={own} /></QueryClientProvider>);
  });
  await until(() => container.querySelector("section") !== null);
  return container;
}

/** Chờ điều kiện đúng (tối đa 2 giây) thay vì ngủ cố định, để không chập chờn khi máy chậm. */
async function until(condition: () => boolean) {
  for (let attempt = 0; attempt < 40 && !condition(); attempt += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
  }
}

const button = (container: HTMLElement, text: string) => [...container.querySelectorAll("button")].find((item) => item.textContent === text)!;
const sections = (container: HTMLElement) => [...container.querySelectorAll("section")].map((section) => section.getAttribute("aria-label"));

describe("XpActivity", () => {
  it("shows only the heatmap for a visitor and never loads private history", async () => {
    const container = await renderActivity(false);
    expect(sections(container)).toEqual(["xp.title"]);
    expect(container.querySelectorAll('[role="group"] button').length).toBeGreaterThan(300);
    expect(getMyXpHistory).not.toHaveBeenCalled();
  });

  it("lets the owner pick a day and see its breakdown", async () => {
    const container = await renderActivity(true);
    expect(sections(container)).toEqual(["xp.title", "xp.history"]);
    const todayCell = [...container.querySelectorAll<HTMLButtonElement>('[role="group"] button')].find((cell) => cell.getAttribute("aria-label")?.includes("5 XP"))!;
    await act(async () => todayCell.click());
    await until(() => container.textContent?.includes("xp.sources.lesson_completed: +5 XP") ?? false);
    expect(container.querySelector('[role="status"]')?.textContent).toContain("5 XP");
    expect(getMyXpDayBreakdown).toHaveBeenCalled();
    expect(container.textContent).toContain("xp.sources.lesson_completed: +5 XP");
  });

  // TODO(figma-xp): thiết kế mới chưa dùng biểu đồ tuần
  it.skip("moves between weeks and stops at the current week", async () => {
    const container = await renderActivity(true);
    const previous = container.querySelector<HTMLButtonElement>('button[aria-label="xp.previousWeek"]')!;
    const next = container.querySelector<HTMLButtonElement>('button[aria-label="xp.nextWeek"]')!;
    expect(next.disabled).toBe(true);
    await act(async () => previous.click());
    expect(next.disabled).toBe(false);
    await act(async () => next.click());
    expect(next.disabled).toBe(true);
  });

  it("shows four history rows, then all of them with a collapse control", async () => {
    const container = await renderActivity(true);
    const history = container.querySelector('section[aria-label="xp.history"]')!;
    expect(history.querySelectorAll("li")).toHaveLength(4);
    await act(async () => button(container, "userProfile.xpHistory.viewAll").click());
    expect(history.querySelectorAll("li")).toHaveLength(6);
    await act(async () => button(container, "userProfile.xpHistory.collapse").click());
    expect(history.querySelectorAll("li")).toHaveLength(4);
  });
});

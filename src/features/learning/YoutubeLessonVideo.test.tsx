// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { YoutubeLessonVideo } from "./YoutubeLessonVideo";
import { LessonColumn, LESSON_MEDIA_MAX_HEIGHT } from "./lessonLayout";
import { loadYoutubePlayerApi, type YoutubePlayerApi } from "@/lib/youtubePlayerApi";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("./useLearningTranslation", () => ({ useLearningTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/youtubePlayerApi", () => ({ loadYoutubePlayerApi: vi.fn() }));
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); vi.clearAllMocks(); vi.useRealTimers(); });

it("keeps segment/no-autoplay, handles player errors, and recreates the player when the URL changes", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  const destroy = vi.fn();
  const events: Array<{ onReady(): void; onError(): void }> = [];
  const Player = vi.fn(function (_frame: HTMLIFrameElement, options: { events: typeof events[number] }) { events.push(options.events); return { destroy }; });
  vi.mocked(loadYoutubePlayerApi).mockResolvedValue({ Player } as unknown as YoutubePlayerApi);
  cleanup = () => act(() => root.unmount());
  await act(async () => root.render(<YoutubeLessonVideo url="https://www.youtube.com/embed/M7lc1UVf-VE?start=5&end=15" title="Fixture" />));
  const frame = host.querySelector("iframe")!;
  const url = new URL(frame.src);
  expect(url.searchParams.get("start")).toBe("5");
  expect(url.searchParams.get("end")).toBe("15");
  expect(url.searchParams.get("autoplay")).toBe("0");
  expect(url.searchParams.get("origin")).toBe(window.location.origin);
  expect(frame.referrerPolicy).toBe("strict-origin-when-cross-origin");
  expect(frame.className).toContain("h-full");
  expect(frame.parentElement?.className).toContain("aspect-video");
  expect(host.querySelector("button, a")).toBeNull();
  act(() => events[0].onError());
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("learning.videoError");
  await act(async () => root.render(<YoutubeLessonVideo url="https://www.youtube.com/embed/M7lc1UVf-VE?start=20" title="Fixture" />));
  expect(destroy).toHaveBeenCalledOnce();
  expect(host.querySelector("iframe")).not.toBe(frame);
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(Player).toHaveBeenCalledTimes(2);
});

it("caps a flush video at the same height the lesson column derives its width from", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  vi.mocked(loadYoutubePlayerApi).mockResolvedValue({ Player: vi.fn(() => ({ destroy: vi.fn() })) } as unknown as YoutubePlayerApi);
  cleanup = () => act(() => root.unmount());
  await act(async () => root.render(
    <><YoutubeLessonVideo url="https://www.youtube.com/embed/M7lc1UVf-VE" title="Fixture" flush /><LessonColumn>x</LessonColumn></>,
  ));
  const video = host.querySelector<HTMLElement>(".aspect-video")!;
  const column = host.querySelector<HTMLElement>("[data-lesson-column]")!;
  expect(video.style.maxHeight).toBe(LESSON_MEDIA_MAX_HEIGHT);
  expect(column.style.maxWidth).toContain(LESSON_MEDIA_MAX_HEIGHT);
});

it("reports API failure without extra controls", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  vi.mocked(loadYoutubePlayerApi).mockRejectedValue(new Error("API unavailable"));
  cleanup = () => act(() => root.unmount());
  await act(async () => root.render(<YoutubeLessonVideo url="https://www.youtube.com/embed/M7lc1UVf-VE" title="Fixture" />));
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(host.querySelector("button, a")).toBeNull();
  expect(loadYoutubePlayerApi).toHaveBeenCalledOnce();
});

it("reports a player that never becomes ready and ignores a late API after unmount", async () => {
  vi.useFakeTimers();
  const host = document.createElement("div");
  const root = createRoot(host);
  let resolve!: (api: YoutubePlayerApi) => void;
  vi.mocked(loadYoutubePlayerApi).mockReturnValue(new Promise(done => { resolve = done; }));
  await act(async () => root.render(<YoutubeLessonVideo url="https://www.youtube.com/embed/M7lc1UVf-VE" title="Fixture" />));
  act(() => vi.advanceTimersByTime(25_000));
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  act(() => root.unmount());
  cleanup = undefined;
  const Player = vi.fn();
  await act(async () => resolve({ Player } as unknown as YoutubePlayerApi));
  expect(Player).not.toHaveBeenCalled();
});

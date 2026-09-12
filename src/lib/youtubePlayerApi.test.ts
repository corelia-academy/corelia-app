// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { YoutubePlayerApi } from "./youtubePlayerApi";
type ApiWindow = Window & { YT?: YoutubePlayerApi; onYouTubeIframeAPIReady?: () => void };
const target = window as ApiWindow;
beforeEach(() => {
  // Keep a real DOM script node, but drive network outcomes explicitly in tests.
  const append = document.head.append.bind(document.head);
  vi.spyOn(document.head, "append").mockImplementation((...nodes) => {
    for (const node of nodes) if (node instanceof HTMLScriptElement) node.type = "application/json";
    append(...nodes);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  delete target.YT;
  delete target.onYouTubeIframeAPIReady;
  document.querySelectorAll('script[src="https://www.youtube.com/iframe_api"]').forEach(script => script.remove());
  vi.useRealTimers();
  vi.resetModules();
});

it("shares a pending script across consumers and preserves the prior ready callback", async () => {
  const previous = vi.fn();
  target.onYouTubeIframeAPIReady = previous;
  const { loadYoutubePlayerApi } = await import("./youtubePlayerApi");
  const first = loadYoutubePlayerApi(), second = loadYoutubePlayerApi();
  expect(first).toBe(second);
  expect(document.querySelectorAll('script[src="https://www.youtube.com/iframe_api"]')).toHaveLength(1);
  target.YT = { Player: vi.fn() } as unknown as YoutubePlayerApi;
  target.onYouTubeIframeAPIReady!();
  expect(await first).toBe(target.YT);
  expect(previous).toHaveBeenCalledOnce();
  expect(target.onYouTubeIframeAPIReady).toBe(previous);
});

it("removes failed scripts and permits a fresh retry", async () => {
  const { loadYoutubePlayerApi } = await import("./youtubePlayerApi");
  const failed = loadYoutubePlayerApi();
  const rejected = expect(failed).rejects.toThrow("YOUTUBE_API_UNAVAILABLE");
  const old = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')!;
  old.dispatchEvent(new Event("error"));
  await rejected;
  const retry = loadYoutubePlayerApi();
  expect(document.querySelector('script[src="https://www.youtube.com/iframe_api"]')).not.toBe(old);
  target.YT = { Player: vi.fn() } as unknown as YoutubePlayerApi;
  target.onYouTubeIframeAPIReady!();
  expect(await retry).toBe(target.YT);
});

it("times out a blocked API script instead of leaving the loader pending", async () => {
  vi.useFakeTimers();
  const { loadYoutubePlayerApi } = await import("./youtubePlayerApi");
  const result = loadYoutubePlayerApi();
  const rejected = expect(result).rejects.toThrow("YOUTUBE_API_UNAVAILABLE");
  vi.advanceTimersByTime(20_000);
  await rejected;
  expect(document.querySelector('script[src="https://www.youtube.com/iframe_api"]')).toBeNull();
});

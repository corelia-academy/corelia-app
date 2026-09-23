// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useXpWeek } from "./useXpWeek";
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("updates on Monday UTC and catches up after a sleeping tab resumes", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-27T23:59:59Z"));
  const host = document.createElement("div");
  const root = createRoot(host);
  function Week() { return <span>{useXpWeek()}</span>; }
  try {
    await act(async () => root.render(<Week />));
    expect(host.textContent).toBe("2026-09-21T00:00:00.000Z");
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(host.textContent).toBe("2026-09-28T00:00:00.000Z");
    vi.setSystemTime(new Date("2026-10-12T08:00:00Z"));
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(host.textContent).toBe("2026-10-12T00:00:00.000Z");
  } finally {
    act(() => root.unmount());
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  }
});

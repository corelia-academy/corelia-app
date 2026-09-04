// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "@/components/ErrorBoundary";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function StaleChunkFailure(): never {
  throw new TypeError(
    "Failed to fetch dynamically imported module: https://app.corelia.academy/assets/index-old.js",
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
  window.localStorage.clear();
});

describe("ErrorBoundary stale chunk fallback", () => {
  it("shows safe copy without the chunk URL and goes home without clearing auth", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    window.history.replaceState({}, "", "/courses/example?tab=learn#lesson");
    window.localStorage.setItem("corelia-auth", "persisted-session");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ErrorBoundary>
          <StaleChunkFailure />
        </ErrorBoundary>,
      );
    });

    expect(container.textContent).toContain("errorBoundary.staleTitle");
    expect(container.textContent).toContain("errorBoundary.staleMessage");
    expect(container.textContent).not.toContain("index-old.js");

    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    act(() => {
      buttons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(window.location.pathname).toBe("/");
    expect(window.localStorage.getItem("corelia-auth")).toBe("persisted-session");

    act(() => root.unmount());
  });
});

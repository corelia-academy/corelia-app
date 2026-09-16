// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}));

import AdminComponentsPage from "./AdminComponentsPage";

describe("AdminComponentsPage", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders one standalone page with navigation and every component section", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <AdminComponentsPage />
        </MemoryRouter>,
      );
    });

    expect(container.querySelectorAll('a[href^="/components/"]')).toHaveLength(7);
    expect(container.querySelector('a[href="/components/action"]')).not.toBeNull();
    expect(container.querySelector('a[href="/components/scrollbar"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="component-navigation"]')).not.toBeNull();
    expect(container.querySelectorAll('section[id^="component-"]')).toHaveLength(7);
    expect(container.querySelectorAll('[data-testid="component-section-title"]')).toHaveLength(7);
    expect(container.querySelector('[data-testid="component-section-title"]')?.textContent).toBe("Action");
    expect(container.textContent).toContain("Badge");
    expect(container.textContent).toContain("Selection");
    expect(container.querySelector('button')?.textContent).toContain("Back to app");
    expect(container.querySelector('[data-testid="theme-toggle-light"]')?.textContent).toContain("Light");
    expect(container.querySelector('[data-testid="theme-toggle-dark"]')?.textContent).toContain("Dark");
    expect(container.querySelectorAll('[data-testid^="theme-toggle-"]')).toHaveLength(2);
    expect(container.querySelector('[data-slot="sidebar"]')).toBeNull();
    expect(container.querySelector('[data-slot="sidebar-inset"]')).toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });

  it("scrolls to the component section for a deep-link URL", async () => {
    const scrollTargets: string[] = [];
    const originalScrollIntoView = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollIntoView",
    );
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value(this: HTMLElement) {
        scrollTargets.push(this.id);
      },
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/components/action"]}>
          <AdminComponentsPage />
        </MemoryRouter>,
      );
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(scrollTargets).toContain("component-action");

    await act(async () => root.unmount());
    container.remove();
    if (originalScrollIntoView) {
      Object.defineProperty(
        HTMLElement.prototype,
        "scrollIntoView",
        originalScrollIntoView,
      );
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
  });
});

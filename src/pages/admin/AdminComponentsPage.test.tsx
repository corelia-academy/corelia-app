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
    vi.unstubAllGlobals();
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
    expect(container.querySelector('a[href="/components"]')).toBeNull();
    expect(container.querySelector('[data-testid="component-navigation"]')).not.toBeNull();
    expect(container.querySelectorAll('section[id^="component-"]')).toHaveLength(7);
    expect(container.querySelectorAll('[data-testid="component-section-title"]')).toHaveLength(7);
    expect(container.querySelector('[data-testid="component-section-title"]')?.textContent).toBe("Action");
    expect(container.textContent).toContain("Badge");
    expect(container.textContent).toContain("Selection");
    const header = container.querySelector("main > header");
    const sidebar = container.querySelector("aside");

    expect(header?.querySelector("button")).toBeNull();
    expect(header?.querySelector('[data-testid^="theme-toggle-"]')).toBeNull();
    expect(sidebar?.querySelector("button")?.textContent).toContain("Back to app");
    expect(sidebar?.querySelector('[data-testid="theme-toggle-light"]')?.textContent).toContain("Light");
    expect(sidebar?.querySelector('[data-testid="theme-toggle-dark"]')?.textContent).toContain("Dark");
    expect(sidebar?.querySelectorAll('[data-testid^="theme-toggle-"]')).toHaveLength(2);
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

  it("updates the active menu item when a component section enters the viewport", async () => {
    class MockIntersectionObserver {
      static instances: MockIntersectionObserver[] = [];
      private readonly callback: IntersectionObserverCallback;

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
        MockIntersectionObserver.instances.push(this);
      }

      observe() {}

      disconnect() {}

      emit(entries: IntersectionObserverEntry[]) {
        this.callback(entries, this as unknown as IntersectionObserver);
      }
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/components"]}>
          <AdminComponentsPage />
        </MemoryRouter>,
      );
    });

    const observer = MockIntersectionObserver.instances[0];
    const badgeSection = container.querySelector("#component-badge");
    expect(observer).toBeDefined();
    expect(badgeSection).not.toBeNull();

    for (const section of container.querySelectorAll<HTMLElement>(
      'section[id^="component-"]',
    )) {
      Object.defineProperty(section, "getBoundingClientRect", {
        configurable: true,
        value: () => ({
          top: section === badgeSection ? 24 : 200,
        }),
      });
    }

    await act(async () => {
      observer.emit([
        {
          target: badgeSection as Element,
          isIntersecting: true,
          intersectionRatio: 1,
        } as IntersectionObserverEntry,
      ]);
    });

    const badgeLink = container.querySelector('a[href="/components/badge"]');
    expect(badgeLink?.getAttribute("aria-current")).toBe("page");
    expect(badgeLink?.getAttribute("data-active")).toBe("true");

    await act(async () => root.unmount());
    container.remove();
  });

  it("keeps the clicked component active during smooth scrolling", async () => {
    class MockIntersectionObserver {
      static instances: MockIntersectionObserver[] = [];
      private readonly callback: IntersectionObserverCallback;

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
        MockIntersectionObserver.instances.push(this);
      }

      observe() {}

      disconnect() {}

      emit(entries: IntersectionObserverEntry[]) {
        this.callback(entries, this as unknown as IntersectionObserver);
      }
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

    const originalScrollIntoView = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollIntoView",
    );
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/components"]}>
          <AdminComponentsPage />
        </MemoryRouter>,
      );
    });

    const badgeLink = container.querySelector('a[href="/components/badge"]');
    const observer = MockIntersectionObserver.instances[0];
    expect(badgeLink).not.toBeNull();
    expect(observer).toBeDefined();

    await act(async () => {
      badgeLink?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    await act(async () => {
      observer.emit([]);
    });

    expect(badgeLink?.getAttribute("aria-current")).toBe("page");
    expect(badgeLink?.getAttribute("data-active")).toBe("true");

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

  it("keeps the section active when the observer has no visible entries", async () => {
    class MockIntersectionObserver {
      static instances: MockIntersectionObserver[] = [];
      private readonly callback: IntersectionObserverCallback;

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
        MockIntersectionObserver.instances.push(this);
      }

      observe() {}

      disconnect() {}

      emit(entries: IntersectionObserverEntry[]) {
        this.callback(entries, this as unknown as IntersectionObserver);
      }
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/components"]}>
          <AdminComponentsPage />
        </MemoryRouter>,
      );
    });

    const selectionSection = container.querySelector<HTMLElement>(
      "#component-selection",
    );
    const selectionLink = container.querySelector(
      'a[href="/components/selection"]',
    );
    const observer = MockIntersectionObserver.instances[0];

    expect(selectionSection).not.toBeNull();
    expect(selectionLink).not.toBeNull();
    expect(observer).toBeDefined();

    for (const section of container.querySelectorAll<HTMLElement>(
      'section[id^="component-"]',
    )) {
      Object.defineProperty(section, "getBoundingClientRect", {
        configurable: true,
        value: () => ({
          top: section === selectionSection ? 24 : 200,
        }),
      });
    }

    await act(async () => {
      observer.emit([]);
    });

    expect(selectionLink?.getAttribute("aria-current")).toBe("page");
    expect(selectionLink?.getAttribute("data-active")).toBe("true");

    await act(async () => root.unmount());
    container.remove();
  });
});

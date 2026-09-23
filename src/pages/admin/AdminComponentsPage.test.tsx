// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { gsap } from "gsap";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}));

import AdminComponentsPage from "./AdminComponentsPage";

function LocationProbe({
  onPathnameChange,
}: {
  onPathnameChange: (pathname: string) => void;
}) {
  const { pathname } = useLocation();

  useEffect(() => {
    onPathnameChange(pathname);
  }, [onPathnameChange, pathname]);

  return null;
}

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

    expect(container.querySelectorAll('a[href^="/components/"]')).toHaveLength(10);
    expect(container.querySelector('a[href="/components/action"]')).not.toBeNull();
    expect(container.querySelector('a[href="/components/avatar"]')).not.toBeNull();
    expect(container.querySelector('a[href="/components/scrollbar"]')).not.toBeNull();
    expect(container.querySelector('a[href="/components/tabs"]')).not.toBeNull();
    expect(container.querySelector('a[href="/components"]')).toBeNull();
    expect(container.querySelector('[data-testid="component-navigation"]')).not.toBeNull();
    expect(container.querySelectorAll('section[id^="component-"]')).toHaveLength(10);
    expect(container.querySelectorAll('[data-testid="component-section-title"]')).toHaveLength(10);
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

  it("animates one shared active indicator between menu items", async () => {
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
    const gsapToSpy = vi.spyOn(gsap, "to");

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
    const selectionSection = container.querySelector<HTMLElement>(
      "#component-selection",
    );
    const selectionItem = container.querySelector<HTMLElement>(
      '[data-component-nav-item="selection"]',
    );
    const activeIndicator = container.querySelector<HTMLElement>(
      '[data-testid="component-active-indicator"]',
    );

    expect(observer).toBeDefined();
    expect(selectionSection).not.toBeNull();
    expect(selectionItem).not.toBeNull();
    expect(activeIndicator).not.toBeNull();

    Object.defineProperties(selectionItem as HTMLElement, {
      offsetLeft: { configurable: true, value: 0 },
      offsetTop: { configurable: true, value: 128 },
      offsetWidth: { configurable: true, value: 240 },
      offsetHeight: { configurable: true, value: 50 },
    });

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

    expect(gsapToSpy).toHaveBeenCalledWith(
      activeIndicator,
      expect.objectContaining({
        x: 0,
        y: 128,
        width: 240,
        height: 50,
        duration: 0.32,
        ease: "power3.out",
        overwrite: "auto",
      }),
    );

    await act(async () => root.unmount());
    container.remove();
  });

  it("scrolls the active menu item into view without centering it", async () => {
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
    const gsapToSpy = vi.spyOn(gsap, "to");

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
    const tagSection = container.querySelector<HTMLElement>("#component-tag");
    const activeMenuItem = container.querySelector<HTMLElement>(
      '[data-component-nav-item="tag"]',
    );
    const navigation = container.querySelector<HTMLElement>(
      '[data-testid="component-navigation"]',
    );
    expect(observer).toBeDefined();
    expect(tagSection).not.toBeNull();
    expect(activeMenuItem).not.toBeNull();
    expect(navigation).not.toBeNull();
    Object.defineProperty(navigation as HTMLElement, "clientHeight", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(navigation as HTMLElement, "scrollHeight", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(navigation as HTMLElement, "scrollTop", {
      configurable: true,
      writable: true,
      value: 100,
    });
    Object.defineProperty(navigation as HTMLElement, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ top: 0, bottom: 100 }),
    });
    Object.defineProperty(activeMenuItem as HTMLElement, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ top: -20, bottom: 30 }),
    });

    for (const section of container.querySelectorAll<HTMLElement>(
      'section[id^="component-"]',
    )) {
      Object.defineProperty(section, "getBoundingClientRect", {
        configurable: true,
        value: () => ({
          top: section === tagSection ? 24 : 200,
        }),
      });
    }

    await act(async () => {
      observer.emit([]);
    });

    expect(activeMenuItem?.getAttribute("data-active")).toBe("true");
    expect(gsapToSpy).toHaveBeenCalledWith(
      navigation,
      expect.objectContaining({
        scrollTop: 68,
        duration: 0.35,
        ease: "power2.out",
        overwrite: "auto",
      }),
    );

    await act(async () => root.unmount());
    container.remove();
  });

  it("updates the URL through SPA navigation when scrolling to a section", async () => {
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

    const pathnames: string[] = [];
    const onPathnameChange = (pathname: string) => {
      pathnames.push(pathname);
    };
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
          <LocationProbe onPathnameChange={onPathnameChange} />
          <AdminComponentsPage />
        </MemoryRouter>,
      );
    });

    const observer = MockIntersectionObserver.instances[0];
    const selectionSection = container.querySelector<HTMLElement>(
      "#component-selection",
    );
    expect(observer).toBeDefined();
    expect(selectionSection).not.toBeNull();

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

    expect(pathnames).toContain("/components/selection");
    expect(container.isConnected).toBe(true);
    expect(MockIntersectionObserver.instances).toHaveLength(1);

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

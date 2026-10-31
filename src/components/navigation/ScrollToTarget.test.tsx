// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScrollToTarget } from "./ScrollToTarget";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const scrollIntoView = vi.fn();

async function renderAt(state: { scrollTo: string } | undefined) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[{ pathname: "/account/profile", state }]}>
        <ScrollToTarget />
        <div id="connected-github" tabIndex={-1} />
      </MemoryRouter>,
    );
  });
  // The component polls with requestAnimationFrame until the target exists.
  for (let i = 0; i < 2; i += 1) {
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
  }

  return { container, root };
}

describe("ScrollToTarget", () => {
  beforeEach(() => {
    scrollIntoView.mockClear();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("centers and highlights the element named in router state", async () => {
    const { container, root } = await renderAt({ scrollTo: "connected-github" });

    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: "center" }));
    expect(container.querySelector("#connected-github")?.getAttribute("data-scroll-highlight")).toBe("true");

    await act(async () => root.unmount());
    container.remove();
  });

  it("keeps the highlight until the user clicks or touches the screen", async () => {
    const { container, root } = await renderAt({ scrollTo: "connected-github" });
    const target = container.querySelector("#connected-github");
    expect(target?.getAttribute("data-scroll-highlight")).toBe("true");

    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 2500));
    });
    expect(target?.getAttribute("data-scroll-highlight")).toBe("true");

    await act(async () => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(target?.hasAttribute("data-scroll-highlight")).toBe(false);

    await act(async () => root.unmount());
    container.remove();
  });

  it("does nothing when navigation carries no scroll target", async () => {
    const { container, root } = await renderAt(undefined);

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(container.querySelector("#connected-github")?.hasAttribute("data-scroll-highlight")).toBe(false);

    await act(async () => root.unmount());
    container.remove();
  });
});

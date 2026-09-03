// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useNavigate } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ScrollToTop } from "./ScrollToTop";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function NavigationControls() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate("?sectors=sector-ai-engineering", { preventScrollReset: true })}>Filter</button>
      <button type="button" onClick={() => navigate("/another-page")}>Other page</button>
    </>
  );
}

describe("ScrollToTop", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("preserves scroll for query-only navigation and resets it for a new pathname", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/hackathons/demo/projects"]}>
          <ScrollToTop />
          <NavigationControls />
        </MemoryRouter>,
      );
    });
    expect(scrollTo).toHaveBeenCalledOnce();
    scrollTo.mockClear();

    const [filterButton, otherPageButton] = container.querySelectorAll("button");
    await act(async () => filterButton.click());
    expect(scrollTo).not.toHaveBeenCalled();

    await act(async () => otherPageButton.click());
    expect(scrollTo).toHaveBeenCalledOnce();

    await act(async () => root.unmount());
    container.remove();
  });
});

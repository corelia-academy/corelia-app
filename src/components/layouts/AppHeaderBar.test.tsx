import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppHeaderBar } from "./AppHeaderBar";

describe("AppHeaderBar", () => {
  it("renders the shared frame around its children", () => {
    const markup = renderToStaticMarkup(
      <AppHeaderBar>
        <span>content</span>
      </AppHeaderBar>,
    );

    expect(markup).toContain("h-16");
    expect(markup).toContain("border-b border-border bg-background");
    expect(markup).toContain("max-w-[1990px]");
    expect(markup).toContain("sm:px-2xl");
    expect(markup).toContain("<span>content</span>");
  });

  it("lets the caller override positioning and pass header attributes", () => {
    const markup = renderToStaticMarkup(
      <AppHeaderBar className="sticky top-0 z-40" aria-hidden>
        x
      </AppHeaderBar>,
    );

    expect(markup).toContain("sticky top-0 z-40");
    expect(markup).not.toContain("relative");
    expect(markup).toContain('aria-hidden="true"');
  });
});

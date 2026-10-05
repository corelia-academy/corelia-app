import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import emptyNoDataSvg from "@/assets/illustrations/empty-state/empty-no-data.svg";
import searchNoDataSvg from "@/assets/illustrations/empty-state/search-no-data.svg";
import { EmptyStateIllustration } from "./empty-state-illustration";

describe("EmptyStateIllustration", () => {
  it.each([
    ["search", searchNoDataSvg],
    ["empty", emptyNoDataSvg],
  ] as const)("renders the %s illustration", (type, source) => {
    const markup = renderToStaticMarkup(
      <EmptyStateIllustration type={type} size="medium" />,
    );

    expect(markup).toContain(`src="${source.replaceAll("'", "&#x27;")}"`);
    expect(markup).toContain('alt=""');
    expect(markup).toContain('aria-hidden="true"');
  });

  it.each([
    ["tiny", "size-[120px]"],
    ["medium", "size-[200px]"],
    ["large", "size-[280px]"],
  ] as const)("uses the Figma frame size for %s", (size, sizeClass) => {
    const markup = renderToStaticMarkup(
      <EmptyStateIllustration type="search" size={size} />,
    );

    expect(markup).toContain(sizeClass);
    expect(markup).toContain("select-none");
    expect(markup).toContain('draggable="false"');
  });

  it("shows description but hides title for tiny size", () => {
    const markup = renderToStaticMarkup(
      <EmptyStateIllustration
        type="empty"
        size="tiny"
        title="Hidden title"
        description="Visible description"
      />,
    );

    expect(markup).not.toContain("Hidden title");
    expect(markup).toContain("Visible description");
  });

  it.each(["medium", "large"] as const)(
    "shows title and description for %s size",
    (size) => {
      const markup = renderToStaticMarkup(
        <EmptyStateIllustration
          type="empty"
          size={size}
          title="Empty title"
          description="Empty description"
        />,
      );

      expect(markup).toContain("Empty title");
      expect(markup).toContain("Empty description");
    },
  );

  it("omits the text area when no text is provided", () => {
    const markup = renderToStaticMarkup(
      <EmptyStateIllustration type="search" size="large" />,
    );

    expect(markup).not.toContain("<p");
  });
});

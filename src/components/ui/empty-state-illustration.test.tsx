import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EmptyStateIllustration } from "./empty-state-illustration";

describe("EmptyStateIllustration", () => {
  it.each([
    ["search", 'id="Empty Illustration"'],
    ["empty", 'id="Group 2"'],
  ] as const)("renders the %s illustration", (type, expectedSvgId) => {
    const markup = renderToStaticMarkup(
      <EmptyStateIllustration type={type} size="medium" />,
    );

    expect(markup).toContain("<svg");
    expect(markup).toContain(expectedSvgId);
    expect(markup).toContain('fill="var(--empty-state-art-surface)"');
    expect(markup).not.toContain("#0B1528");
  });

  it.each([
    ["tiny", "size-[120px]"],
    ["medium", "size-[200px]"],
    ["large", "size-[280px]"],
    ["fullPage", "size-[240px]"],
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

  it.each(["medium", "large", "fullPage"] as const)(
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

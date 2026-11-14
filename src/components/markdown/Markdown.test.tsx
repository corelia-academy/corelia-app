import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";

const CONTENT = "# Title\n\nSome `inline` text.\n\n| A | B |\n| - | - |\n| 1 | 2 |\n";

describe("Markdown variants", () => {
  it("keeps the original look outside the learn flow", () => {
    const html = renderToStaticMarkup(<Markdown content={CONTENT} />);
    expect(html).toContain("space-y-3 text-sm leading-7 text-foreground-muted");
    expect(html).toContain("mt-6 text-heading-medium font-display text-foreground");
    expect(html).toContain("rounded bg-surface-raised");
    expect(html).not.toContain("min-w-[32rem]");
    expect(html).not.toContain("bg-code-block-surface");
  });

  it("keeps the compact look unchanged", () => {
    const html = renderToStaticMarkup(<Markdown content={CONTENT} compact />);
    expect(html).toContain("space-y-2 text-sm leading-relaxed");
    expect(html).toContain("rounded bg-surface-raised");
    expect(html).not.toContain("min-w-[32rem]");
  });

  it("applies the new learn look only to the lesson variant", () => {
    const html = renderToStaticMarkup(<Markdown content={CONTENT} variant="lesson" />);
    expect(html).toContain("flex flex-col gap-xl text-body-large text-action-text");
    expect(html).toContain("mb-md mt-3xl font-display text-heading-large");
    expect(html).toContain("rounded-md bg-code-block-surface");
    expect(html).toContain("min-w-[32rem]");
    expect(html).not.toContain("space-y-3");
  });
});

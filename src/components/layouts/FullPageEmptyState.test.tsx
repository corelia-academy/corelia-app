import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import emptyNoDataSvg from "@/assets/illustrations/empty-state/empty-no-data.svg";
import { FullPageEmptyState } from "./FullPageEmptyState";

describe("FullPageEmptyState", () => {
  it("centers the full-page empty illustration and displays its content", () => {
    const markup = renderToStaticMarkup(
      <FullPageEmptyState
        title="No courses"
        description="There are no courses yet"
      />,
    );

    expect(markup).toContain(
      "full-page-empty-state container-app flex min-h-[calc(100svh-var(--app-header-height,0px))] items-center justify-center",
    );
    expect(markup).toContain(
      '<main class="flex w-full items-center justify-center">',
    );
    expect(markup).toContain(
      `src="${emptyNoDataSvg.replaceAll("'", "&#x27;")}"`,
    );
    expect(markup).toContain("size-[240px]");
    expect(markup).toContain("No courses");
    expect(markup).toContain("There are no courses yet");
  });
});

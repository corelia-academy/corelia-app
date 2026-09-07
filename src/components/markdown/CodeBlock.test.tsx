// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CodeBlock } from "./CodeBlock";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("CodeBlock scrolling", () => {
  it("styles and focuses the actual native code scroller", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(
      <CodeBlock language="javascript" code={`const values = [${"1, ".repeat(100)}];`} />,
    );
    const scroller = container.querySelector("pre");
    expect(scroller).not.toBeNull();
    expect(scroller?.style.overflow).toBe("auto");
    expect(scroller?.classList.contains("scrollbar-design")).toBe(true);
    expect(scroller?.tabIndex).toBe(0);
  });
});

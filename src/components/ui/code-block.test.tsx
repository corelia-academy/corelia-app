// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { CodeBlock, CodeBlockFrame, CodeBlockLine, CodeSpan, type CodeBlockTab } from "./code-block";
import { codeSyntaxStyle } from "./code-syntax";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const copyButton = (root: ParentNode) => root.querySelector<HTMLButtonElement>('button[aria-label="actions.copy"]');

function markup(node: ReactNode) {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(node);
  return container;
}

async function mount(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(node));
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

describe("CodeBlock header", () => {
  it("shows the language label and a copy button by default", () => {
    const container = markup(<CodeBlock language="rust" code="fn main() {}" />);
    const block = container.querySelector('[data-slot="code-block"]');
    expect(block?.getAttribute("data-header")).toBe("label");
    expect(block?.textContent).toContain("Rust");
    expect(copyButton(container)).not.toBeNull();
  });

  it("keeps the language label but drops the copy button when copying is off", () => {
    const container = markup(<CodeBlock language="rust" code="fn main() {}" copyable={false} />);
    expect(container.querySelector('[data-slot="code-block"]')?.textContent).toContain("Rust");
    expect(copyButton(container)).toBeNull();
  });

  it("floats the copy button inside the body when the header is off", () => {
    const container = markup(<CodeBlock language="rust" code="fn main() {}" header={false} />);
    const block = container.querySelector('[data-slot="code-block"]');
    expect(block?.getAttribute("data-header")).toBe("none");
    expect(block?.querySelector(".bg-code-block-header-surface")).toBeNull();
    expect(block?.textContent).not.toContain("Rust");
    expect(copyButton(container)).not.toBeNull();
  });
});

describe("CodeBlock body", () => {
  it("uses the Figma line geometry and a focusable scroller", () => {
    const container = markup(<CodeBlock language="javascript" code={`const values = [${"1, ".repeat(100)}];`} />);
    const scroller = container.querySelector("pre");
    expect(scroller).not.toBeNull();
    expect(scroller?.style.lineHeight).toBe("2rem");
    expect(scroller?.style.paddingTop).toBe("0.75rem");
    expect(scroller?.style.paddingLeft).toBe("1.25rem");
    expect(scroller?.style.overflow).toBe("auto");
    expect(scroller?.classList.contains("scrollbar-design")).toBe(true);
    expect(scroller?.tabIndex).toBe(0);
  });

  it("shows line numbers unless they are turned off", () => {
    const code = "one\ntwo\nthree";
    expect(markup(<CodeBlock language="bash" code={code} />).querySelectorAll('[class*="linenumber"]')).toHaveLength(3);
    expect(markup(<CodeBlock language="bash" code={code} showLineNumbers={false} />).querySelector('[class*="linenumber"]')).toBeNull();
  });

  it("colors the syntax only through semantic tokens", () => {
    const colors = Object.values(codeSyntaxStyle).map(style => String(style.color));
    expect(colors.length).toBeGreaterThan(0);
    for (const color of colors) expect(color).toMatch(/^var\(--code-(block|syntax)-/);
  });
});

describe("CodeBlock copy", () => {
  it("shows a toast after copying, and an error toast when copying fails", async () => {
    const { container, unmount } = await mount(<CodeBlock language="rust" code="fn main() {}" />);
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const button = copyButton(container)!;
    await act(async () => button.click());
    expect(writeText).toHaveBeenCalledWith("fn main() {}");
    expect(toast.success).toHaveBeenCalledWith("actions.copied", { position: "top-right" });
    await act(async () => button.click());
    expect(toast.error).toHaveBeenCalledWith("actions.copyFailed", { position: "top-right" });
    unmount();
  });
});

describe("CodeBlock Remix action", () => {
  it("offers Run in Remix only for Solidity", () => {
    const remix = 'a[href^="https://remix.ethereum.org/#code="]';
    expect(markup(<CodeBlock language="solidity" code="contract A {}" />).querySelector(remix)).not.toBeNull();
    expect(markup(<CodeBlock language="sol" code="contract A {}" />).querySelector(remix)).not.toBeNull();
    expect(markup(<CodeBlock language="rust" code="fn main() {}" />).querySelector(remix)).toBeNull();
  });
});

describe("CodeBlock language tabs", () => {
  const tabs: CodeBlockTab[] = [
    { id: "js", label: "javascript", language: "javascript", code: "const a = 1;" },
    { id: "ts", label: "typescript", language: "typescript", code: "const b: number = 2;" },
  ];

  it("switches the code with the tab and copies the code of the active tab", async () => {
    const { container, unmount } = await mount(<CodeBlock tabs={tabs} />);
    expect(container.querySelector('[data-slot="code-block"]')?.getAttribute("data-header")).toBe("tabs");
    const tabButtons = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'));
    expect(tabButtons.map(tab => tab.textContent)).toEqual(["javascript", "typescript"]);
    expect(tabButtons[0].getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector("pre")?.textContent).toContain("const a = 1;");

    await act(async () => tabButtons[1].click());
    expect(tabButtons[1].getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector("pre")?.textContent).toContain("const b: number = 2;");

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await act(async () => copyButton(container)!.click());
    expect(writeText).toHaveBeenCalledWith("const b: number = 2;");
    unmount();
  });
});

describe("CodeBlockFrame, CodeBlockLine and CodeSpan", () => {
  it("frames hand-built rows like a code block, with the gutter sized by digits", () => {
    const container = markup(
      <CodeBlockFrame label="Rust">
        <CodeBlockLine number={7} digits={2}><span>let x</span></CodeBlockLine>
      </CodeBlockFrame>,
    );
    const block = container.querySelector('[data-slot="code-block"]');
    expect(block?.getAttribute("data-header")).toBe("label");
    expect(block?.textContent).toContain("Rust");
    const gutter = block?.querySelector<HTMLElement>('[aria-hidden="true"]');
    expect(gutter?.textContent).toBe("7");
    expect(gutter?.className).toContain("text-code-block-line-number");
    expect(gutter?.style.minWidth).toBe("calc(2ch + 1.25rem)");
    expect(block?.querySelector("code")?.className).toContain("text-code-block-text");
  });

  it("drops the header but keeps the actions inside the body when the header is off", () => {
    const container = markup(
      <CodeBlockFrame label="Rust" header={false} actions={<button type="button">act</button>}>
        <p>body</p>
      </CodeBlockFrame>,
    );
    const block = container.querySelector('[data-slot="code-block"]');
    expect(block?.getAttribute("data-header")).toBe("none");
    expect(block?.querySelector(".bg-code-block-header-surface")).toBeNull();
    expect(block?.querySelector("button")?.textContent).toBe("act");
  });

  it("highlights inline code through the semantic tokens only", () => {
    const container = markup(<CodeSpan language="javascript" code="const a = 1;" />);
    expect(container.innerHTML).toContain("--code-syntax-keyword");
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});

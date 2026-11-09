// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { CodeBlock } from "./CodeBlock";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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

describe("CodeBlock header", () => {
  const render = (props: { language: string; copyable?: boolean }) => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<CodeBlock code="fn main() {}" {...props} />);
    return container;
  };

  it("shows the language label and a copy button by default", () => {
    const container = render({ language: "rust" });
    expect(container.querySelector('[data-slot="code-block"]')?.textContent).toContain("Rust");
    expect(container.querySelector('button[aria-label="actions.copy"]')).not.toBeNull();
  });

  it("shows a toast after copying, and an error toast when copying fails", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<CodeBlock language="rust" code="fn main() {}" />));
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const button = container.querySelector<HTMLButtonElement>('button[aria-label="actions.copy"]')!;
    await act(async () => button.click());
    expect(writeText).toHaveBeenCalledWith("fn main() {}");
    expect(toast.success).toHaveBeenCalledWith("actions.copied", { position: "top-right" });
    await act(async () => button.click());
    expect(toast.error).toHaveBeenCalledWith("actions.copyFailed", { position: "top-right" });
    act(() => root.unmount());
    container.remove();
  });

  it("keeps the language label but drops the copy button when copying is off", () => {
    const container = render({ language: "rust", copyable: false });
    expect(container.querySelector('[data-slot="code-block"]')?.textContent).toContain("Rust");
    expect(container.querySelector('button[aria-label="actions.copy"]')).toBeNull();
  });
});

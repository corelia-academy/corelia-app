// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { InputCode, type InputCodeProps } from "./input-code";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("./input-code-monaco", () => ({
  default: (props: { value: string; placeholder?: string; readOnly?: boolean; errorLines?: number[]; onFocusChange?(focused: boolean): void }) => (
    <div data-testid="monaco" data-value={props.value} data-placeholder={props.placeholder} data-readonly={String(!!props.readOnly)} data-errors={(props.errorLines ?? []).join(",")}>
      <button type="button" onClick={() => props.onFocusChange?.(true)}>focus</button>
      <button type="button" onClick={() => props.onFocusChange?.(false)}>blur</button>
    </div>
  ),
}));

async function mount(props: Partial<InputCodeProps> = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<InputCode language="rust" value="" onChange={() => {}} {...props} />));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  return { container, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

const status = (container: HTMLElement) => container.querySelector('[data-slot="input-code"]')?.getAttribute("data-status");
const press = (container: HTMLElement, label: string) => Array.from(container.querySelectorAll("button")).find(button => button.textContent === label)!;

describe("InputCode", () => {
  it("shows the language label and passes the hint to the editor", async () => {
    const { container, unmount } = await mount({ placeholder: "// Write your code" });
    expect(container.querySelector('[data-slot="input-code"]')?.textContent).toContain("Rust");
    expect(container.querySelector('[data-testid="monaco"]')?.getAttribute("data-placeholder")).toBe("// Write your code");
    unmount();
  });

  it("derives default and filled from the value", async () => {
    const empty = await mount({ value: "" });
    expect(status(empty.container)).toBe("default");
    empty.unmount();
    const filled = await mount({ value: "fn main() {}" });
    expect(status(filled.container)).toBe("filled");
    filled.unmount();
  });

  it("shows focused while the editor has focus", async () => {
    const { container, unmount } = await mount({ value: "fn main() {}" });
    await act(async () => press(container, "focus").click());
    expect(status(container)).toBe("focused");
    await act(async () => press(container, "blur").click());
    expect(status(container)).toBe("filled");
    unmount();
  });

  it("makes the editor read-only when disabled", async () => {
    const { container, unmount } = await mount({ value: "fn main() {}", disabled: true });
    expect(status(container)).toBe("disabled");
    expect(container.querySelector('[data-testid="monaco"]')?.getAttribute("data-readonly")).toBe("true");
    unmount();
  });

  it("marks the wrong lines and lets error win over focus without focus ring", async () => {
    const { container, unmount } = await mount({ value: "a\nb", errorLines: [2] });
    expect(status(container)).toBe("error");
    expect(container.querySelector('[data-testid="monaco"]')?.getAttribute("data-errors")).toBe("2");
    expect(container.querySelector('[data-slot="input-code"]')?.className).not.toContain("focus-within:ring-2");
    await act(async () => press(container, "focus").click());
    expect(status(container)).toBe("error");
    unmount();
  });

  it("makes the editor read-only and suppresses pointer events without focus ring", async () => {
    const { container, unmount } = await mount({ value: "fn main() {}", readOnly: true });
    expect(status(container)).toBe("filled");
    expect(container.querySelector('[data-slot="input-code"]')?.getAttribute("data-readonly")).toBe("true");
    expect(container.querySelector('[data-slot="input-code"]')?.className).not.toContain("focus-within:ring-2");
    expect(container.querySelector('[data-testid="monaco"]')?.getAttribute("data-readonly")).toBe("true");
    expect(container.querySelector('.pointer-events-none')).not.toBeNull();
    unmount();
  });
});

// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { User } from "@/components/ui/user";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let cleanup: (() => void) | undefined;

afterEach(() => cleanup?.());

function mount(props?: React.ComponentProps<typeof User>) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanup = () => {
    act(() => root.unmount());
    container.remove();
  };
  act(() => {
    root.render(<User {...props} />);
  });
  return container;
}

describe("User", () => {
  it("renders the supplied username and Figma states", () => {
    const userName = "Nguyễn Văn An";
    const container = mount({
      children: userName,
      state: "Clicked",
      showDropdown: true,
    });
    const button = container.querySelector<HTMLButtonElement>("button");

    expect(button?.type).toBe("button");
    expect(button?.dataset.state).toBe("Clicked");
    expect(button?.dataset.userState).toBe("Clicked");
    expect(container.querySelector('[data-slot="user-label"]')?.textContent).toBe(userName);
    expect(container.querySelector('[data-slot="user-dropdown"]')).not.toBeNull();
  });

  it("does not invent a label when no username is supplied", () => {
    const container = mount();

    expect(container.querySelector('[data-slot="user-label"]')?.textContent).toBe("");
  });

  it("keeps native button keyboard semantics and forwards events", () => {
    const onClick = vi.fn();
    const container = mount({ "aria-label": "Open account menu", onClick });
    const button = container.querySelector<HTMLButtonElement>("button")!;

    expect(button.getAttribute("aria-label")).toBe("Open account menu");
    expect(button.tabIndex).toBe(0);

    act(() => button.click());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders the supplied avatar node without controlling its size", () => {
    const container = mount({
      avatar: <span data-testid="avatar-renderer">Medium avatar</span>,
    });

    expect(container.querySelector("[data-testid='avatar-renderer']")?.textContent).toBe(
      "Medium avatar",
    );
  });
});

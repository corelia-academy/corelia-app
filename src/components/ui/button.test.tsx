// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(ui: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  return {
    container,
    async render() {
      await act(async () => root.render(ui));
    },
    async unmount() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const hierarchyCases = [
  { variant: "cta", hierarchy: "primary", token: "bg-button-primary" },
  {
    variant: "cta",
    hierarchy: "secondary",
    token: "border-button-secondary-border",
  },
  {
    variant: "cta",
    hierarchy: "tertiary",
    token: "text-button-tertiary-foreground",
  },
  {
    variant: "destructive",
    hierarchy: "primary",
    token: "bg-button-destructive-primary",
  },
  {
    variant: "destructive",
    hierarchy: "secondary",
    token: "border-button-destructive-secondary-border",
  },
  {
    variant: "destructive",
    hierarchy: "tertiary",
    token: "text-button-destructive-tertiary-foreground",
  },
] as const;

describe("Button", () => {
  it("defaults to CTA primary medium", () => {
    const markup = renderToStaticMarkup(<Button>Save</Button>);

    expect(markup).toContain("bg-button-primary");
    expect(markup).toContain("h-10");
    expect(markup).toContain("Save");
  });

  it.each(hierarchyCases)(
    "uses semantic color tokens for $variant $hierarchy",
    ({ variant, hierarchy, token }) => {
      const markup = renderToStaticMarkup(
        <Button variant={variant} hierarchy={hierarchy}>
          Run action
        </Button>,
      );

      expect(markup).toContain(token);
    },
  );

  it.each([
    { size: "large", height: "h-12", iconSize: "size-12" },
    { size: "medium", height: "h-10", iconSize: "size-10" },
    { size: "small", height: "h-8", iconSize: "size-8" },
    { size: "xsmall", height: "h-6", iconSize: "size-6" },
  ] as const)("supports the $size label and icon-only dimensions", ({ size, height, iconSize }) => {
    const labeled = renderToStaticMarkup(<Button size={size}>Run action</Button>);
    const iconOnly = renderToStaticMarkup(
      <Button size={size} iconOnly aria-label="Add item">
        <span aria-hidden="true">+</span>
      </Button>,
    );

    expect(labeled).toContain(height);
    expect(iconOnly).toContain(iconSize);
    expect(iconOnly).toContain('aria-label="Add item"');
  });

  it.each([
    { size: "large", labelSize: "h-14", iconSize: "size-14" },
    { size: "medium", labelSize: "h-11", iconSize: "size-11" },
  ] as const)("supports floating $size buttons", ({ size, labelSize, iconSize }) => {
    const labeled = renderToStaticMarkup(
      <Button variant="floating" size={size}>
        Quick action
      </Button>,
    );
    const iconOnly = renderToStaticMarkup(
      <Button variant="floating" size={size} iconOnly aria-label="Open quick action">
        <span aria-hidden="true">+</span>
      </Button>,
    );

    expect(labeled).toContain("rounded-full");
    expect(labeled).toContain(labelSize);
    expect(iconOnly).toContain(iconSize);
    expect(iconOnly).toContain("shadow-button-floating-");
  });

  it("places optional leading and trailing icons around the label", () => {
    const markup = renderToStaticMarkup(
      <Button
        leadingIcon={<span>Leading icon</span>}
        trailingIcon={<span>Trailing icon</span>}
      >
        Button label
      </Button>,
    );

    const leadingIndex = markup.indexOf('data-icon="inline-start"');
    const labelIndex = markup.indexOf("Button label");
    const trailingIndex = markup.indexOf('data-icon="inline-end"');

    expect(leadingIndex).toBeGreaterThanOrEqual(0);
    expect(leadingIndex).toBeLessThan(labelIndex);
    expect(labelIndex).toBeLessThan(trailingIndex);
  });

  it.each([
    { variant: "cta", hierarchy: "secondary" },
    { variant: "cta", hierarchy: "tertiary" },
    { variant: "destructive", hierarchy: "secondary" },
    { variant: "destructive", hierarchy: "tertiary" },
  ] as const)("keeps the $variant $hierarchy disabled surface transparent", ({ variant, hierarchy }) => {
    const markup = renderToStaticMarkup(
      <Button variant={variant} hierarchy={hierarchy} disabled>
        Disabled action
      </Button>,
    );

    expect(markup).toContain("disabled:bg-transparent");
    expect(markup).toContain('disabled=""');
  });

  it("blocks click, keyboard, and focus behavior when disabled", async () => {
    const onClick = vi.fn();
    const onKeyDown = vi.fn();
    const view = mount(
      <Button disabled onClick={onClick} onKeyDown={onKeyDown}>
        Disabled action
      </Button>,
    );
    await view.render();

    const button = view.container.querySelector<HTMLButtonElement>("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button?.focus();
      button?.click();
      button?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      button?.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true }),
      );
    });

    expect(button?.disabled).toBe(true);
    expect(document.activeElement).not.toBe(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(onKeyDown).not.toHaveBeenCalled();

    await view.unmount();
  });

  it("composes with a form and submits through the native button type", async () => {
    const onSubmit = vi.fn();
    const view = mount(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <input type="email" aria-label="Email address" />
        <Button type="submit" trailingIcon={<span>→</span>}>
          Submit form
        </Button>
      </form>,
    );
    await view.render();

    const button = view.container.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    expect(view.container.querySelector('input[type="email"]')).not.toBeNull();
    expect(button).not.toBeNull();
    expect(view.container.querySelector('[data-icon="inline-end"]')).not.toBeNull();

    await act(async () => button?.click());

    expect(onSubmit).toHaveBeenCalledTimes(1);
    await view.unmount();
  });
});

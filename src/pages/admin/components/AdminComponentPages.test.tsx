// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}));

import AdminActionComponentPage from "./AdminActionComponentPage";
import AdminBadgeComponentPage from "./AdminBadgeComponentPage";
import AdminScrollbarComponentPage from "./AdminScrollbarComponentPage";
import AdminSelectionComponentPage from "./AdminSelectionComponentPage";
import AdminSeparatorComponentPage from "./AdminSeparatorComponentPage";
import AdminTagComponentPage from "./AdminTagComponentPage";
import AdminToggleComponentPage from "./AdminToggleComponentPage";

const pages = [
  AdminActionComponentPage,
  AdminBadgeComponentPage,
  AdminTagComponentPage,
  AdminSelectionComponentPage,
  AdminToggleComponentPage,
  AdminSeparatorComponentPage,
  AdminScrollbarComponentPage,
];

describe("admin component detail pages", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it.each(pages)("renders %s as an independent showcase page", async (Page) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <Page />
        </MemoryRouter>,
      );
    });

    expect(container.querySelector("h1")).not.toBeNull();
    expect(container.querySelectorAll('[data-slot="card"]').length).toBeGreaterThan(0);

    await act(async () => root.unmount());
    container.remove();
  });

  it("makes an enabled Action state active when clicked", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <AdminActionComponentPage />
        </MemoryRouter>,
      );
    });

    const defaultAction = container.querySelector<HTMLButtonElement>(
      '[data-testid="action-state-default-large-default"]',
    );
    expect(defaultAction).not.toBeNull();

    await act(async () => defaultAction?.click());

    expect(defaultAction?.getAttribute("data-active")).toBe("true");
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "default-large-default",
    );

    await act(async () => root.unmount());
    container.remove();
  });

  it("keeps Action state reference self-contained and interactive", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <AdminActionComponentPage />
        </MemoryRouter>,
      );
    });

    expect(container.querySelectorAll('[data-testid^="action-state-"]')).toHaveLength(16);

    const hoverAction = container.querySelector<HTMLButtonElement>(
      '[data-testid="action-state-default-large-hoverAsActive"]',
    );
    const disabledAction = container.querySelector<HTMLButtonElement>(
      '[data-testid="action-state-default-large-disabled"]',
    );
    const status = container.querySelector('[role="status"]');

    expect(hoverAction?.className).toContain("hover:bg-action-active");
    expect(container.querySelector('[data-testid="action-playground"]')).toBeNull();
    expect(status?.textContent).toContain("Active state: —");

    const smallAction = container.querySelector<HTMLButtonElement>(
      '[data-testid="action-state-default-small-default"]',
    );
    expect(smallAction?.textContent).toContain("Supporting information for this action");

    await act(async () => disabledAction?.click());
    expect(status?.textContent).toContain("Active state: —");

    await act(async () => smallAction?.click());
    expect(smallAction?.getAttribute("data-active")).toBe("true");
    expect(status?.textContent).toContain("default-small-default");

    await act(async () => root.unmount());
    container.remove();
  });

  it("keeps page matrices responsive and exposes expanded Toggle states", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <>
            <AdminBadgeComponentPage />
            <AdminTagComponentPage />
            <AdminToggleComponentPage />
          </>
        </MemoryRouter>,
      );
    });

    expect(container.innerHTML).not.toContain("min-w-[44rem]");
    expect(container.innerHTML).not.toContain("min-w-[42rem]");

    const toggleReference = container.querySelector(
      '[data-testid="toggle-variants-reference"]',
    );
    expect(toggleReference).not.toBeNull();
    expect(toggleReference?.className).toContain(
      "grid-cols-[auto_repeat(2,minmax(0,1fr))]",
    );
    expect(toggleReference?.querySelectorAll('[data-slot="toggle"]')).toHaveLength(16);
    expect(toggleReference?.querySelectorAll('[data-slot="toggle"][data-size="small"]')).toHaveLength(8);
    expect(toggleReference?.querySelectorAll('[data-slot="toggle"][data-size="large"]')).toHaveLength(8);
    expect(toggleReference?.textContent).not.toContain("Unchecked");
    expect(toggleReference?.textContent).not.toContain("Supporting toggle description");
    expect(toggleReference?.querySelectorAll('[data-slot="toggle-text"] [id$="-supporting-text"]')).toHaveLength(0);

    const toggleGroups = toggleReference?.querySelectorAll(
      '[data-testid^="toggle-group-"]',
    );
    expect(toggleGroups).toHaveLength(4);
    toggleGroups?.forEach((group) => {
      expect(group.className).toContain("rounded-lg");
      expect(group.className).toContain("border-border");
      expect(group.className).toContain("p-4");
    });

    const toggleSamples = toggleReference?.querySelectorAll(
      '[data-testid^="toggle-sample-"]',
    );
    expect(toggleSamples).toHaveLength(16);
    toggleSamples?.forEach((sample) => {
      expect(sample.className).toContain("p-3");
    });

    expect(container.querySelectorAll('[data-slot="toggle"]')).toHaveLength(16);
    expect(container.querySelectorAll('[data-slot="icon-toggle"]')).toHaveLength(4);

    expect(container.querySelectorAll('[data-testid^="toggle-state-"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-testid^="icon-toggle-group-"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-testid^="icon-toggle-sample-"]')).toHaveLength(4);

    const iconToggleState = (sampleId: string) =>
      container
        .querySelector(`[data-testid="${sampleId}"]`)
        ?.querySelector<HTMLElement>('[data-slot="icon-toggle"]')
        ?.getAttribute("aria-pressed");

    expect(iconToggleState("icon-toggle-sample-enabled-pressed")).toBe("true");
    expect(iconToggleState("icon-toggle-sample-enabled-unpressed")).toBe("false");
    expect(iconToggleState("icon-toggle-sample-disabled-unpressed")).toBe("false");
    expect(iconToggleState("icon-toggle-sample-disabled-pressed")).toBe("true");

    const enabledUnchecked = toggleReference?.querySelector<HTMLElement>(
      '[data-testid="toggle-small-enabled-default-unchecked"]',
    );
    await act(async () => enabledUnchecked?.closest("label")?.click());
    expect(enabledUnchecked?.getAttribute("aria-checked")).toBe("true");

    const disabledChecked = toggleReference?.querySelector<HTMLElement>(
      '[data-testid="toggle-small-disabled-default-checked"]',
    );
    await act(async () => disabledChecked?.closest("label")?.click());
    expect(disabledChecked?.getAttribute("aria-checked")).toBe("true");

    await act(async () => root.unmount());
    container.remove();
  });

  it("renders Badge as one Figma color row with icons on supported sizes", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <AdminBadgeComponentPage />
        </MemoryRouter>,
      );
    });

    expect(container.querySelectorAll('[data-testid^="badge-outline-color-row-"]')).toHaveLength(9);
    expect(container.querySelectorAll('[data-testid^="badge-filled-color-row-"]')).toHaveLength(9);
    expect(container.querySelector('[data-testid="badge-matrix"]')?.querySelectorAll('[data-slot="badge"]')).toHaveLength(72);
    expect(container.querySelector('[data-testid="badge-outline-color-row-primary"]')?.querySelectorAll("svg")).toHaveLength(6);
    expect(container.querySelector('[data-testid="badge-filled-color-row-primary"]')?.querySelectorAll("svg")).toHaveLength(6);

    await act(async () => root.unmount());
    container.remove();
  });

  it("renders Selection references without duplicate interactive samples", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <AdminSelectionComponentPage />
        </MemoryRouter>,
      );
    });

    expect(container.querySelectorAll('[data-testid^="selection-checkbox-state-"]')).toHaveLength(12);
    expect(container.querySelectorAll('[data-testid^="selection-checkbox-card-state-"]')).toHaveLength(12);
    expect(container.querySelectorAll('[data-testid^="selection-radio-state-"]')).toHaveLength(8);
    expect(container.querySelectorAll('[data-testid^="selection-radio-option-"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-testid^="selection-radio-card-state-"]')).toHaveLength(12);
    expect(container.querySelector('[data-testid="selection-checkbox-reference"]')?.textContent).toContain("Normal");
    expect(container.querySelector('[data-testid="selection-checkbox-reference"]')?.textContent).toContain("Indeterminate");
    expect(container.querySelector('[data-testid="selection-radio-reference"]')?.textContent).toContain("Free plan");
    expect(container.querySelector('[data-testid="selection-radio-reference"]')?.textContent).toContain("Pro plan");
    expect(container.querySelector('[data-testid="selection-radio-reference"]')?.textContent).toContain("Plus plan");
    expect(container.querySelector('[data-testid="selection-radio-reference"]')?.textContent).not.toContain("Indeterminate");
    expect(container.textContent).not.toContain("read-only");
    expect(container.textContent).not.toContain("Interactive playground");
    expect(container.innerHTML).not.toContain("min-w-[52rem]");
    expect(container.innerHTML).not.toContain("min-w-[72rem]");
    expect(container.querySelector('[data-testid="selection-checkbox-reference"]')?.className).toContain("grid-cols-4");
    expect(container.querySelector('[data-testid="selection-radio-reference"]')?.className).toContain("space-y-6");
    expect(container.querySelector('[data-testid="selection-radio-options"]')?.className).toContain("w-full");

    const getCheckboxControl = (state: string, row = "small") => container
      .querySelector<HTMLElement>(`[data-testid="selection-checkbox-state-${row}-${state}"]`)
      ?.querySelector<HTMLElement>('[role="checkbox"]');
    const normalCheckbox = getCheckboxControl("normal");
    const activeCheckbox = getCheckboxControl("active");
    const indeterminateCheckbox = getCheckboxControl("indeterminate");
    expect(normalCheckbox?.getAttribute("aria-checked")).toBe("false");
    expect(activeCheckbox?.getAttribute("aria-checked")).toBe("true");
    expect(indeterminateCheckbox?.getAttribute("aria-checked")).toBe("mixed");

    await act(async () => indeterminateCheckbox?.closest("label")?.click());
    expect(normalCheckbox?.getAttribute("aria-checked")).toBe("true");
    expect(activeCheckbox?.getAttribute("aria-checked")).toBe("true");
    expect(indeterminateCheckbox?.getAttribute("aria-checked")).toBe("true");
    expect(container.querySelector('[data-testid="selection-checkbox-reference"] + [role="status"]')?.textContent).toContain("Selected checkbox group: small");

    await act(async () => normalCheckbox?.closest("label")?.click());
    expect(normalCheckbox?.getAttribute("aria-checked")).toBe("false");
    expect(activeCheckbox?.getAttribute("aria-checked")).toBe("true");
    expect(indeterminateCheckbox?.getAttribute("aria-checked")).toBe("mixed");

    await act(async () => activeCheckbox?.closest("label")?.click());
    expect(normalCheckbox?.getAttribute("aria-checked")).toBe("false");
    expect(activeCheckbox?.getAttribute("aria-checked")).toBe("false");
    expect(indeterminateCheckbox?.getAttribute("aria-checked")).toBe("false");

    const disabledCheckboxCell = container.querySelector<HTMLElement>(
      '[data-testid="selection-checkbox-state-disabled-small-normal"]',
    );
    const disabledCheckbox = disabledCheckboxCell?.querySelector<HTMLElement>('[role="checkbox"]');
    expect(disabledCheckbox?.getAttribute("aria-checked")).toBe("false");
    await act(async () => disabledCheckbox?.closest("label")?.click());
    expect(disabledCheckbox?.getAttribute("aria-checked")).toBe("false");
    expect(getCheckboxControl("active", "disabled-small")?.getAttribute("aria-checked")).toBe("true");
    expect(getCheckboxControl("indeterminate", "disabled-small")?.getAttribute("aria-checked")).toBe("mixed");

    const getRadioMatrixControl = (cellId: string) => container
      .querySelector<HTMLElement>(`[data-testid="selection-radio-state-${cellId}"]`)
      ?.querySelector<HTMLElement>('[role="radio"]');
    expect(getRadioMatrixControl("small-normal")?.getAttribute("aria-checked")).toBe("false");
    expect(getRadioMatrixControl("small-active")?.getAttribute("aria-checked")).toBe("true");

    await act(async () => getRadioMatrixControl("small-active")?.closest("label")?.click());
    expect(getRadioMatrixControl("small-active")?.getAttribute("aria-checked")).toBe("false");
    expect(container.querySelector('[data-testid="selection-radio-matrix"] + [role="status"]')?.textContent).toContain("Cleared radio: small-active");

    const getRadioControl = (option: string) => container
      .querySelector<HTMLElement>(`[data-testid="selection-radio-option-${option}"]`)
      ?.querySelector<HTMLElement>('[role="radio"]');
    const proPlan = getRadioControl("pro");
    expect(proPlan?.getAttribute("aria-checked")).toBe("true");
    expect(getRadioControl("free")?.getAttribute("aria-checked")).toBe("false");
    expect(getRadioControl("plus")?.getAttribute("aria-checked")).toBe("false");

    await act(async () => getRadioControl("plus")?.closest("label")?.click());
    expect(proPlan?.getAttribute("aria-checked")).toBe("false");
    expect(getRadioControl("plus")?.getAttribute("aria-checked")).toBe("true");
    expect(container.querySelector('[data-testid="selection-radio-options"] + [role="status"]')?.textContent).toContain("Selected plan: plus");

    await act(async () => getRadioControl("plus")?.closest("label")?.click());
    expect(getRadioControl("plus")?.getAttribute("aria-checked")).toBe("true");

    const checkboxCard = container.querySelector<HTMLElement>('[data-testid="selection-checkbox-card-state-horizontal-small-default"]');
    const checkboxCardControl = checkboxCard?.querySelector<HTMLElement>('[role="checkbox"]');
    expect(checkboxCardControl?.getAttribute("aria-checked")).toBe("false");

    await act(async () => checkboxCard?.querySelector<HTMLElement>('[data-slot="select-card"]')?.click());
    expect(checkboxCardControl?.getAttribute("aria-checked")).toBe("true");

    const disabledCheckboxCard = container.querySelector<HTMLElement>('[data-testid="selection-checkbox-card-state-horizontal-small-disabled"]');
    const disabledCheckboxCardControl = disabledCheckboxCard?.querySelector<HTMLElement>('[role="checkbox"]');
    expect(disabledCheckboxCardControl?.getAttribute("aria-checked")).toBe("false");

    await act(async () => disabledCheckboxCard?.querySelector<HTMLElement>('[data-slot="select-card"]')?.click());
    expect(disabledCheckboxCardControl?.getAttribute("aria-checked")).toBe("false");

    const getRadioCardControl = () => container
      .querySelector<HTMLElement>('[data-testid="selection-radio-card-state-horizontal-small-selected"]')
      ?.querySelector<HTMLElement>('[role="radio"]');
    const radioCardDefault = container.querySelector<HTMLElement>('[data-testid="selection-radio-card-state-horizontal-small-default"]');
    const radioCardControl = getRadioCardControl();
    expect(radioCardControl?.getAttribute("aria-checked")).toBe("true");

    await act(async () => radioCardDefault?.querySelector<HTMLElement>('[data-slot="select-card"]')?.click());
    expect(getRadioCardControl()?.getAttribute("aria-checked")).toBe("false");
    expect(radioCardDefault?.querySelector<HTMLElement>('[role="radio"]')?.getAttribute("aria-checked")).toBe("true");

    await act(async () => radioCardDefault?.querySelector<HTMLElement>('[data-slot="select-card"]')?.click());
    expect(radioCardDefault?.querySelector<HTMLElement>('[role="radio"]')?.getAttribute("aria-checked")).toBe("false");

    const disabledRadioCard = container.querySelector<HTMLElement>('[data-testid="selection-radio-card-state-horizontal-small-disabled"]');
    expect(disabledRadioCard?.querySelector<HTMLElement>('[role="radio"]')?.getAttribute("aria-checked")).toBe("false");

    await act(async () => disabledRadioCard?.querySelector<HTMLElement>('[data-slot="select-card"]')?.click());
    expect(disabledRadioCard?.querySelector<HTMLElement>('[role="radio"]')?.getAttribute("aria-checked")).toBe("false");

    await act(async () => root.unmount());
    container.remove();
  });
});

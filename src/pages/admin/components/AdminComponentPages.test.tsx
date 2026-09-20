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
import AdminDropdownMenuComponentPage from "./AdminDropdownMenuComponentPage";
import AdminScrollbarComponentPage from "./AdminScrollbarComponentPage";
import AdminSelectionComponentPage from "./AdminSelectionComponentPage";
import AdminSeparatorComponentPage from "./AdminSeparatorComponentPage";
import AdminTagComponentPage from "./AdminTagComponentPage";
import AdminTabsComponentPage from "./AdminTabsComponentPage";
import AdminToggleComponentPage from "./AdminToggleComponentPage";

const pages = [
  AdminActionComponentPage,
  AdminBadgeComponentPage,
  AdminTagComponentPage,
  AdminSelectionComponentPage,
  AdminToggleComponentPage,
  AdminSeparatorComponentPage,
  AdminScrollbarComponentPage,
  AdminTabsComponentPage,
  AdminDropdownMenuComponentPage,
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
    expect(container.querySelectorAll('[data-testid^="selection-checkbox-card-state-"]')).toHaveLength(16);
    expect(container.querySelectorAll('[data-testid^="selection-radio-state-"]')).toHaveLength(8);
    expect(container.querySelectorAll('[data-testid^="selection-radio-option-"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-testid^="selection-radio-card-state-"]')).toHaveLength(16);
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

    const disabledCheckboxCard = container.querySelector<HTMLElement>('[data-testid="selection-checkbox-card-state-horizontal-small-disabled-default"]');
    const disabledCheckboxCardControl = disabledCheckboxCard?.querySelector<HTMLElement>('[role="checkbox"]');
    expect(disabledCheckboxCardControl?.getAttribute("aria-checked")).toBe("false");

    await act(async () => disabledCheckboxCard?.querySelector<HTMLElement>('[data-slot="select-card"]')?.click());
    expect(disabledCheckboxCardControl?.getAttribute("aria-checked")).toBe("false");

    const disabledSelectedCheckboxCard = container.querySelector<HTMLElement>('[data-testid="selection-checkbox-card-state-horizontal-small-disabled-selected"]');
    expect(disabledSelectedCheckboxCard?.querySelector<HTMLElement>('[role="checkbox"]')?.getAttribute("aria-checked")).toBe("true");

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

    const disabledRadioCard = container.querySelector<HTMLElement>('[data-testid="selection-radio-card-state-horizontal-small-disabled-default"]');
    expect(disabledRadioCard?.querySelector<HTMLElement>('[role="radio"]')?.getAttribute("aria-checked")).toBe("false");

    await act(async () => disabledRadioCard?.querySelector<HTMLElement>('[data-slot="select-card"]')?.click());
    expect(disabledRadioCard?.querySelector<HTMLElement>('[role="radio"]')?.getAttribute("aria-checked")).toBe("false");

    const disabledSelectedRadioCard = container.querySelector<HTMLElement>('[data-testid="selection-radio-card-state-horizontal-small-disabled-selected"]');
    expect(disabledSelectedRadioCard?.querySelector<HTMLElement>('[role="radio"]')?.getAttribute("aria-checked")).toBe("true");

    await act(async () => root.unmount());
    container.remove();
  });

  it("keeps the Tabs showcase interactive and controlled", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <AdminTabsComponentPage />
        </MemoryRouter>,
      );
    });

    expect(container.querySelectorAll('[data-testid^="tabs-standalone-level-"]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-testid^="tabs-grouped-level-"]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-slot="tabs-group"]')).toHaveLength(9);
    expect(container.querySelectorAll('[data-testid$="-status"]')).toHaveLength(0);
    expect(container.querySelector('[data-testid="tabs-standalone-1-vertical"]')).toBeNull();
    expect(container.querySelector('[data-testid="tabs-standalone-2a-vertical"]')).toBeNull();
    expect(container.querySelector('[data-testid="tabs-grouped-2a-vertical"]')).toBeNull();
    expect(container.querySelector('[data-testid="tabs-standalone-2b-horizontal-keyboard"]')).toBeNull();
    expect(container.querySelector('[data-testid="tabs-grouped-2b-horizontal-keyboard"]')).toBeNull();
    expect(container.textContent).not.toContain("Controlled and keyboard behavior");

    const standalone2a = container.querySelector<HTMLElement>(
      '[data-testid="tabs-standalone-level-2a"]',
    );
    const standalone2b = container.querySelector<HTMLElement>(
      '[data-testid="tabs-standalone-level-2b"]',
    );
    const standalone3a = container.querySelector<HTMLElement>(
      '[data-testid="tabs-standalone-level-3a"]',
    );
    const standalone3b = container.querySelector<HTMLElement>(
      '[data-testid="tabs-standalone-level-3b"]',
    );

    expect(standalone2a?.parentElement?.className).toContain("xl:grid-cols-2");
    expect(standalone2a?.nextElementSibling).toBe(standalone2b);
    expect(standalone3a?.parentElement?.className).toContain("xl:grid-cols-2");
    expect(standalone3a?.nextElementSibling).toBe(standalone3b);

    const example = container.querySelector<HTMLElement>(
      '[data-testid="tabs-standalone-2b-horizontal"]',
    );
    const activityTab = example?.querySelector<HTMLButtonElement>(
      '[data-testid="tabs-standalone-2b-horizontal-tab-activity"]',
    );
    const settingsTab = example?.querySelector<HTMLButtonElement>(
      '[data-testid="tabs-standalone-2b-horizontal-tab-settings"]',
    );
    const overviewPanel = example?.querySelector<HTMLElement>(
      '[data-testid="tabs-standalone-2b-horizontal-panel-overview"]',
    );
    const activityPanel = example?.querySelector<HTMLElement>(
      '[data-testid="tabs-standalone-2b-horizontal-panel-activity"]',
    );

    expect(activityTab).not.toBeNull();
    expect(example?.querySelector('[data-slot="tabs-group"]')).toBeNull();
    expect(example?.querySelector('[data-slot="tabs-list"]')?.getAttribute("data-level")).toBe("2b");
    expect(settingsTab?.getAttribute("aria-disabled")).toBe("true");
    expect(overviewPanel?.hidden).toBe(false);
    expect(activityPanel?.hidden).toBe(true);

    await act(async () => activityTab?.click());

    expect(activityTab?.getAttribute("aria-selected")).toBe("true");
    expect(overviewPanel?.hidden).toBe(true);
    expect(activityPanel?.hidden).toBe(false);

    const groupedExample = container.querySelector<HTMLElement>(
      '[data-testid="tabs-grouped-2b-horizontal"]',
    );
    expect(groupedExample?.querySelector('[data-slot="tabs-group"]')).not.toBeNull();
    expect(groupedExample?.querySelector('[data-slot="tabs-list"]')?.getAttribute("data-level")).toBe("2b");

    await act(async () => settingsTab?.click());

    expect(activityTab?.getAttribute("aria-selected")).toBe("true");

    await act(async () => root.unmount());
    container.remove();
  });

  it("exposes the Dropdown Menu Base Items and six Figma-matched use cases", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <AdminDropdownMenuComponentPage />
        </MemoryRouter>,
      );
    });

    const baseItems = container.querySelector<HTMLElement>(
      '[data-testid="dropdown-menu-base-items"]',
    );
    const useCasesContainer = container.querySelector<HTMLElement>(
      '[data-testid="dropdown-menu-use-cases"]',
    );

    expect(baseItems).not.toBeNull();
    expect(baseItems?.querySelectorAll('[data-slot="dropdown-menu-trigger"]')).toHaveLength(2);
    expect(useCasesContainer).not.toBeNull();
    expect(useCasesContainer?.querySelectorAll('[data-slot="dropdown-menu-trigger"]')).toHaveLength(6);
    expect(document.body.querySelector('[data-layout="multiple-list"]')).toBeNull();

    const noLeadingTrigger = container.querySelector<HTMLButtonElement>(
      '[data-testid="dropdown-menu-base-items-no-leading-trigger"]',
    );
    expect(noLeadingTrigger).not.toBeNull();

    await act(async () => noLeadingTrigger?.click());

    expect(document.body.querySelector('input[aria-label="Search Leading icon = No"]')).not.toBeNull();
    expect(document.body.querySelectorAll('[data-testid^="dropdown-menu-base-item-no-leading-"]')).toHaveLength(10);
    expect(document.body.querySelector('[data-testid="dropdown-menu-base-item-no-leading-warning-default"]')).not.toBeNull();

    const warningDefaultRow = document.body.querySelector<HTMLElement>(
      '[data-testid="dropdown-menu-base-item-no-leading-warning-default"]',
    );
    expect(warningDefaultRow?.getAttribute("aria-checked")).toBe("false");
    expect(warningDefaultRow?.className).not.toContain("ring-2 ring-dropdown-focus");

    await act(async () => warningDefaultRow?.click());

    expect(warningDefaultRow?.getAttribute("aria-checked")).toBe("true");

    const disabledBaseRow = document.body.querySelector<HTMLElement>(
      '[data-testid="dropdown-menu-base-item-no-leading-warning-disabled"]',
    );
    expect(disabledBaseRow?.hasAttribute("data-disabled")).toBe(true);
    expect(disabledBaseRow?.className).toContain("data-disabled:cursor-not-allowed");

    const hoverBaseRow = document.body.querySelector<HTMLElement>(
      '[data-testid="dropdown-menu-base-item-no-leading-default-hover"]',
    );
    const focusBaseRow = document.body.querySelector<HTMLElement>(
      '[data-testid="dropdown-menu-base-item-no-leading-default-focus"]',
    );
    expect(hoverBaseRow?.classList.contains("bg-dropdown-hover")).toBe(false);
    expect(hoverBaseRow?.classList.contains("ring-2")).toBe(false);
    expect(focusBaseRow?.classList.contains("ring-2")).toBe(false);
    expect(focusBaseRow?.getAttribute("data-preview-state")).toBe("focus");

    await act(async () => noLeadingTrigger?.click());

    const leadingTrigger = container.querySelector<HTMLButtonElement>(
      '[data-testid="dropdown-menu-base-items-leading-trigger"]',
    );
    await act(async () => leadingTrigger?.click());
    expect(document.body.querySelector('input[aria-label="Search Leading icon = Yes"]')).not.toBeNull();
    expect(document.body.querySelectorAll('[data-testid^="dropdown-menu-base-item-leading-"]')).toHaveLength(10);
    await act(async () => leadingTrigger?.click());

    const useCases = [
      { id: "common-use", label: "Common use", rowCount: 5 },
      { id: "include-select-all", label: "Include Select All", rowCount: 5 },
      {
        id: "many-single-list",
        label: "Dropdown with many single list",
        rowCount: 5,
      },
      {
        id: "many-sub-list",
        label: "Dropdown with many sub-list",
        rowCount: 5,
      },
      {
        id: "people-assignee",
        label: "Dropdown list type: people/assignee",
        rowCount: 5,
      },
      { id: "warning-case", label: "Warning case", rowCount: 5 },
    ];

    for (const { id: useCaseId, label, rowCount } of useCases) {
      const trigger = container.querySelector<HTMLButtonElement>(
        `[data-testid="dropdown-menu-use-case-${useCaseId}-trigger"]`,
      );
      expect(trigger).not.toBeNull();

      await act(async () => trigger?.click());

      expect(
        document.body.querySelector(`input[aria-label="Search ${label}"]`),
      ).not.toBeNull();

      const rows = document.body.querySelectorAll(
        `[data-testid^="dropdown-menu-use-case-row-${useCaseId}-"]`,
      );
      expect(rows, `rows for ${useCaseId}`).toHaveLength(rowCount);

      if (useCaseId === "include-select-all") {
        const selectAll = document.body.querySelector<HTMLElement>(
          '[data-testid="dropdown-menu-use-case-include-select-all-select-all"]',
        );

        expect(selectAll).not.toBeNull();
        expect(selectAll?.parentElement?.textContent).toContain("Select All");
        expect(selectAll?.hasAttribute("data-indeterminate")).toBe(true);
      }

      if (useCaseId === "common-use") {
        expect(
          document.body.querySelector(
            '[data-testid="dropdown-menu-use-case-row-common-use-discover"] [data-slot="dropdown-menu-item-supporting"]',
          ),
        ).toBeNull();
        expect(
          document.body.querySelector(
            '[data-testid^="dropdown-menu-caret-icon-"]',
          ),
        ).toBeNull();

        expect(
          document.body
            .querySelector<HTMLElement>(
              '[data-testid="dropdown-menu-use-case-row-common-use-discover"]',
            )
            ?.getAttribute("aria-checked"),
        ).toBe("true");
        expect(
          document.body
            .querySelector<HTMLElement>(
              '[data-testid="dropdown-menu-use-case-row-common-use-discover"]',
            )
            ?.getAttribute("data-card-action"),
        ).toBe("checkbox");
        expect(
          document.body
            .querySelector<HTMLElement>(
              '[data-testid="dropdown-menu-use-case-row-common-use-participate"]',
            )
            ?.getAttribute("aria-checked"),
        ).toBe("false");
      }

      if (useCaseId === "many-single-list") {
        expect(
          document.body.querySelectorAll(
            '[data-slot="dropdown-menu-item-supporting"]',
          ),
        ).toHaveLength(5);
        expect(
          document.body.querySelector(
            '[data-testid^="dropdown-menu-caret-icon-"]',
          ),
        ).toBeNull();
      }

      if (useCaseId === "many-sub-list") {
        const parentRow = document.body.querySelector<HTMLElement>(
          '[data-testid="dropdown-menu-use-case-row-many-sub-list-discover"]',
        );
        const caret = document.body.querySelector<HTMLButtonElement>(
          '[data-testid="dropdown-menu-caret-icon-discover"]',
        );

        expect(
          document.body.querySelectorAll('[data-depth="1"]'),
        ).toHaveLength(2);
        expect(parentRow?.hasAttribute("data-indeterminate")).toBe(true);
        expect(caret?.getAttribute("aria-expanded")).toBe("true");
        expect(parentRow?.getAttribute("data-card-action")).toBe("caret");
        expect(parentRow?.getAttribute("data-selection-mode")).toBe("checkbox-only");
        expect(
          parentRow?.querySelector('[data-slot="dropdown-menu-item-trailing-icon"]')?.getAttribute("data-hit-area"),
        ).toBe("control");
        expect(caret?.className).toContain("justify-end");

        const parentTitle = parentRow?.querySelector<HTMLElement>(
          '[data-slot="dropdown-menu-item-title"]',
        );
        const parentIndicator = parentRow?.querySelector<HTMLElement>(
          '[data-slot="dropdown-menu-checkbox-item-indicator"]',
        );

        await act(async () => {
          parentTitle?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
          parentTitle?.click();
        });
        expect(document.body.querySelectorAll('[data-depth="1"]')).toHaveLength(0);
        expect(caret?.getAttribute("aria-expanded")).toBe("false");
        expect(parentRow?.getAttribute("aria-checked")).toBe("mixed");

        await act(async () => {
          parentTitle?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
          parentTitle?.click();
        });
        expect(document.body.querySelectorAll('[data-depth="1"]')).toHaveLength(2);
        expect(caret?.getAttribute("aria-expanded")).toBe("true");

        await act(async () => {
          parentIndicator?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
          parentIndicator?.click();
        });
        expect(parentRow?.getAttribute("aria-checked")).toBe("true");

        await act(async () => caret?.click());
        expect(document.body.querySelectorAll('[data-depth="1"]')).toHaveLength(0);
        expect(caret?.getAttribute("aria-expanded")).toBe("false");

        await act(async () => caret?.click());
        expect(document.body.querySelectorAll('[data-depth="1"]')).toHaveLength(2);
      }

      if (useCaseId === "people-assignee") {
        expect(
          document.body.querySelectorAll('[data-testid^="dropdown-menu-user-icon-"]'),
        ).toHaveLength(5);
        expect(document.body.querySelector('[data-slot="dropdown-menu-item-badge"]')).toBeNull();
      }

      if (useCaseId === "warning-case") {
        expect(
          document.body.querySelectorAll('[data-testid^="dropdown-menu-warning-icon-"]'),
        ).toHaveLength(1);
        expect(
          document.body.querySelector(
            '[data-testid="dropdown-menu-use-case-row-warning-case-ui-ux"][data-variant="warning"]',
          ),
        ).not.toBeNull();
        expect(
          document.body.querySelector('[data-testid^="dropdown-menu-caret-icon-"]'),
        ).toBeNull();
      }

      await act(async () => trigger?.click());
    }

    await act(async () => root.unmount());
    container.remove();
  });
});

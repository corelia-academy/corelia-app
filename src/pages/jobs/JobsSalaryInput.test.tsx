// @vitest-environment happy-dom
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "vi", resolvedLanguage: "vi" },
  }),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}));

vi.mock("@/lib/jobs", () => ({
  setUserJobState: vi.fn(),
}));

vi.mock("@/stores/authStore", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/hooks/usePageMeta", () => ({
  usePageMeta: vi.fn(),
}));

vi.mock("@/features/jobs/jobQueries", () => ({
  jobKeys: { all: ["jobs"] },
  jobsInfiniteCatalogQueryOptions: () => ({
    queryKey: ["jobs", "catalog"],
    queryFn: async () => ({ items: [], total: 0, hiddenCount: 0 }),
    initialPageParam: 1,
    getNextPageParam: () => undefined,
  }),
  jobTaxonomyQueryOptions: () => ({
    queryKey: ["jobs", "taxonomy"],
    queryFn: async () => ({ roles: [], domains: [], skills: [] }),
  }),
}));

import JobsPage from "./JobsPage";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="search-params">{location.search}</div>;
}

function renderJobsPage(initialEntry: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route
              path="/jobs"
              element={
                <>
                  <JobsPage />
                  <LocationProbe />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });

  return {
    container,
    async cleanup() {
      await act(async () => root.unmount());
      queryClient.clear();
      container.remove();
    },
  };
}

describe("JobsPage salary filter IME & URL synchronization", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("limits the salary currency divider highlight to visible focus or an open menu", async () => {
    const view = renderJobsPage("/jobs?currency=USD");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const currencyTrigger = view.container.querySelector<HTMLButtonElement>(
      'button[aria-label="filters.salaryCurrency"]',
    );
    const divider = currencyTrigger?.parentElement;

    expect(divider?.className).not.toContain(
      "group-focus-within/input-field:border-input-field-divider-focus",
    );
    expect(divider?.className).toContain(
      "group-has-[:focus-visible]/input-field:border-input-field-divider-focus",
    );
    expect(divider?.className).toContain(
      "group-has-[[data-popup-open]]/input-field:border-input-field-divider-focus",
    );

    await view.cleanup();
  });

  it("preserves 0 as a valid salary value from URL parameter", async () => {
    const view = renderJobsPage("/jobs?currency=VND&salary=0");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const salaryInput = view.container.querySelector<HTMLInputElement>(
      'input[aria-label="filters.minimumSalary"]',
    );
    expect(salaryInput).not.toBeNull();
    expect(salaryInput?.value).toBe("0");

    await view.cleanup();
  });

  it("does not commit to URL while IME composition is active", async () => {
    const view = renderJobsPage("/jobs?currency=USD");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const salaryInput = view.container.querySelector<HTMLInputElement>(
      'input[aria-label="filters.minimumSalary"]',
    );
    expect(salaryInput).not.toBeNull();

    // Start composition (e.g. Vietnamese IME typing '1000')
    act(() => {
      salaryInput?.dispatchEvent(new Event("compositionstart", { bubbles: true }));
      salaryInput!.value = "100";
      salaryInput?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const probe = view.container.querySelector('[data-testid="search-params"]');
    // While composing, URL should NOT have salary committed yet
    expect(probe?.textContent).toBe("?currency=USD");

    // End composition
    act(() => {
      salaryInput!.value = "1000";
      salaryInput?.dispatchEvent(
        new CompositionEvent("compositionend", { bubbles: true, data: "1000" }),
      );
    });

    expect(probe?.textContent).toContain("salary=1000");

    await view.cleanup();
  });

  it("commits salary draft on Blur", async () => {
    const view = renderJobsPage("/jobs?currency=USD");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const salaryInput = view.container.querySelector<HTMLInputElement>(
      'input[aria-label="filters.minimumSalary"]',
    );

    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      nativeSetter?.call(salaryInput, "2500");
      salaryInput?.dispatchEvent(new Event("input", { bubbles: true }));
      salaryInput?.dispatchEvent(new Event("change", { bubbles: true }));
      salaryInput?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      salaryInput?.dispatchEvent(new FocusEvent("blur", { bubbles: false }));
    });

    const probe = view.container.querySelector('[data-testid="search-params"]');
    expect(probe?.textContent).toContain("salary=2500");

    await view.cleanup();
  });
});

describe("JobsPage primary filter popup width", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("fits the three primary filter menus to content while keeping other filters anchored", async () => {
    const primaryFilterLabels = [
      "filters.jobType",
      "filters.role",
      "filters.workMode",
    ];

    for (const label of primaryFilterLabels) {
      const view = renderJobsPage("/jobs?days=7");
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const trigger = view.container.querySelector<HTMLButtonElement>(
        `button[aria-label="${label}"]`,
      );
      expect(trigger).not.toBeNull();

      await act(async () => {
        trigger?.click();
      });

      const menu = document.querySelector<HTMLElement>(
        '[data-slot="dropdown-menu-content"][data-layout="multiple-list"][data-open]',
      );
      expect(menu?.className).toContain("w-max");
      expect(menu?.className).toContain("min-w-(--anchor-width)");

      await view.cleanup();
    }

    const view = renderJobsPage("/jobs?days=7");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const additionalFilterTrigger = view.container.querySelector<HTMLButtonElement>(
      'button[aria-label="filters.postedDate"]',
    );
    expect(additionalFilterTrigger).not.toBeNull();

    await act(async () => {
      additionalFilterTrigger?.click();
    });

    const additionalFilterMenu = document.querySelector<HTMLElement>(
      '[data-slot="dropdown-menu-content"][data-layout="multiple-list"][data-open]',
    );
    expect(additionalFilterMenu?.className).toContain("w-(--anchor-width)");
    expect(additionalFilterMenu?.className).not.toContain("w-max");

    await view.cleanup();
  });
});

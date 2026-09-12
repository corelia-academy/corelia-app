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

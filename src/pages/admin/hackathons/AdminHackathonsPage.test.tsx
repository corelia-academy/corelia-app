// @vitest-environment happy-dom
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Contest } from "@/types/hackathons";
import AdminHackathonsPage from "./AdminHackathonsPage";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
  locale: "en",
  items: [] as Contest[],
}));

vi.mock("@/stores/authStore", () => ({
  useAuth: () => ({ user: { id: "admin-1" } }),
}));

vi.mock("@/features/hackathons/hackathonQueries", () => ({
  hackathonCatalogQueryOptions: () => ({
    queryKey: ["admin", "hackathons-test"],
    queryFn: async () => state.items,
  }),
}));

const translations: Record<string, Record<string, string>> = {
  en: {
    "hackathons.title": "Hackathons",
    "hackathons.description": "Create and manage public hackathon pages.",
    "hackathons.new": "New hackathon",
    "hackathons.edit": "Edit",
    "hackathons.view": "View public",
    "hackathons.preview": "Preview",
    "hackathons.loading": "Loading hackathons…",
    "hackathons.empty": "No hackathons yet.",
    "hackathons.editor.status.draft": "Draft",
    "hackathons.editor.status.published": "Published",
    "hackathons.editor.status.running": "Running",
    "hackathons.editor.status.ended": "Ended",
    "hackathons.editor.modes.online": "Online",
    "hackathons.editor.modes.offline": "Offline",
    "hackathons.editor.modes.hybrid": "Hybrid",
  },
  vi: {
    "hackathons.title": "Hackathons",
    "hackathons.description": "Tạo và quản lý các trang hackathon công khai.",
    "hackathons.new": "Tạo hackathon mới",
    "hackathons.edit": "Chỉnh sửa",
    "hackathons.view": "Xem trang công khai",
    "hackathons.preview": "Xem trước",
    "hackathons.loading": "Đang tải danh sách hackathon…",
    "hackathons.empty": "Chưa có hackathon nào.",
    "hackathons.editor.status.draft": "Bản nháp",
    "hackathons.editor.status.published": "Đã xuất bản",
    "hackathons.editor.status.running": "Đang diễn ra",
    "hackathons.editor.status.ended": "Đã kết thúc",
    "hackathons.editor.modes.online": "Trực tuyến",
    "hackathons.editor.modes.offline": "Trực tiếp",
    "hackathons.editor.modes.hybrid": "Kết hợp",
  },
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const active = translations[state.locale] || translations.en;
      return active[key] ?? options?.defaultValue ?? key;
    },
    i18n: {
      language: state.locale,
      resolvedLanguage: state.locale,
    },
  }),
}));

describe("AdminHackathonsPage localization", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    state.locale = "en";
    state.items = [];
  });

  afterEach(() => {
    container.remove();
  });

  async function settle() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
    }
  }

  async function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AdminHackathonsPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    await settle();

    return {
      container,
      cleanup: async () => {
        await act(async () => {
          root.unmount();
        });
        queryClient.clear();
      },
    };
  }

  it("renders localized status and mode labels in English", async () => {
    state.locale = "en";
    state.items = [
      {
        id: "h-1",
        title: "QA 356",
        slug: "qa-356",
        status: "published",
        mode: "hybrid",
        participants_count: 5,
        tagline: "Test hackathon",
      } as unknown as Contest,
    ];

    const view = await renderPage();
    expect(view.container.textContent).toContain("Published");
    expect(view.container.textContent).toContain("Hybrid");
    expect(view.container.textContent).not.toContain("published");
    expect(view.container.textContent).not.toContain("hybrid");

    await view.cleanup();
  });

  it("renders localized status and mode labels in Vietnamese", async () => {
    state.locale = "vi";
    state.items = [
      {
        id: "h-1",
        title: "QA 356",
        slug: "qa-356",
        status: "published",
        mode: "hybrid",
        participants_count: 5,
        tagline: "Test hackathon",
      } as unknown as Contest,
    ];

    const view = await renderPage();
    expect(view.container.textContent).toContain("Đã xuất bản");
    expect(view.container.textContent).toContain("Kết hợp");
    expect(view.container.textContent).not.toContain("published");
    expect(view.container.textContent).not.toContain("hybrid");

    await view.cleanup();
  });

  it("falls back safely for unknown status and mode", async () => {
    state.locale = "en";
    state.items = [
      {
        id: "h-2",
        title: "Unknown States",
        slug: "unknown-states",
        status: "custom_status",
        mode: "metaverse",
        participants_count: 0,
        tagline: "",
      } as unknown as Contest,
    ];

    const view = await renderPage();
    expect(view.container.textContent).toContain("custom_status");
    expect(view.container.textContent).toContain("metaverse");

    await view.cleanup();
  });
});

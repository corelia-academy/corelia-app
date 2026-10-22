// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { setProjectSavedMock } = vi.hoisted(() => ({
  setProjectSavedMock: vi.fn(),
}));

vi.mock("@/lib/projectSaves", () => ({ setProjectSaved: setProjectSavedMock }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { ProjectSaveBlock } from "./ProjectSaveBlock";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

describe("ProjectSaveBlock", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
  });

  async function renderSaveBlock() {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ProjectSaveBlock
            projectId="project-1"
            saved={false}
            saveStateReady
            saveCount={1}
          />
        </QueryClientProvider>,
      );
    });
  }

  it("ignores repeated clicks while saving and keeps the count stable", async () => {
    const pendingSave = deferred<{ saved: boolean; changed: boolean }>();
    setProjectSavedMock.mockReturnValue(pendingSave.promise);

    await renderSaveBlock();
    const bookmark = container.querySelector('[role="button"]') as SVGElement;

    for (let index = 0; index < 10; index += 1) {
      await act(async () => {
        bookmark.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    }

    expect(setProjectSavedMock).toHaveBeenCalledTimes(1);
    expect(bookmark.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector(".tabular-nums")?.textContent).toBe("2");

    await act(async () => {
      pendingSave.resolve({ saved: true, changed: true });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(setProjectSavedMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="button"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector(".tabular-nums")?.textContent).toBe("2");
  });
});

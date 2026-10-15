// @vitest-environment happy-dom
// @ts-expect-error - React 19 test environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

const i18nMock = vi.hoisted(() => ({
  language: "vi",
  resolvedLanguage: "vi",
  changeLanguage: vi.fn(async (lng: string) => {
    i18nMock.language = lng;
    i18nMock.resolvedLanguage = lng;
  }),
}));

vi.mock("@/i18n", () => ({
  default: i18nMock,
  DEFAULT_LANGUAGE: "vi",
  SUPPORTED_LANGUAGES: ["vi", "en"],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: i18nMock, t: (k: string) => k }),
}));

const authUser = vi.hoisted(() => ({
  current: { id: "user-test-1", email: "user@example.com" } as unknown,
}));

vi.mock("@/stores/authStore", () => ({
  useAuth: () => ({
    user: authUser.current,
    profile: { id: "user-test-1", locale: "vi" },
    refreshProfile: vi.fn(async () => {}),
  }),
}));

const updateProfileForUserMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/profile", () => ({
  updateProfileForUser: updateProfileForUserMock,
}));

import { useLocale } from "./useLocale";
import { currentProfileQueryOptions } from "@/features/auth/profileQueries";
import { resetManualLocaleGuard, isAuthSyncLocaleIgnored } from "@/lib/localeSyncGuard";
import type { User } from "@supabase/supabase-js";
import type { SupportedLanguage } from "@/i18n";
import type { Profile } from "@/types/database";

function TestComponent({
  onHook,
}: {
  onHook: (val: ReturnType<typeof useLocale>) => void;
}) {
  const val = useLocale();
  React.useEffect(() => {
    onHook(val);
  }, [onHook, val]);
  return null;
}

describe("useLocale hook with revision guard and rollback", () => {
  let queryClient: QueryClient;
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let hookValue: ReturnType<typeof useLocale> | null = null;

  beforeEach(() => {
    resetManualLocaleGuard();
    vi.clearAllMocks();
    hookValue = null;
    i18nMock.language = "vi";
    i18nMock.resolvedLanguage = "vi";
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(
      currentProfileQueryOptions(authUser.current as User).queryKey,
      { id: "user-test-1", locale: "vi" } as unknown as Profile,
    );

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  async function renderTestHook() {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestComponent
            onHook={(val) => {
              hookValue = val;
            }}
          />
        </QueryClientProvider>,
      );
    });
  }

  it("updates optimistic cache and persists when mutation succeeds", async () => {
    updateProfileForUserMock.mockResolvedValueOnce({});
    await renderTestHook();

    await act(async () => {
      await hookValue?.setLanguage("en" as SupportedLanguage);
    });

    expect(i18nMock.changeLanguage).toHaveBeenCalledWith("en");
    const cached = queryClient.getQueryData<{ locale: string }>(
      currentProfileQueryOptions(authUser.current as User).queryKey,
    );
    expect(cached?.locale).toBe("en");
    expect(isAuthSyncLocaleIgnored("vi")).toBe(true);
    expect(isAuthSyncLocaleIgnored("en")).toBe(false);

    await act(async () => root.unmount());
    container.remove();
  });

  it("rolls back optimistic cache and i18n when mutation fails", async () => {
    updateProfileForUserMock.mockRejectedValueOnce(new Error("Network error"));
    await renderTestHook();

    await act(async () => {
      await expect(
        hookValue?.setLanguage("en" as SupportedLanguage),
      ).rejects.toThrow("Network error");
    });

    // Should have rolled back to 'vi'
    expect(i18nMock.changeLanguage).toHaveBeenLastCalledWith("vi");
    const cached = queryClient.getQueryData<{ locale: string }>(
      currentProfileQueryOptions(authUser.current as User).queryKey,
    );
    expect(cached?.locale).toBe("vi");
    expect(isAuthSyncLocaleIgnored("vi")).toBe(false);

    await act(async () => root.unmount());
    container.remove();
  });

  it("persists only the latest locale when the user switches quickly", async () => {
    let releaseFirstCall: (() => void) | null = null;
    updateProfileForUserMock
      .mockImplementationOnce(() => new Promise((resolve) => { releaseFirstCall = () => resolve({}); }))
      .mockResolvedValue({});

    await renderTestHook();

    // First switch is already writing when the user clicks again.
    let p1: Promise<void> | null = null;
    act(() => {
      p1 = hookValue!.setLanguage("en" as SupportedLanguage);
    });
    let p2: Promise<void> | null = null;
    act(() => {
      p2 = hookValue!.setLanguage("vi" as SupportedLanguage);
    });

    expect(i18nMock.language).toBe("vi");

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      releaseFirstCall?.();
      await Promise.all([p1, p2]);
    });

    // Writes are serialized: the superseded one is skipped, the latest lands last.
    const written = updateProfileForUserMock.mock.calls.map((call) => call[1]);
    expect(written.at(-1)).toEqual({ locale: "vi" });
    expect(i18nMock.language).toBe("vi");
    const cached = queryClient.getQueryData<{ locale: string }>(
      currentProfileQueryOptions(authUser.current as User).queryKey,
    );
    expect(cached?.locale).toBe("vi");

    await act(async () => root.unmount());
    container.remove();
  });
});

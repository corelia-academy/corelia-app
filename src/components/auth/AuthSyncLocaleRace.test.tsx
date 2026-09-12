// @vitest-environment happy-dom
// @ts-expect-error - React 19 test environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const authSub = vi.hoisted(() => ({
  callback: null as ((event: string, session: unknown) => void) | null,
}));

const getProfileForUserMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/profile", () => ({
  getProfileForUser: getProfileForUserMock,
}));

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(async () => null),
  subscribeToAuthState: vi.fn((cb: (event: string, session: unknown) => void) => {
    authSub.callback = cb;
    return vi.fn();
  }),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
  },
}));

vi.mock("@/lib/coreliaEdgeApi", () => ({
  invokeCoreliaApi: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/perfTelemetry", () => ({
  timedAsync: vi.fn(async (_name, fn) => fn()),
}));

import { queryClient } from "@/lib/queryClient";
import { AuthSync } from "./AuthSync";
import { recordManualLocaleChange, resetManualLocaleIntent } from "@/lib/localeSyncGuard";

describe("AuthSync locale race protection", () => {
  beforeEach(() => {
    resetManualLocaleIntent();
    i18nMock.changeLanguage.mockClear();
    i18nMock.language = "vi";
    i18nMock.resolvedLanguage = "vi";
    getProfileForUserMock.mockReset();
    queryClient.clear();
  });

  it("prevents stale background profile fetch from reverting manual locale change", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    getProfileForUserMock.mockResolvedValue({
      id: "user-1",
      locale: "vi",
    });

    await act(async () => {
      root.render(<AuthSync />);
    });

    // Wait for mount getAuthSession to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    // Clear initial calls from anonymous boot
    i18nMock.changeLanguage.mockClear();

    // User explicitly changes language to 'en'
    recordManualLocaleChange("en");
    await i18nMock.changeLanguage("en");
    expect(i18nMock.changeLanguage).toHaveBeenCalledWith("en");
    i18nMock.changeLanguage.mockClear();

    // Stale auth event (like USER_UPDATED) fires with old profile in cache / fetch
    await act(async () => {
      authSub.callback?.("USER_UPDATED", {
        user: { id: "user-1", email: "user@example.com" },
      });
    });

    // Allow microtasks to run
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // AuthSync should NOT have called changeLanguage('vi') because user intent is 'en'
    expect(i18nMock.changeLanguage).not.toHaveBeenCalledWith("vi");

    await act(async () => root.unmount());
    container.remove();
  });

  it("allows AuthSync to set locale from profile when no manual change occurred", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    getProfileForUserMock.mockResolvedValue({
      id: "user-1",
      locale: "en",
    });

    await act(async () => {
      root.render(<AuthSync />);
    });

    // Wait for mount getAuthSession to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    i18nMock.changeLanguage.mockClear();

    await act(async () => {
      authSub.callback?.("SIGNED_IN", {
        user: { id: "user-1", email: "user@example.com" },
      });
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(i18nMock.changeLanguage).toHaveBeenCalledWith("en");

    await act(async () => root.unmount());
    container.remove();
  });
});

// @vitest-environment happy-dom
// @ts-expect-error - React 19 test environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

const authUser = vi.hoisted(() => ({
  current: { id: "user-test-1", email: "user@example.com" } as unknown,
}));

vi.mock("@/stores/authStore", () => ({
  useAuth: () => ({ user: authUser.current }),
}));

const updateProfileForUserMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/profile", () => ({
  updateProfileForUser: updateProfileForUserMock,
}));

import { useTimeZone } from "./useTimeZone";
import { currentProfileQueryOptions } from "@/features/auth/profileQueries";
import { AUTO_TIMEZONE, getTimeZonePreference, setTimeZonePreference } from "@/lib/timezone";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

describe("useTimeZone", () => {
  let queryClient: QueryClient;
  let root: ReturnType<typeof createRoot>;
  let hook: ReturnType<typeof useTimeZone> | null = null;
  const profileKey = () => currentProfileQueryOptions(authUser.current as User).queryKey;

  const onHook = (value: ReturnType<typeof useTimeZone>) => { hook = value; };

  function Probe() {
    const value = useTimeZone();
    React.useEffect(() => onHook(value), [value]);
    return null;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    authUser.current = { id: "user-test-1", email: "user@example.com" };
    setTimeZonePreference(AUTO_TIMEZONE);
    queryClient = new QueryClient();
    queryClient.setQueryData(profileKey(), { id: "user-test-1", timezone: null } as Profile);
    root = createRoot(document.createElement("div"));
    await act(async () => {
      root.render(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Probe)));
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    setTimeZonePreference(AUTO_TIMEZONE);
  });

  it("saves the chosen zone to the profile", async () => {
    updateProfileForUserMock.mockResolvedValue({});
    await act(async () => hook!.setPreference("Asia/Tokyo"));

    expect(updateProfileForUserMock).toHaveBeenCalledWith(authUser.current, { timezone: "Asia/Tokyo" });
    expect(hook!.preference).toBe("Asia/Tokyo");
    expect(queryClient.getQueryData<Profile>(profileKey())?.timezone).toBe("Asia/Tokyo");
  });

  it("stores auto-detect as null", async () => {
    updateProfileForUserMock.mockResolvedValue({});
    setTimeZonePreference("Asia/Tokyo");
    await act(async () => hook!.setPreference(AUTO_TIMEZONE));

    expect(updateProfileForUserMock).toHaveBeenCalledWith(authUser.current, { timezone: null });
  });

  it("rolls back when the profile write fails", async () => {
    updateProfileForUserMock.mockRejectedValue(new Error("offline"));
    await act(async () => {
      await expect(hook!.setPreference("Asia/Tokyo")).rejects.toThrow("offline");
    });

    expect(getTimeZonePreference()).toBe(AUTO_TIMEZONE);
  });

  it("only applies locally when signed out", async () => {
    authUser.current = null;
    await act(async () => root.render(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Probe))));
    await act(async () => hook!.setPreference("Europe/Paris"));

    expect(updateProfileForUserMock).not.toHaveBeenCalled();
    expect(getTimeZonePreference()).toBe("Europe/Paris");
  });
});

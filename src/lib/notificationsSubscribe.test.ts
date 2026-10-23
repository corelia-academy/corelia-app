import { expect, it, vi } from "vitest";

const channel = vi.hoisted(() => ({
  statusCallback: undefined as ((status: string) => void) | undefined,
}));
vi.mock("@/lib/supabase", () => {
  const chain = {
    on: () => chain,
    subscribe: (callback: (status: string) => void) => {
      channel.statusCallback = callback;
      return chain;
    },
  };
  return { supabase: { channel: () => chain, removeChannel: vi.fn() } };
});

import { subscribeToNotifications } from "./notifications";

it("refetches after a reconnect but not on the first subscription", () => {
  const onChange = vi.fn();
  subscribeToNotifications("user-1", onChange);
  channel.statusCallback?.("SUBSCRIBED");
  expect(onChange).not.toHaveBeenCalled();
  channel.statusCallback?.("CHANNEL_ERROR");
  channel.statusCallback?.("SUBSCRIBED");
  expect(onChange).toHaveBeenCalledOnce();
});

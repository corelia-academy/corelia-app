// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import type { XpEntry } from "@/lib/xp";

const mocks = vi.hoisted(() => ({ rows: [] as XpEntry[], toast: vi.fn(), rpc: vi.fn().mockResolvedValue({ error: null }) }));
vi.mock("@/lib/supabase", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: { id: "notification-ui-test" } }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, options?: { count?: number }) => options?.count ? `+${options.count} XP` : key }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.toast } }));
vi.mock("@/lib/xpNotifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/xpNotifications")>();
  return { ...actual, initializeXpNotifications: async (id: string) => {
    const cursor = actual.readXpNotificationCursor(id) ?? { createdAt: null, ids: [] };
    actual.saveXpNotificationCursor(id, cursor);
    return cursor;
  }, getXpNotificationEntries: async () => [...mocks.rows] };
});
import { XpNotifications } from "./XpNotifications";
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const host = document.createElement("div");
let root = createRoot(host);
let client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
async function render() {
  await act(async () => { root.render(<QueryClientProvider client={client}><XpNotifications /></QueryClientProvider>); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
}
afterEach(() => { act(() => root.unmount()); client.clear(); });
it("shows actual awards after invalidation and does not repeat after remount or refetch", async () => {
  await render();
  expect(mocks.toast).not.toHaveBeenCalled();
  mocks.rows = [10, 20, 100].map((points, index) => ({ id: `award-${index}`, points, source: ["lesson_completed", "quiz_passed", "course_completed"][index], created_at: "2026-09-22T00:00:00+00:00", occurred_at: "2026-09-22T00:00:00+00:00", entity_id: null, entity_type: null, reason: null }));
  await act(async () => { await client.invalidateQueries({ queryKey: ["xp"] }); await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(mocks.toast).toHaveBeenCalledOnce();
  expect(mocks.toast).toHaveBeenCalledWith("+130 XP", expect.objectContaining({ duration: 6500 }));
  expect(mocks.toast.mock.calls[0][1]).not.toHaveProperty("description");
  await act(async () => { await client.invalidateQueries({ queryKey: ["xp"] }); });
  expect(mocks.toast).toHaveBeenCalledOnce();
  act(() => root.unmount()); client.clear();
  root = createRoot(host); client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render();
  expect(mocks.toast).toHaveBeenCalledOnce();
});

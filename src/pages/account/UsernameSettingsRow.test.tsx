// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { UsernameSettingsRow } from "./UsernameSettingsRow";
import { updateProfileForUser } from "@/lib/profile";

const refreshProfile = vi.fn(async () => undefined);

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/stores/authStore", () => {
  const value = {
    user: { id: "11111111-1111-4111-8111-111111111111" },
    profile: { id: "11111111-1111-4111-8111-111111111111", username: "admin_local" },
    refreshProfile: () => refreshProfile(),
  };
  return { useAuth: () => value };
});
vi.mock("@/lib/profile", () => ({ updateProfileForUser: vi.fn() }));
vi.mock("@/lib/queryClient", () => ({ queryClient: { invalidateQueries: vi.fn(async () => undefined) } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let cleanup: (() => void) | undefined;
beforeEach(() => { vi.mocked(updateProfileForUser).mockResolvedValue({} as never); });
afterEach(() => { cleanup?.(); vi.clearAllMocks(); });

async function renderAndOpen() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanup = () => { act(() => root.unmount()); container.remove(); };
  await act(async () => root.render(<UsernameSettingsRow />));
  expect(container.textContent).toContain("admin_local");
  await act(async () => [...container.querySelectorAll("button")].find((b) => b.textContent === "settings.account.changeUsername")!.click());
}

const modal = () => document.querySelector<HTMLElement>('[data-slot="modal"]');
const input = () => modal()!.querySelector<HTMLInputElement>("input")!;
const confirm = () => act(async () => [...modal()!.querySelectorAll<HTMLButtonElement>('[data-slot="modal-actions"] button')].at(-1)!.click());
function type(value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), value);
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("settings username row", () => {
  it("saves only a changed username and confirms with a toast", async () => {
    await renderAndOpen();
    type("admin_local2");
    await confirm();
    expect(updateProfileForUser).toHaveBeenCalledWith(expect.anything(), { username: "admin_local2" });
    expect(refreshProfile).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("profile.success.updated");
    expect(modal()).toBeNull();
  });

  it("closes without a request when nothing changed", async () => {
    await renderAndOpen();
    await confirm();
    expect(updateProfileForUser).not.toHaveBeenCalled();
    expect(modal()).toBeNull();
  });

  it("keeps the modal open with the taken-username message", async () => {
    vi.mocked(updateProfileForUser).mockRejectedValue(new Error('duplicate key value violates unique constraint "profiles_username_lower_key"'));
    await renderAndOpen();
    type("student2");
    await confirm();
    expect(modal()?.textContent).toContain("profile.errors.usernameTaken");
  });
});

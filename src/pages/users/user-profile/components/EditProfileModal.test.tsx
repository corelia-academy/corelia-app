// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditProfileModal } from "./EditProfileModal";
import { updateProfileForUser } from "@/lib/profile";
import { toast } from "sonner";

const refreshProfile = vi.fn(async () => undefined);

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/UserAvatar", () => ({ UserAvatar: () => <span data-testid="avatar" /> }));
vi.mock("@/stores/authStore", () => {
  const value = {
    user: { id: "11111111-1111-4111-8111-111111111111" },
    profile: {
      id: "11111111-1111-4111-8111-111111111111",
      full_name: "Admin Local",
      username: "admin_local",
      bio: null,
      website: null,
      avatar_url: null,
      avatar_seed: null,
      avatar_config: { selections: {}, colors: {} },
    },
    refreshProfile: (...args: unknown[]) => refreshProfile(...(args as [])),
  };
  return { useAuth: () => value };
});
vi.mock("@/lib/profile", () => ({ updateProfileForUser: vi.fn() }));
vi.mock("@/lib/queryClient", () => ({ queryClient: { invalidateQueries: vi.fn(async () => undefined) } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let cleanup: (() => void) | undefined;
const onOpenChange = vi.fn();
const onEditAvatar = vi.fn();
const onUsernameChanged = vi.fn();

beforeEach(() => {
  vi.mocked(updateProfileForUser).mockResolvedValue({} as never);
});
afterEach(() => {
  cleanup?.();
  vi.clearAllMocks();
});

async function renderModal() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanup = () => { act(() => root.unmount()); container.remove(); };
  await act(async () => {
    root.render(<EditProfileModal open onOpenChange={onOpenChange} onEditAvatar={onEditAvatar} onUsernameChanged={onUsernameChanged} />);
  });
}

function setValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

const modal = (type: "slot" | "confirmation") => document.querySelector<HTMLElement>(`[data-slot="modal"][data-type="${type}"]`)!;
const confirmButton = (type: "slot" | "confirmation") =>
  [...modal(type).querySelectorAll<HTMLButtonElement>('[data-slot="modal-actions"] button')].find((button) => button.textContent === "userProfile.edit.confirm")!;
const usernameInput = () => [...modal("slot").querySelectorAll<HTMLInputElement>("input")].find((input) => input.value === "admin_local")!;

async function submit() {
  await act(async () => confirmButton("slot").click());
  await act(async () => confirmButton("confirmation").click());
}

describe("edit profile modal", () => {
  it("asks for confirmation and saves without sending an unchanged username", async () => {
    await renderModal();
    await act(async () => confirmButton("slot").click());
    expect(updateProfileForUser).not.toHaveBeenCalled();
    expect(modal("confirmation")).not.toBeNull();

    await act(async () => confirmButton("confirmation").click());
    expect(updateProfileForUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: "11111111-1111-4111-8111-111111111111" }),
      { full_name: "Admin Local", bio: null, website: null },
    );
    expect(refreshProfile).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast.success).toHaveBeenCalledWith("profile.success.updated");
    expect(onUsernameChanged).not.toHaveBeenCalled();
  });

  it("sends a changed username and reports the new one", async () => {
    await renderModal();
    act(() => setValue(usernameInput(), "admin_local2"));
    await submit();
    expect(updateProfileForUser).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ username: "admin_local2" }));
    expect(onUsernameChanged).toHaveBeenCalledWith("admin_local2");
  });

  it("shows the old taken-username message and keeps the form open", async () => {
    vi.mocked(updateProfileForUser).mockRejectedValue(new Error('duplicate key value violates unique constraint "profiles_username_lower_key"'));
    await renderModal();
    act(() => setValue(usernameInput(), "student2"));
    await submit();
    expect(modal("slot").querySelector('[role="alert"]')?.textContent).toBe("profile.errors.usernameTaken");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(onUsernameChanged).not.toHaveBeenCalled();
  });

  it("opens the avatar editor from the avatar row", async () => {
    await renderModal();
    const button = [...modal("slot").querySelectorAll("button")].find((item) => item.textContent === "avatarEditor.edit")!;
    act(() => button.click());
    expect(onEditAvatar).toHaveBeenCalled();
  });
});

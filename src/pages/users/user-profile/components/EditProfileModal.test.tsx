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
    root.render(<EditProfileModal open onOpenChange={onOpenChange} onEditAvatar={onEditAvatar} />);
  });
}

const modal = (type: "slot" | "confirmation") => document.querySelector<HTMLElement>(`[data-slot="modal"][data-type="${type}"]`)!;
const confirmButton = (type: "slot" | "confirmation") =>
  [...modal(type).querySelectorAll<HTMLButtonElement>('[data-slot="modal-actions"] button')].find((button) => button.textContent === "userProfile.edit.confirm")!;

describe("edit profile modal", () => {
  it("asks for confirmation and saves only the public profile fields", async () => {
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
  });

  it("has no username field: the username is changed in Settings", async () => {
    await renderModal();
    const values = [...modal("slot").querySelectorAll<HTMLInputElement>("input")].map((input) => input.value);
    expect(values).not.toContain("admin_local");
    expect(modal("slot").textContent).not.toContain("profile.username.label");
  });

  it("shows the old save error and keeps the form open", async () => {
    vi.mocked(updateProfileForUser).mockRejectedValue(new Error("profile_name_too_long"));
    await renderModal();
    await act(async () => confirmButton("slot").click());
    await act(async () => confirmButton("confirmation").click());
    expect(modal("slot").querySelector('[role="alert"]')?.textContent).toBe("profile.errors.invalidName");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("opens the avatar editor from the avatar row", async () => {
    await renderModal();
    const button = [...modal("slot").querySelectorAll("button")].find((item) => item.textContent === "avatarEditor.edit")!;
    act(() => button.click());
    expect(onEditAvatar).toHaveBeenCalled();
  });

  const setValue = (input: HTMLInputElement, value: string) => act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const linkField = (label: string) => modal("slot").querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;

  it("saves a GitHub link into the social links list", async () => {
    await renderModal();
    await setValue(linkField("userProfile.edit.linkGithub"), "https://github.com/corelia");
    await act(async () => confirmButton("slot").click());
    await act(async () => confirmButton("confirmation").click());
    expect(updateProfileForUser).toHaveBeenCalledWith(expect.anything(),
      expect.objectContaining({ instructor_social_links: [{ platform: "github", url: "https://github.com/corelia" }] }));
  });

  it("blocks a link that is not http or https", async () => {
    await renderModal();
    await setValue(linkField("userProfile.edit.linkLinkedin"), "javascript:alert(1)");
    await act(async () => confirmButton("slot").click());
    expect(modal("confirmation")).toBeNull();
    expect(modal("slot").querySelector('[role="alert"]')?.textContent).toBe("instructorProfile.socialLinks.errors.urlInvalid");
    expect(updateProfileForUser).not.toHaveBeenCalled();
  });

  it("shows the website field first, then adds more link fields", async () => {
    await renderModal();
    const count = () => modal("slot").querySelectorAll('input[type="url"]').length;
    const add = () => act(async () => [...modal("slot").querySelectorAll("button")].find((b) => b.textContent === "userProfile.edit.addLink")!.click());
    expect(count()).toBe(2);
    await add();
    expect(count()).toBe(3);
    await add();
    expect(count()).toBe(4);
  });

  it("blocks a website that is not http or https", async () => {
    await renderModal();
    await act(async () => [...modal("slot").querySelectorAll("button")].find((b) => b.textContent === "userProfile.edit.addLink")!.click());
    await setValue(linkField("profile.website.label"), "abc.com");
    await act(async () => confirmButton("slot").click());
    expect(modal("confirmation")).toBeNull();
    expect(updateProfileForUser).not.toHaveBeenCalled();
  });
});

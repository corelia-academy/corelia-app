// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChangePasswordCard } from "./ChangePasswordCard";
import { EmailSettingsRow, PhoneSettingsRow } from "./ContactSettingsRows";
import { ProfileVisibilitySettingsRow } from "./ProfileVisibilitySettingsRow";

const mocks = vi.hoisted(() => ({
  updateProfileForUser: vi.fn(),
  refreshProfile: vi.fn(),
  toastError: vi.fn(),
  identities: [] as { provider: string }[],
}));
const user = { id: "u1", email: "a@example.test", identities: [{ provider: "email" }] };
const profile = { id: "u1", username: "dict", phone: "0900", profile_public: true };

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, options?: { provider?: string }) => (options?.provider ? `${key}:${options.provider}` : key) }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: mocks.identities }),
  useMutation: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
vi.mock("@/features/account/accountQueries", () => ({ connectedIdentitiesQueryOptions: () => ({}) }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user, profile, refreshProfile: mocks.refreshProfile }) }));
vi.mock("@/lib/profile", () => ({ updateProfileForUser: mocks.updateProfileForUser }));
vi.mock("@/lib/queryClient", () => ({ queryClient: { invalidateQueries: vi.fn() } }));
vi.mock("@/lib/auth", () => ({ changePasswordWithReauthentication: vi.fn() }));
vi.mock("@/pages/login/loginErrors", () => ({ getAuthErrorInfo: () => ({ message: "" }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.toastError } }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let cleanup: (() => void) | undefined;
beforeEach(() => { mocks.identities = []; });
afterEach(() => { cleanup?.(); cleanup = undefined; vi.clearAllMocks(); });

async function render(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanup = () => { act(() => root.unmount()); container.remove(); };
  await act(async () => root.render(node));
  return container;
}

const button = (text: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === text)!;

describe("account detail rows", () => {
  it("always shows the sign-in method as a disabled button", async () => {
    mocks.identities = [{ provider: "email" }];
    const emailOnly = await render(<EmailSettingsRow />);
    expect(emailOnly.textContent).toContain("a@example.test");
    expect(button("settings.account.signedInWith:Email").disabled).toBe(true);
    cleanup?.();
    mocks.identities = [{ provider: "email" }, { provider: "google" }];
    await render(<EmailSettingsRow />);
    expect(button("settings.account.signedInWith:Google").disabled).toBe(true);
  });

  it("hides the password row without an email provider", async () => {
    const container = await render(<ChangePasswordCard user={{ ...user, identities: [{ provider: "google" }] } as never} />);
    expect(container.textContent).toBe("");
  });

  it("saves the phone number from the modal", async () => {
    await render(<PhoneSettingsRow />);
    await act(async () => button("settings.account.changePhone").click());
    const input = document.querySelector<HTMLInputElement>('input[type="tel"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, " 0911 ");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => button("actions.confirm").click());
    expect(mocks.updateProfileForUser).toHaveBeenCalledWith(user, { phone: "0911" });
  });

  it("rolls the visibility back when saving fails", async () => {
    mocks.updateProfileForUser.mockRejectedValueOnce(new Error("boom"));
    const container = await render(<ProfileVisibilitySettingsRow />);
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-label^="settings.visibility.title"]')!;
    await act(async () => { trigger.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })); trigger.click(); });
    const privateItem = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find((i) => i.textContent?.includes("status.private"))!;
    await act(async () => privateItem.click());
    expect(mocks.updateProfileForUser).toHaveBeenCalledWith(user, { profile_public: false });
    expect(mocks.toastError).toHaveBeenCalledWith("boom");
    expect(trigger.getAttribute("aria-label")).toContain("status.public");
  });
});

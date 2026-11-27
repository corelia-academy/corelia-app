// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { AvatarSettingsRoute } from "./AvatarSettingsRoute";
import { saveMyAvatar } from "@/lib/avatarProfile";
import { queryClient } from "@/lib/queryClient";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/stores/authStore", () => {
  const value = {
    user: { id: "11111111-1111-4111-8111-111111111111" },
    profile: { id: "11111111-1111-4111-8111-111111111111", avatar_seed: null, avatar_config: { selections: {}, colors: {} } },
    refreshProfile: vi.fn(async () => undefined),
  };
  return { useAuth: () => value };
});
vi.mock("@/lib/avatarProfile", () => ({ saveMyAvatar: vi.fn() }));
vi.mock("@/lib/queryClient", () => ({ queryClient: { invalidateQueries: vi.fn(async () => undefined) } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); vi.clearAllMocks(); });

async function renderRoute() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanup = () => { act(() => root.unmount()); container.remove(); };
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/settings/avatar"]}>
        <Routes>
          <Route path="/settings/avatar" element={<AvatarSettingsRoute />} />
          <Route path="/account/profile" element={<p>profile-page</p>} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return container;
}

const findButton = (label: string) =>
  [...document.querySelectorAll("button")].find((button) => button.textContent === label || button.getAttribute("aria-label") === label)!;

describe("avatar editor modal", () => {
  it("keeps randomization and part edits local until Save", async () => {
    vi.mocked(saveMyAvatar).mockImplementation(async (seed, config) => ({ seed, ...config }));
    await renderRoute();
    act(() => findButton("avatarEditor.randomize").click());
    const head = document.querySelector<HTMLButtonElement>("#avatar-head")!;
    await act(async () => { head.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })); head.click(); });
    const option = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find((item) => item.textContent === "Fluffy Bob")!;
    await act(async () => option.click());
    expect(saveMyAvatar).not.toHaveBeenCalled();
    await act(async () => findButton("avatarEditor.save").click());
    expect(saveMyAvatar).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f-]{36}$/), expect.objectContaining({ selections: { head: "fluffy-bob" } }));
  });

  it("steps through parts with the arrows without opening the list and stops at both ends", async () => {
    vi.mocked(saveMyAvatar).mockImplementation(async (seed, config) => ({ seed, ...config }));
    await renderRoute();
    const head = document.querySelector<HTMLButtonElement>("#avatar-head")!;
    const field = head.parentElement!;
    const previous = field.querySelector<HTMLButtonElement>('button[aria-label="avatarEditor.previousOption"]')!;
    const next = field.querySelector<HTMLButtonElement>('button[aria-label="avatarEditor.nextOption"]')!;
    expect(head.textContent).toBe("avatarEditor.fromSeed");
    expect(previous.disabled).toBe(true);

    await act(async () => next.click());
    expect(head.textContent).toBe("Fluffy Bob");
    expect(document.querySelector('[role="menuitemradio"]')).toBeNull();
    expect(previous.disabled).toBe(false);

    await act(async () => previous.click());
    expect(head.textContent).toBe("avatarEditor.fromSeed");
    expect(previous.disabled).toBe(true);
  });

  it("finishes Save while the cache refresh is still pending", async () => {
    vi.mocked(saveMyAvatar).mockResolvedValue({ seed: "saved-seed", selections: {}, colors: {} });
    vi.mocked(queryClient.invalidateQueries).mockImplementation(() => new Promise(() => {}));
    const container = await renderRoute();
    await act(async () => findButton("avatarEditor.save").click());

    expect(queryClient.invalidateQueries).toHaveBeenCalled();
    expect(container.textContent).toContain("profile-page");
    expect(document.querySelector('[data-slot="modal"]')).toBeNull();
  });
});

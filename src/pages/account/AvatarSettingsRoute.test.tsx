// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { AvatarSettingsRoute } from "./AvatarSettingsRoute";
import { saveMyAvatar } from "@/lib/avatarProfile";

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

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); vi.clearAllMocks(); });

describe("avatar editor", () => {
  it("keeps randomization and part edits local until Save", async () => {
    vi.mocked(saveMyAvatar).mockImplementation(async (seed, config) => ({ seed, ...config }));
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    cleanup = () => { act(() => root.unmount()); container.remove(); };
    await act(async () => { root.render(<MemoryRouter><AvatarSettingsRoute /></MemoryRouter>); });
    const buttons = [...container.querySelectorAll("button")];
    const randomize = buttons.find((button) => button.textContent?.includes("avatarEditor.randomize"))!;
    const save = buttons.find((button) => button.textContent?.includes("avatarEditor.save"))!;
    act(() => randomize.click());
    const head = container.querySelector<HTMLSelectElement>("#avatar-head")!;
    act(() => { head.value = "fluffy-bob"; head.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(saveMyAvatar).not.toHaveBeenCalled();
    await act(async () => save.click());
    expect(saveMyAvatar).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f-]{36}$/), expect.objectContaining({ selections: { head: "fluffy-bob" } }));
  });
});

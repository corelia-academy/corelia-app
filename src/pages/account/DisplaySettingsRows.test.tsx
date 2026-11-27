// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountSettingsRoute } from "./AccountSettingsRoute";

const setLanguage = vi.fn(async () => undefined);
const setTheme = vi.fn();
const setPreference = vi.fn(async () => undefined);

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/useLocale", () => ({ useLocale: () => ({ language: "vi", setLanguage }) }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "dark", setTheme }) }));
vi.mock("@/lib/themeTransition", () => ({ setThemeWithTransition: (set: (value: string) => void, next: string) => set(next) }));
vi.mock("@/hooks/useTimeZone", () => ({ useTimeZone: () => ({ preference: "auto", timeZone: "Asia/Saigon", setPreference }) }));
vi.mock("@/lib/intl", () => ({ intlLocale: () => "en-US" }));
vi.mock("@/lib/timezone", () => ({
  AUTO_TIMEZONE: "auto",
  detectTimeZone: () => "Asia/Saigon",
  listTimeZones: () => ["Asia/Saigon", "Europe/London", "America/New_York"],
  timeZoneOffsetLabel: () => "",
}));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: null, profile: null, signOut: vi.fn() }) }));
vi.mock("./UsernameSettingsRow", () => ({ UsernameSettingsRow: () => null }));
vi.mock("./NotificationPreferencesCard", () => ({ NotificationPreferencesCard: () => null }));
vi.mock("./ContactSettingsRows", () => ({ EmailSettingsRow: () => null, PhoneSettingsRow: () => null }));
vi.mock("./ProfileVisibilitySettingsRow", () => ({ ProfileVisibilitySettingsRow: () => null }));
vi.mock("./ConnectedAccountsCard", () => ({ ConnectedAccountsCard: () => null }));
vi.mock("./ConnectOCIDCard", () => ({ default: () => null }));
vi.mock("./ChangePasswordCard", () => ({ ChangePasswordCard: () => null }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); vi.clearAllMocks(); });

async function render() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanup = () => { act(() => root.unmount()); container.remove(); };
  await act(async () => root.render(<MemoryRouter><AccountSettingsRoute /></MemoryRouter>));
  return container;
}

async function openMenu(container: HTMLElement, labelStart: string) {
  const trigger = [...container.querySelectorAll("button")].find((b) => b.getAttribute("aria-label")?.startsWith(labelStart))!;
  await act(async () => { trigger.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })); trigger.click(); });
  return trigger;
}

const items = () => [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
const pick = (text: string) => act(async () => items().find((item) => item.textContent?.includes(text))!.click());

describe("language & display settings", () => {
  it("groups language, theme and timezone in one section", async () => {
    const container = await render();
    const section = container.querySelector('section[aria-label="settings.display.title"]')!;
    expect(section.textContent).toContain("settings.language.title");
    expect(section.textContent).toContain("settings.appearance.title");
    expect(section.textContent).toContain("settings.timezone.title");
  });

  it("offers every app language and saves the picked one", async () => {
    const container = await render();
    await openMenu(container, "settings.language.title");
    expect(items()).toHaveLength(7);
    await pick("settings.language.meta.en");
    expect(setLanguage).toHaveBeenCalledWith("en");
  });

  it("offers light, dark and system and applies the picked theme", async () => {
    const container = await render();
    await openMenu(container, "settings.appearance.title");
    expect(items().map((item) => item.textContent)).toEqual([
      "settings.appearance.light",
      "settings.appearance.dark",
      "settings.appearance.system",
    ]);
    await pick("settings.appearance.light");
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("filters time zones by search and saves the picked one", async () => {
    const container = await render();
    await openMenu(container, "settings.timezone.label");
    expect(items()).toHaveLength(4);
    const search = document.querySelector<HTMLInputElement>('input[type="search"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(search, "lond");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(items().map((item) => item.textContent)).toEqual(["settings.timezone.auto", "Europe/London"]);
    await pick("Europe/London");
    expect(setPreference).toHaveBeenCalledWith("Europe/London");
  });
});

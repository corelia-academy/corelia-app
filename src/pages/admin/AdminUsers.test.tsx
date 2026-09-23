// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminUsers from "./AdminUsers";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({ mobile: false, count: 53 }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => ({ user: { id: "admin" } }) }));
vi.mock("@/lib/profile", () => ({ updateProfileAdmin: vi.fn() }));
vi.mock("@/types/database", () => ({ getRoleLabel: (role: string) => role }));
vi.mock("@/lib/intl", () => ({ intlLocale: () => "en-US" }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => state.mobile }));
vi.mock("@/components/UserAvatar", () => ({ UserAvatar: ({ userId }: { userId: string }) => <span data-avatar={userId} /> }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, args?: Record<string, unknown>) => args ? `${key} ${JSON.stringify(args)}` : key }) }));
vi.mock("@/features/admin/users/hooks/useAdminProfiles", () => ({
  useAdminProfiles: () => ({
    profiles: Array.from({ length: state.count }, (_, index) => ({
      id: `user-${index}`, full_name: `Person ${index}`, role: index === 52 ? "admin" : "student",
    })), loading: false, error: null, refresh: vi.fn(), setProfiles: vi.fn(),
  }),
}));

let container: HTMLDivElement;
let root: Root;
function render() { act(() => root.render(<AdminUsers />)); }
function click(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent === label)!;
  act(() => button.click());
}
function ids() { return Array.from(container.querySelectorAll("[data-avatar]"), (el) => el.getAttribute("data-avatar")); }

beforeEach(() => {
  state.mobile = false; state.count = 53;
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("AdminUsers pagination", () => {
  it("mounts only 25 accounts and one responsive layout, and reaches the last page", () => {
    render(); expect(ids()).toHaveLength(25); expect(ids()[0]).toBe("user-0");
    click("users.pagination.next"); expect(ids()[0]).toBe("user-25");
    click("users.pagination.next"); expect(ids()).toEqual(["user-50", "user-51", "user-52"]);
    click("users.pagination.previous"); expect(ids()[0]).toBe("user-25");
    state.mobile = true; render(); expect(ids()).toHaveLength(25); expect(container.querySelector("table")).toBeNull();
  });

  it("filters across all accounts and resets pagination", () => {
    render(); click("users.pagination.next");
    const select = container.querySelector("select")!;
    act(() => { select.value = "admin"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(ids()).toEqual(["user-52"]);
    click("users.allRoles"); expect(ids()[0]).toBe("user-0");
  });

  it("clamps the current page after refresh and handles empty results", () => {
    render(); click("users.pagination.next"); click("users.pagination.next");
    state.count = 26; render(); expect(ids()).toEqual(["user-25"]);
    state.count = 0; render(); expect(ids()).toHaveLength(0);
    expect(container.textContent).toContain('"start":0,"end":0,"total":0');
    const buttons = Array.from(container.querySelectorAll("nav button"));
    expect(buttons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });
});

// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { AccountInstructorProfileRoute } from "./AccountInstructorRoutes";

const auth = vi.hoisted(() => ({
  value: {
    user: { id: "user" },
    profile: null as null | { id: string; role: string },
    profileLoading: true,
    refreshProfile: async () => undefined,
  },
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/stores/authStore", () => ({ useAuth: () => auth.value }));
vi.mock("@/lib/profile", () => ({ updateProfileForUser: vi.fn() }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); });

function mount() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanup = () => { act(() => root.unmount()); container.remove(); };
  act(() => {
    root.render(
      <MemoryRouter initialEntries={["/account/instructor"]}>
        <Routes>
          <Route path="/account" element={<p>account-home</p>} />
          <Route path="/account/instructor" element={<AccountInstructorProfileRoute />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return container;
}

it("waits for the profile instead of bouncing instructors to /account on reload", () => {
  auth.value = { ...auth.value, profile: null, profileLoading: true };
  const container = mount();
  expect(container.textContent).not.toContain("account-home");
  expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
});

it("redirects non-instructors once the profile is known", () => {
  auth.value = { ...auth.value, profile: { id: "user", role: "student" }, profileLoading: false };
  const container = mount();
  expect(container.textContent).toContain("account-home");
});

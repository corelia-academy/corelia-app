// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const authState = vi.hoisted(() => ({ role: "admin" as string | null }));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/stores/authStore", () => ({
  useAuth: () => ({ profile: authState.role ? { role: authState.role } : null }),
}));

import { AdminSidebar } from "./AdminSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

const STUDIO_URL = "https://studio.example.test";

async function renderSidebar() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/admin"]}>
        <SidebarProvider>
          <AdminSidebar />
        </SidebarProvider>
      </MemoryRouter>,
    );
  });
  return { container, unmount: () => act(async () => root.unmount()) };
}

describe("AdminSidebar Corelia Studio link", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllEnvs();
    authState.role = "admin";
  });

  it("renders an external link to Studio for admins", async () => {
    vi.stubEnv("VITE_STUDIO_URL", STUDIO_URL);
    const { container, unmount } = await renderSidebar();

    const link = container.querySelector<HTMLAnchorElement>(`a[href="${STUDIO_URL}"]`);
    expect(link).not.toBeNull();
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link?.textContent).toContain("Corelia Studio");

    await unmount();
  });

  it.each(["support_staff", "user"])("hides the Studio link for role %s", async (role) => {
    vi.stubEnv("VITE_STUDIO_URL", STUDIO_URL);
    authState.role = role;
    const { container, unmount } = await renderSidebar();

    expect(container.querySelector(`a[href="${STUDIO_URL}"]`)).toBeNull();

    await unmount();
  });

  it("hides the Studio link when no profile is loaded", async () => {
    vi.stubEnv("VITE_STUDIO_URL", STUDIO_URL);
    authState.role = null;
    const { container, unmount } = await renderSidebar();

    expect(container.querySelector(`a[href="${STUDIO_URL}"]`)).toBeNull();

    await unmount();
  });

  it.each(["", "   "])("hides the Studio link when VITE_STUDIO_URL is %j", async (value) => {
    vi.stubEnv("VITE_STUDIO_URL", value);
    const { container, unmount } = await renderSidebar();

    expect(container.querySelector('a[target="_blank"]')).toBeNull();
    expect(container.textContent).not.toContain("Corelia Studio");

    await unmount();
  });
});

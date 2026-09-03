// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider, useNavigate } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

import AdminLayout from "./AdminLayout";

function RouteControls() {
  const navigate = useNavigate();

  return React.createElement(
    "div",
    null,
    React.createElement("button", { type: "button", onClick: () => navigate("/admin/hackathons/new#overview") }, "New editor"),
    React.createElement("button", { type: "button", onClick: () => navigate("/admin/hackathons/new#timeline") }, "Editor hash"),
    React.createElement("button", { type: "button", onClick: () => navigate("/admin/hackathons/hackathon-1/edit#overview") }, "Edit editor"),
    React.createElement("button", { type: "button", onClick: () => navigate("/admin/hackathons") }, "Hackathon list"),
  );
}

function renderLayout(initialEntry: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const router = createMemoryRouter(
    [
      {
        path: "/admin",
        element: React.createElement(AdminLayout),
        children: [
          { path: "hackathons", element: React.createElement(RouteControls) },
          { path: "hackathons/new", element: React.createElement(RouteControls) },
          { path: "hackathons/:id/edit", element: React.createElement(RouteControls) },
        ],
      },
    ],
    { initialEntries: [initialEntry] },
  );

  act(() => {
    root.render(React.createElement(RouterProvider, { router }));
  });

  return {
    container,
    async cleanup() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

function sidebarState(container: HTMLElement) {
  return container.querySelector('[data-slot="sidebar"][data-state]')?.getAttribute("data-state");
}

async function clickButton(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll("button"))
    .find((candidate) => candidate.textContent === label);
  await act(async () => button?.click());
}

describe("AdminLayout focused editor sidebar", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("collapses for hackathon editors, permits manual expansion, and reopens on list routes", async () => {
    const view = renderLayout("/admin/hackathons/new#overview");

    expect(sidebarState(view.container)).toBe("collapsed");

    await clickButton(view.container, "Toggle Sidebar");
    expect(sidebarState(view.container)).toBe("expanded");

    await clickButton(view.container, "Editor hash");
    expect(sidebarState(view.container)).toBe("expanded");

    await clickButton(view.container, "Hackathon list");
    expect(sidebarState(view.container)).toBe("expanded");

    await clickButton(view.container, "Edit editor");
    expect(sidebarState(view.container)).toBe("collapsed");

    await clickButton(view.container, "Hackathon list");
    expect(sidebarState(view.container)).toBe("expanded");

    await clickButton(view.container, "New editor");
    expect(sidebarState(view.container)).toBe("collapsed");

    await view.cleanup();
  });
});

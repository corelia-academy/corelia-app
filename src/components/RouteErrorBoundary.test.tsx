// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function Boom(): never {
  throw new Error("boom in route");
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("RouteErrorBoundary", () => {
  it("replaces the default React Router developer screen", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const router = createMemoryRouter([{ path: "*", element: <Boom />, errorElement: <RouteErrorBoundary /> }]);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    act(() => root.render(<RouterProvider router={router} />));

    expect(container.textContent).toContain("errorBoundary.title");
    expect(container.textContent).toContain("boom in route");
    expect(container.textContent).not.toContain("Hey developer");
    act(() => root.unmount());
  });
});

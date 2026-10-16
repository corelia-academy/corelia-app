import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(
  fileURLToPath(new URL("./App.tsx", import.meta.url)),
  "utf8",
);

describe("App router context", () => {
  it("mounts CredentialRealtimeSync inside the data router route element", () => {
    const routerIndex = appSource.indexOf("function ApplicationRoutes()");
    expect(appSource).toContain('element: <ApplicationRoutes />');
    expect(appSource).toContain("<RouterProvider router={router} />");
    const credentialSyncIndex = appSource.indexOf("<CredentialRealtimeSync />");

    expect(routerIndex).toBeGreaterThanOrEqual(0);
    expect(credentialSyncIndex).toBeGreaterThan(routerIndex);
  });

  it("renders a neutral bootstrap screen before mounting auth-aware routes", () => {
    expect(appSource).toContain('authStatus === "booting"');
    expect(appSource).toMatch(
      /authStatus === "booting"[\s\S]*?<AuthBootstrapScreen\b[\s\S]*?\/>[\s\S]*?<ApplicationRouter \/>/,
    );
  });

  it("registers the Informative Icon route in the component route list", () => {
    const informativeIconRouteIndex = appSource.indexOf('"informative-icon",');
    const dynamicComponentRouteIndex = appSource.indexOf(
      "path={`/components/${component}`}",
      informativeIconRouteIndex,
    );

    expect(informativeIconRouteIndex).toBeGreaterThanOrEqual(0);
    expect(dynamicComponentRouteIndex).toBeGreaterThan(informativeIconRouteIndex);
  });
});

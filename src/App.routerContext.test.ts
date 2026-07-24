import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(
  fileURLToPath(new URL("./App.tsx", import.meta.url)),
  "utf8",
);

describe("App router context", () => {
  it("mounts CredentialRealtimeSync inside BrowserRouter", () => {
    const routerIndex = appSource.indexOf("<BrowserRouter>");
    const credentialSyncIndex = appSource.indexOf("<CredentialRealtimeSync />");

    expect(routerIndex).toBeGreaterThanOrEqual(0);
    expect(credentialSyncIndex).toBeGreaterThan(routerIndex);
  });
});
